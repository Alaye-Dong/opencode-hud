/**
 * Metrics calculation engine for the OpenCode HUD plugin.
 *
 * All functions are pure (no side effects) to make them easy to unit test.
 * They accept/return primitive values only — no dependency on the OpenCode SDK.
 */

import type { HudStats, SessionMetrics } from "./types.js"

// ── Constants ──────────────────────────────────────────────────────────────────

/** Minimum elapsed time (ms) before we report a meaningful TPS figure. */
const MIN_ELAPSED_MS = 100

// ── Pure Calculation Functions ────────────────────────────────────────────────

/**
 * Calculate instantaneous TPS from the number of new tokens and the time delta.
 *
 * @param deltaTokens  Tokens received since the last snapshot
 * @param deltaMs      Milliseconds elapsed since the last snapshot
 * @returns Tokens per second, clamped to 0
 */
export function calcCurrentTps(deltaTokens: number, deltaMs: number): number {
  if (deltaMs < MIN_ELAPSED_MS || deltaTokens <= 0) return 0
  return (deltaTokens / deltaMs) * 1000
}

/**
 * Calculate average TPS over the entire streaming window.
 *
 * @param totalTokens         Total tokens received so far
 * @param streamingElapsedMs  Milliseconds since the first token arrived
 * @returns Average tokens per second, clamped to 0
 */
export function calcAvgTps(totalTokens: number, streamingElapsedMs: number): number {
  if (streamingElapsedMs < MIN_ELAPSED_MS || totalTokens <= 0) return 0
  return (totalTokens / streamingElapsedMs) * 1000
}

/**
 * Calculate Time To First Token (TTFT).
 *
 * @param promptSentAt   Timestamp (ms) when the user sent their message
 * @param firstTokenAt   Timestamp (ms) when the first token was received
 * @returns TTFT in milliseconds, clamped to 0
 */
export function calcTtft(promptSentAt: number, firstTokenAt: number): number {
  return Math.max(0, firstTokenAt - promptSentAt)
}

/**
 * Extract the character-length of the text content from a message part event's
 * `part` property. OpenCode streams text as incremental text parts; we use
 * character count as a proxy for token count (roughly 1 char ≈ 0.25–0.5 tokens
 * but consistent across the session, which is sufficient for relative TPS).
 *
 * @param part  The `part` object from a `message.part.updated` event
 * @returns     Character length, or 0 if not a text part
 */
export function extractTextLength(part: unknown): number {
  if (
    part !== null &&
    typeof part === "object" &&
    "type" in part &&
    (part as { type: string }).type === "text" &&
    "text" in part &&
    typeof (part as { text: unknown }).text === "string"
  ) {
    return (part as { text: string }).text.length
  }
  return 0
}

// ── Snapshot Builder ───────────────────────────────────────────────────────────

/**
 * Given the current session metrics and the current wall-clock time,
 * compute a fully resolved `HudStats` object ready for the display layer.
 *
 * @param metrics  Current session metrics state
 * @param now      Current timestamp in milliseconds (Date.now())
 * @returns        Computed HUD stats
 */
export function buildHudStats(metrics: SessionMetrics, now: number): HudStats {
  const streamingElapsedMs =
    metrics.streamingStartTime !== null ? now - metrics.streamingStartTime : 0

  const deltaTokens = metrics.totalTokens - metrics.lastTokenSnapshot
  const deltaMs =
    metrics.lastSnapshotTime !== null ? now - metrics.lastSnapshotTime : 0

  return {
    currentTps: calcCurrentTps(deltaTokens, deltaMs),
    avgTps: calcAvgTps(metrics.totalTokens, streamingElapsedMs),
    ttft: metrics.ttft,
    totalTokens: metrics.totalTokens,
    elapsedSec: streamingElapsedMs / 1000,
  }
}

/**
 * Create a fresh, zeroed-out `SessionMetrics` object for a new session/round.
 */
export function createFreshMetrics(): SessionMetrics {
  return {
    promptSentAt: null,
    streamingStartTime: null,
    ttft: null,
    totalTokens: 0,
    lastTokenSnapshot: 0,
    lastSnapshotTime: null,
    currentMessageId: null,
    intervalId: null,
  }
}
