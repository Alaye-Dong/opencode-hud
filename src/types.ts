/**
 * Shared TypeScript interfaces for the OpenCode HUD plugin.
 */

/**
 * Per-session metrics state. One instance is stored per active OpenCode session.
 */
export interface SessionMetrics {
  // ── Timing ──────────────────────────────────────────────────────────────
  /** Timestamp (ms) when the user sent their message. Used for TTFT. */
  promptSentAt: number | null;

  /**
   * Timestamp (ms) of the very first token in the current streaming round.
   * Set lazily on first token — NOT at session.created — to exclude LLM think time.
   */
  streamingStartTime: number | null;

  /** Computed TTFT in milliseconds. Null until the first token arrives. */
  ttft: number | null;

  // ── Token Counts ─────────────────────────────────────────────────────────
  /** Cumulative token count for the current streaming round. */
  totalTokens: number;

  /** Token count captured at the previous interval tick. Used for Δ TPS. */
  lastTokenSnapshot: number;

  /** Wall-clock time (ms) of the previous interval tick. */
  lastSnapshotTime: number | null;

  // ── Session/Message Identity ──────────────────────────────────────────────
  /**
   * The message ID of the currently streaming assistant message.
   * When this changes, a new conversation round has started → reset stats.
   */
  currentMessageId: string | null;

  /** Handle returned by setInterval. Null when not streaming. */
  intervalId: ReturnType<typeof setInterval> | null;
}

/**
 * Calculated HUD stats ready for display. All values are already formatted
 * for human consumption by the metrics engine.
 */
export interface HudStats {
  /** Current instantaneous TPS (tokens per second). */
  currentTps: number;

  /** Average TPS since streaming began. */
  avgTps: number;

  /** Time to First Token in milliseconds. Null if not yet known. */
  ttft: number | null;

  /** Total tokens received in this streaming round. */
  totalTokens: number;

  /** Seconds elapsed since streaming started. */
  elapsedSec: number;
}
