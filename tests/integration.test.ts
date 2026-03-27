/**
 * Integration tests for the HudPlugin event flow.
 *
 * Tests simulate a full conversation lifecycle by calling the plugin's
 * `event` hook directly. setInterval/clearInterval are mocked so we can
 * control timing and verify the display loop without real timers.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test"
import type { SessionMetrics } from "../src/types.js"

// ── Mock setInterval / clearInterval ──────────────────────────────────────

let mockIntervalId = 0
const activeIntervals = new Map<number, () => void>()

const mockSetInterval = mock((cb: () => void, _ms: number) => {
  const id = ++mockIntervalId
  activeIntervals.set(id, cb)
  return id as unknown as ReturnType<typeof setInterval>
})

const mockClearInterval = mock((id: ReturnType<typeof setInterval>) => {
  activeIntervals.delete(id as unknown as number)
})

// Patch globals before importing the plugin
globalThis.setInterval = mockSetInterval as unknown as typeof setInterval
globalThis.clearInterval = mockClearInterval as unknown as typeof clearInterval

// ── Mock OpenCode client ───────────────────────────────────────────────────

const emittedEvents: unknown[] = []
const mockClient = {
  event: {
    emit: mock(async (payload: unknown) => {
      emittedEvents.push(payload)
    }),
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSessionCreated(sessionId: string) {
  return { type: "session.created", properties: { info: { id: sessionId } } }
}

function makeMessageUpdated(sessionId: string, role: "user" | "assistant", msgId: string) {
  return { type: "message.updated", properties: { sessionID: sessionId, message: { role, id: msgId } } }
}

function makePartUpdated(sessionId: string, messageId: string, text: string) {
  return {
    type: "message.part.updated",
    properties: {
      sessionID: sessionId,
      messageID: messageId,
      part: { type: "text", text, messageID: messageId },
    },
  }
}

function makeSessionIdle(sessionId: string) {
  return { type: "session.idle", properties: { sessionID: sessionId } }
}

function makeSessionDeleted(sessionId: string) {
  return { type: "session.deleted", properties: { sessionID: sessionId } }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("HudPlugin integration", () => {
  let eventHook: (args: { event: unknown }) => Promise<void>

  beforeEach(async () => {
    mockIntervalId = 0
    activeIntervals.clear()
    emittedEvents.length = 0
    mockSetInterval.mockClear()
    mockClearInterval.mockClear()
    mockClient.event.emit.mockClear()

    // Re-import fresh module (clear module cache via dynamic import with cache-bust)
    const { HudPlugin } = await import(`../src/index.js?t=${Date.now()}`)
    const hooks = await HudPlugin({ client: mockClient as never, project: null as never, $: null as never, directory: "", worktree: "" })
    eventHook = hooks.event as typeof eventHook
  })

  test("session.created initializes state; no interval started yet", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    expect(mockSetInterval).not.toHaveBeenCalled()
  })

  test("first message.part.updated starts the interval and sets streamingStartTime", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    await eventHook({ event: makeMessageUpdated("sess-1", "user", "msg-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello") })

    expect(mockSetInterval).toHaveBeenCalledTimes(1)
  })

  test("interval is NOT restarted on subsequent tokens in the same round", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello world") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello world!") })

    expect(mockSetInterval).toHaveBeenCalledTimes(1)
  })

  test("interval fires and emits a tui.toast.show event", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    await eventHook({ event: makeMessageUpdated("sess-1", "user", "msg-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello world!") })

    // Manually fire the interval callback
    const cb = activeIntervals.get(1)!
    await cb()

    expect(emittedEvents.length).toBe(1)
    const emitted = emittedEvents[0] as { type: string; properties: { message: string } }
    expect(emitted.type).toBe("tui.toast.show")
    expect(emitted.properties.message).toContain("t/s")
  })

  test("session.idle stops the interval", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello") })

    expect(mockSetInterval).toHaveBeenCalledTimes(1)
    await eventHook({ event: makeSessionIdle("sess-1") })
    expect(mockClearInterval).toHaveBeenCalledTimes(1)
  })

  test("session.deleted stops interval and removes state", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "Hello") })
    await eventHook({ event: makeSessionDeleted("sess-1") })

    expect(mockClearInterval).toHaveBeenCalledTimes(1)
    // Subsequent events for the deleted session should not crash
    await eventHook({ event: makePartUpdated("sess-1", "msg-3", "Ghost") })
  })

  test("new messageId in part.updated resets round stats (prevents cross-round pollution)", async () => {
    await eventHook({ event: makeSessionCreated("sess-1") })

    // Round 1
    await eventHook({ event: makeMessageUpdated("sess-1", "user", "msg-1") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-2", "A".repeat(500)) })
    await eventHook({ event: makeSessionIdle("sess-1") })

    const firstCallCount = mockSetInterval.mock.calls.length
    expect(firstCallCount).toBe(1)

    // Round 2: new user message, new assistant messageId
    await eventHook({ event: makeMessageUpdated("sess-1", "user", "msg-3") })
    await eventHook({ event: makePartUpdated("sess-1", "msg-4", "B") })

    // Interval should have been started fresh for round 2
    expect(mockSetInterval.mock.calls.length).toBe(2)
  })
})
