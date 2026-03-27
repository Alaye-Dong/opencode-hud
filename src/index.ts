/**
 * OpenCode HUD Plugin — Main Entry Point
 *
 * Registers event hooks to track streaming metrics (TPS, avg TPS, TTFT) and
 * renders them as a persistent Toast HUD via a setInterval-driven display loop.
 *
 * Architecture decisions:
 *  - Display is driven by setInterval (not events) so the Toast survives tool calls.
 *  - streamingStartTime is set lazily on the first token to exclude think-time.
 *  - messageID changes detect new conversation rounds and reset per-round stats.
 *  - session.idle resets (but keeps) the Map entry to prevent race conditions.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { buildHudStats, createFreshMetrics, extractTextLength } from "./metrics.js"
import { showHud } from "./display.js"
import type { SessionMetrics } from "./types.js"

/** How often (ms) the HUD refreshes while streaming. */
const INTERVAL_MS = 200

export const HudPlugin: Plugin = async ({ client }) => {
  /** Map of sessionId → per-session metrics state. */
  const sessions = new Map<string, SessionMetrics>()

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getOrCreate(sessionId: string): SessionMetrics {
    let m = sessions.get(sessionId)
    if (!m) {
      m = createFreshMetrics()
      sessions.set(sessionId, m)
    }
    return m
  }

  function stopInterval(metrics: SessionMetrics): void {
    if (metrics.intervalId !== null) {
      clearInterval(metrics.intervalId)
      metrics.intervalId = null
    }
  }

  function startInterval(metrics: SessionMetrics, sessionId: string): void {
    if (metrics.intervalId !== null) return // already running

    metrics.intervalId = setInterval(async () => {
      const now = Date.now()
      const stats = buildHudStats(metrics, now)

      // Update snapshot for next delta calculation
      metrics.lastTokenSnapshot = metrics.totalTokens
      metrics.lastSnapshotTime = now

      await showHud(client as unknown as Parameters<typeof showHud>[0], sessionId, stats)
    }, INTERVAL_MS)
  }

  function resetRoundStats(metrics: SessionMetrics): void {
    stopInterval(metrics)
    metrics.streamingStartTime = null
    metrics.ttft = null
    metrics.totalTokens = 0
    metrics.lastTokenSnapshot = 0
    metrics.lastSnapshotTime = null
    metrics.currentMessageId = null
    // preserve promptSentAt — it was just set for the new round
  }

  // ── Event Handler ──────────────────────────────────────────────────────────

  return {
    event: async ({ event }) => {
      // OpenCode SDK types event as opaque; use a local Props cast for safe access.
      type Props = {
        info?: { id?: string }
        sessionID?: string
        messageID?: string
        message?: { role?: string; id?: string }
        part?: unknown
      }
      type OcEvent = { type: string; properties?: Props }
      const ev = event as OcEvent
      const props: Props = ev.properties ?? {}

      switch (ev.type) {
        // ── New session created ──────────────────────────────────────────────
        case "session.created": {
          const sessionId = props.info?.id ?? props.sessionID
          if (!sessionId) break
          sessions.set(sessionId, createFreshMetrics())
          break
        }

        // ── User sends a message → record promptSentAt for TTFT ─────────────
        case "message.updated": {
          const sessionId = props.sessionID
          const message = props.message
          // Only capture the user's outgoing message (role = "user")
          if (!sessionId || !message || message.role !== "user") break

          const metrics = getOrCreate(sessionId)
          metrics.promptSentAt = Date.now()
          break
        }

        // ── Streaming token arrives ──────────────────────────────────────────
        case "message.part.updated": {
          const sessionId = props.sessionID
          const part = props.part
          if (!sessionId || !part) break

          const charCount = extractTextLength(part)
          if (charCount === 0) break // not a text part; ignore

          const metrics = getOrCreate(sessionId)

          // Resolve messageId from top-level or nested inside part
          const partMsgId =
            part !== null && typeof part === "object" && "messageID" in part
              ? String((part as { messageID: unknown }).messageID)
              : undefined
          const incomingMsgId = props.messageID ?? partMsgId

          // ── Detect new conversation round ──────────────────────────────────
          if (incomingMsgId && incomingMsgId !== metrics.currentMessageId) {
            resetRoundStats(metrics)
            metrics.currentMessageId = incomingMsgId
          }

          // ── Accumulate tokens ──────────────────────────────────────────────
          metrics.totalTokens = charCount // part.text is cumulative (full text so far)

          // ── First token: start timing + interval ───────────────────────────
          if (metrics.streamingStartTime === null) {
            const now = Date.now()
            metrics.streamingStartTime = now
            metrics.lastSnapshotTime = now

            if (metrics.promptSentAt !== null) {
              const { calcTtft } = await import("./metrics.js")
              metrics.ttft = calcTtft(metrics.promptSentAt, now)
            }

            startInterval(metrics, sessionId)
          }
          break
        }

        // ── AI finished responding (idle) → stop interval, preserve state ───
        case "session.idle": {
          const sessionId = props.sessionID
          if (!sessionId) break

          const metrics = sessions.get(sessionId)
          if (!metrics) break

          stopInterval(metrics)
          // Keep the Map entry intact to avoid race with a next-round event
          // that might arrive just before or just after idle.
          break
        }

        // ── Session destroyed → full cleanup ─────────────────────────────────
        case "session.deleted": {
          const sessionId = props.sessionID ?? props.info?.id
          if (!sessionId) break

          const metrics = sessions.get(sessionId)
          if (metrics) stopInterval(metrics)
          sessions.delete(sessionId)
          break
        }
      }
    },
  }
}
