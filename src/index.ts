/**
 * OpenCode HUD Plugin — Main Entry Point
 */

import type { Plugin } from "@opencode-ai/plugin"
import type { Event, Session, Part, TextPart } from "@opencode-ai/sdk"
import { buildHudStats, createFreshMetrics, calcTtft } from "./metrics.js"
import { showHud } from "./display.js"
import type { SessionMetrics } from "./types.js"

const INTERVAL_MS = 200

export const HudPlugin: Plugin = async ({ client }) => {
  const sessions = new Map<string, SessionMetrics>()
  const messageRoles = new Map<string, "user" | "assistant">()

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

  function startInterval(metrics: SessionMetrics): void {
    if (metrics.intervalId !== null) return

    metrics.intervalId = setInterval(async () => {
      const now = Date.now()
      const stats = buildHudStats(metrics, now)

      metrics.lastTokenSnapshot = metrics.totalTokens
      metrics.lastSnapshotTime = now

      await showHud(client, stats)
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
  }

  function isTextPart(part: Part): part is TextPart {
    return part.type === "text" && "text" in part
  }

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created": {
          const session = event.properties.info as Session
          sessions.set(session.id, createFreshMetrics())
          break
        }

        case "message.updated": {
          const msg = event.properties.info
          messageRoles.set(msg.id, msg.role)

          if (msg.role === "user") {
            const metrics = getOrCreate(msg.sessionID)
            metrics.promptSentAt = Date.now()
          }
          break
        }

        case "message.part.updated": {
          const part = event.properties.part
          if (!isTextPart(part)) break

          const sessionId = part.sessionID
          const messageId = part.messageID

          // Only track assistant message tokens (output speed)
          const msgRole = messageRoles.get(messageId)
          if (msgRole !== "assistant") break

          const metrics = getOrCreate(sessionId)

          if (messageId && messageId !== metrics.currentMessageId) {
            resetRoundStats(metrics)
            metrics.currentMessageId = messageId
          }

          metrics.totalTokens = part.text.length

          if (metrics.streamingStartTime === null) {
            const now = Date.now()
            metrics.streamingStartTime = now
            metrics.lastSnapshotTime = now

            if (metrics.promptSentAt !== null) {
              metrics.ttft = calcTtft(metrics.promptSentAt, now)
            }

            startInterval(metrics)
          }
          break
        }

        case "session.idle": {
          const sessionId = event.properties.sessionID
          const metrics = sessions.get(sessionId)
          if (metrics) stopInterval(metrics)
          break
        }

        case "message.removed": {
          const msg = event.properties
          messageRoles.delete(msg.messageID)
          break
        }

        case "session.deleted": {
          const session = event.properties.info as Session
          const metrics = sessions.get(session.id)
          if (metrics) stopInterval(metrics)
          sessions.delete(session.id)
          break
        }
      }
    },
  }
}
