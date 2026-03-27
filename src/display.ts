/**
 * HUD display layer for the OpenCode HUD plugin.
 *
 * Responsible for formatting `HudStats` into a human-readable string
 * and rendering it as an OpenCode toast notification.
 */

import type { HudStats } from "./types.js"

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * How long (in ms) each toast remains visible on screen.
 * Set to 2× the interval so that the next tick always refreshes it before it
 * fades — effectively keeping it permanently visible while streaming.
 */
export const TOAST_DURATION_MS = 400

// ── Formatting Helpers ────────────────────────────────────────────────────────

function fmt1(n: number): string {
  return n.toFixed(1)
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * Format a `HudStats` snapshot into a single-line HUD string.
 *
 * Example output:
 *   ⚡ 45.2 t/s  avg 38.1 t/s  TTFT 312ms  [1.2k tok / 27.5s]
 *
 * During warm-up (before the first token), a brief placeholder is shown.
 */
export function formatHud(stats: HudStats): string {
  const tps = `⚡ ${fmt1(stats.currentTps)} t/s`
  const avg = `avg ${fmt1(stats.avgTps)} t/s`
  const ttft = stats.ttft !== null ? `TTFT ${fmtMs(stats.ttft)}` : "TTFT --"
  const summary = `[${fmtTokens(stats.totalTokens)} tok / ${fmt1(stats.elapsedSec)}s]`

  return [tps, avg, ttft, summary].join("  ")
}

/**
 * Render the HUD by emitting a `tui.toast.show` event via the OpenCode client.
 *
 * @param client     The opencode SDK client from the plugin context
 * @param sessionId  The current session ID
 * @param stats      Computed HUD stats to display
 */
export async function showHud(
  client: { event: { emit: (params: unknown) => Promise<unknown> } },
  sessionId: string,
  stats: HudStats,
): Promise<void> {
  const message = formatHud(stats)

  await client.event.emit({
    type: "tui.toast.show",
    properties: {
      sessionID: sessionId,
      message,
      duration: TOAST_DURATION_MS,
    },
  })
}
