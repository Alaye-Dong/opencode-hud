/**
 * HUD display layer for the OpenCode HUD plugin.
 */

import type { OpencodeClient } from "@opencode-ai/sdk"
import type { HudStats } from "./types.js"

export const TOAST_DURATION_MS = 400

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

export function formatHud(stats: HudStats): string {
  const tps = `⚡ ${fmt1(stats.currentTps)} t/s`
  const avg = `avg ${fmt1(stats.avgTps)} t/s`
  const ttft = stats.ttft !== null ? `TTFT ${fmtMs(stats.ttft)}` : "TTFT --"
  const summary = `[${fmtTokens(stats.totalTokens)} tok / ${fmt1(stats.elapsedSec)}s]`

  return [tps, avg, ttft, summary].join("  ")
}

export async function showHud(
  client: OpencodeClient,
  stats: HudStats,
): Promise<void> {
  const message = formatHud(stats)

  const result = await client.tui.showToast({
    body: {
      message,
      variant: "info",
      duration: TOAST_DURATION_MS,
    },
  })

  if (result.error) {
    console.error("[HUD] Failed to show toast:", result.error)
  }
}
