import type { Plugin } from "@opencode-ai/plugin"
import type { Session, Part, TextPart, Message, AssistantMessage } from "@opencode-ai/sdk"
import { showHud } from "./display.js"
import type { SessionMetrics } from "./types.js"
import { createFreshMetrics, formatDuration, now, estimateTokens } from "./metrics.js"
import { log } from "./logger.js"
import { loadConfigFromFile } from "./config.js"

export const hud: Plugin = async ({ client }) => {
  loadConfigFromFile()
  const sessions = new Map<string, SessionMetrics>()
  const messageRoles = new Map<string, "user" | "assistant">()
  const assistantMessages = new Map<string, AssistantMessage>()

  function isTextPart(part: Part): part is TextPart {
    return part.type === "text" && "text" in part
  }

  function getOrCreate(sessionId: string): SessionMetrics {
    let m = sessions.get(sessionId)
    if (!m) {
      m = createFreshMetrics()
      sessions.set(sessionId, m)
    }
    return m
  }

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created": {
          const session = event.properties.info as Session
          log(`session.created: id=${session.id}`)
          sessions.set(session.id, createFreshMetrics())
          break
        }

        case "message.updated": {
          const msg = event.properties.info as Message
          log(`message.updated: id=${msg.id} role=${msg.role} sessionID=${msg.sessionID}`)
          messageRoles.set(msg.id, msg.role)

          if (msg.role === "user") {
            const metrics = getOrCreate(msg.sessionID)
            metrics.requestStartTime = now()
          } else if (msg.role === "assistant") {
            const assistantMsg = msg as AssistantMessage
            assistantMessages.set(msg.id, assistantMsg)
            log(`  assistant tokens: output=${assistantMsg.tokens?.output} reasoning=${assistantMsg.tokens?.reasoning}`)
          }
          break
        }

        case "message.part.updated": {
          const part = event.properties.part
          if (!isTextPart(part)) break

          const sessionId = part.sessionID
          const messageId = part.messageID
          log(`message.part.updated: sessionId=${sessionId} messageId=${messageId} msgRole=${messageRoles.get(messageId)}`)

          if (messageRoles.get(messageId) !== "assistant") {
            log(`  SKIP: not assistant`)
            break
          }

          const metrics = getOrCreate(sessionId)
          log(`  metrics: totalTokens=${metrics.totalTokens} streamingStartTime=${metrics.streamingStartTime}`)

          if (messageId !== metrics.currentMessageId) {
            metrics.streamingStartTime = null
            metrics.totalTokens = 0
            metrics.currentMessageId = messageId
          }

          const assistantMsg = assistantMessages.get(messageId)
          if (assistantMsg?.tokens?.output !== undefined && assistantMsg.tokens.output > 0) {
            const output = assistantMsg.tokens.output
            const reasoning = assistantMsg.tokens.reasoning ?? 0
            metrics.totalTokens = output + reasoning
            log(`  using API tokens: output=${output} reasoning=${reasoning} total=${metrics.totalTokens}`)
          } else {
            metrics.totalTokens = estimateTokens(part.text)
            log(`  using estimated tokens: ${metrics.totalTokens}`)
          }

          if (metrics.streamingStartTime === null) {
            metrics.streamingStartTime = now()
          }
          break
        }

        case "session.idle": {
          const sessionId = event.properties.sessionID
          log(`session.idle: sessionId=${sessionId}`)

          const metrics = sessions.get(sessionId)
          log(`  metrics: ${JSON.stringify(metrics)}`)

          if (!metrics) {
            log(`  SKIP: no metrics`)
            break
          }
          if (metrics.streamingStartTime === null) {
            log(`  SKIP: streamingStartTime is null`)
            break
          }

          const assistantMsg = metrics.currentMessageId
            ? assistantMessages.get(metrics.currentMessageId)
            : undefined

          if (assistantMsg?.tokens?.output !== undefined) {
            const output = assistantMsg.tokens.output
            const reasoning = assistantMsg.tokens.reasoning ?? 0
            metrics.totalTokens = output + reasoning
            log(`  final tokens from API: output=${output} reasoning=${reasoning} total=${metrics.totalTokens}`)
          }

          if (metrics.totalTokens === 0) {
            log(`  SKIP: totalTokens is 0`)
            break
          }

          metrics.completionTime = now()

          const ttft = metrics.requestStartTime !== null && metrics.streamingStartTime !== null
            ? metrics.streamingStartTime - metrics.requestStartTime
            : null
          const elapsedMs = metrics.completionTime - metrics.streamingStartTime!
          const elapsedSec = elapsedMs / 1000
          const avgTps = elapsedSec > 0 ? (metrics.totalTokens / elapsedSec) : 0

          const message = `⚡ ${avgTps.toFixed(1)} t/s  TTFT ${ttft !== null ? formatDuration(ttft) : "--"}  [${metrics.totalTokens} tok / ${elapsedSec.toFixed(1)}s]`
          log(`  SHOWING: ${message}`)

          await showHud(client, { message })
          break
        }

        case "message.removed": {
          messageRoles.delete(event.properties.messageID)
          assistantMessages.delete(event.properties.messageID)
          break
        }

        case "session.deleted": {
          sessions.delete((event.properties.info as Session).id)
          break
        }
      }
    },
  }
}

// Named "server" export is required by OpenCode's PluginModule type.
// When loaded as an NPM package, opencode reads the `server` property of the module.
export { hud as server }
export default hud
