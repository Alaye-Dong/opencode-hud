import { describe, expect, test, mock, beforeEach } from "bun:test"

const mockClient = {
  tui: {
    showToast: mock(async () => ({ data: true, error: null })),
  },
}

function makeEvent(type: string, properties: Record<string, unknown>) {
  return { type, properties }
}

describe("hud", () => {
  let eventHook: (args: { event: unknown }) => Promise<void>

  beforeEach(async () => {
    mockClient.tui.showToast.mockClear()

    const { hud } = await import(`../src/index.js?t=${Date.now()}`)
    const hooks = await hud({ client: mockClient as never, project: null as never, $: null as never, directory: "", worktree: "" })
    eventHook = hooks.event as typeof eventHook
  })

  test("shows summary on session.idle after assistant message", async () => {
    await eventHook({ event: makeEvent("session.created", { info: { id: "sess-1" } }) })
    await eventHook({ event: makeEvent("message.updated", { info: { id: "msg-1", sessionID: "sess-1", role: "user" } }) })
    await eventHook({ event: makeEvent("message.updated", { info: { id: "msg-2", sessionID: "sess-1", role: "assistant" } }) })
    await eventHook({ event: makeEvent("message.part.updated", { part: { type: "text", text: "Hello world!", sessionID: "sess-1", messageID: "msg-2", id: "part-1" } }) })
    await eventHook({ event: makeEvent("session.idle", { sessionID: "sess-1" }) })

    expect(mockClient.tui.showToast).toHaveBeenCalledTimes(1)
    const calls = mockClient.tui.showToast.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const firstCall = calls[0] as unknown as [{ body: { message: string } }]
    expect(firstCall[0].body.message).toContain("t/s")
    expect(firstCall[0].body.message).toContain("TTFT")
  })

  test("does not show summary for user message parts", async () => {
    await eventHook({ event: makeEvent("session.created", { info: { id: "sess-1" } }) })
    await eventHook({ event: makeEvent("message.updated", { info: { id: "msg-1", sessionID: "sess-1", role: "user" } }) })
    await eventHook({ event: makeEvent("message.part.updated", { part: { type: "text", text: "Hello", sessionID: "sess-1", messageID: "msg-1", id: "part-1" } }) })
    await eventHook({ event: makeEvent("session.idle", { sessionID: "sess-1" }) })

    expect(mockClient.tui.showToast).not.toHaveBeenCalled()
  })

  test("does not crash for deleted session", async () => {
    await eventHook({ event: makeEvent("session.created", { info: { id: "sess-1" } }) })
    await eventHook({ event: makeEvent("session.deleted", { info: { id: "sess-1" } }) })
    await eventHook({ event: makeEvent("message.part.updated", { part: { type: "text", text: "Ghost", sessionID: "sess-1", messageID: "msg-1", id: "part-1" } }) })
  })
})
