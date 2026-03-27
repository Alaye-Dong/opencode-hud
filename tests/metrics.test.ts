/**
 * Unit tests for the metrics calculation engine.
 * All functions under test are pure — no mocking required.
 */

import { describe, expect, test } from "bun:test"
import {
  calcCurrentTps,
  calcAvgTps,
  calcTtft,
  extractTextLength,
  buildHudStats,
  createFreshMetrics,
} from "../src/metrics.js"

// ── calcCurrentTps ─────────────────────────────────────────────────────────

describe("calcCurrentTps", () => {
  test("basic calculation: 100 tokens in 1000ms = 100 t/s", () => {
    expect(calcCurrentTps(100, 1000)).toBeCloseTo(100)
  })

  test("returns 0 when delta is below MIN_ELAPSED_MS (100ms)", () => {
    expect(calcCurrentTps(50, 50)).toBe(0)
  })

  test("returns 0 when deltaTokens is 0", () => {
    expect(calcCurrentTps(0, 500)).toBe(0)
  })

  test("returns 0 when deltaTokens is negative", () => {
    expect(calcCurrentTps(-5, 500)).toBe(0)
  })

  test("50 tokens in 2000ms = 25 t/s", () => {
    expect(calcCurrentTps(50, 2000)).toBeCloseTo(25)
  })
})

// ── calcAvgTps ─────────────────────────────────────────────────────────────

describe("calcAvgTps", () => {
  test("500 tokens over 10 seconds = 50 t/s", () => {
    expect(calcAvgTps(500, 10_000)).toBeCloseTo(50)
  })

  test("returns 0 when elapsed time is below MIN_ELAPSED_MS", () => {
    expect(calcAvgTps(100, 50)).toBe(0)
  })

  test("returns 0 when totalTokens is 0", () => {
    expect(calcAvgTps(0, 5000)).toBe(0)
  })
})

// ── calcTtft ──────────────────────────────────────────────────────────────

describe("calcTtft", () => {
  test("calculates correct TTFT", () => {
    expect(calcTtft(1000, 1312)).toBe(312)
  })

  test("clamps negative TTFT to 0", () => {
    expect(calcTtft(2000, 1800)).toBe(0)
  })

  test("TTFT of 0 when same timestamp", () => {
    expect(calcTtft(5000, 5000)).toBe(0)
  })
})

// ── extractTextLength ─────────────────────────────────────────────────────

describe("extractTextLength", () => {
  test("returns length for a valid text part", () => {
    expect(extractTextLength({ type: "text", text: "Hello World" })).toBe(11)
  })

  test("returns 0 for non-text part types", () => {
    expect(extractTextLength({ type: "tool-call", text: "ignored" })).toBe(0)
  })

  test("returns 0 for null", () => {
    expect(extractTextLength(null)).toBe(0)
  })

  test("returns 0 for object without text field", () => {
    expect(extractTextLength({ type: "text" })).toBe(0)
  })

  test("returns 0 for empty text", () => {
    expect(extractTextLength({ type: "text", text: "" })).toBe(0)
  })
})

// ── createFreshMetrics ────────────────────────────────────────────────────

describe("createFreshMetrics", () => {
  test("returns zeroed metrics", () => {
    const m = createFreshMetrics()
    expect(m.totalTokens).toBe(0)
    expect(m.streamingStartTime).toBeNull()
    expect(m.promptSentAt).toBeNull()
    expect(m.ttft).toBeNull()
    expect(m.intervalId).toBeNull()
    expect(m.currentMessageId).toBeNull()
  })
})

// ── buildHudStats ─────────────────────────────────────────────────────────

describe("buildHudStats", () => {
  test("computes correct stats from active session metrics", () => {
    const base = 1000
    const metrics = createFreshMetrics()
    metrics.streamingStartTime = base
    metrics.lastSnapshotTime = base + 1000 // 1 second ago
    metrics.lastTokenSnapshot = 100
    metrics.totalTokens = 150 // 50 new tokens in 1s
    metrics.ttft = 280

    const now = base + 2000 // 2 seconds total elapsed
    const stats = buildHudStats(metrics, now)

    expect(stats.elapsedSec).toBeCloseTo(2)
    expect(stats.totalTokens).toBe(150)
    expect(stats.ttft).toBe(280)
    expect(stats.currentTps).toBeCloseTo(50) // 50 tk / 1000ms
    expect(stats.avgTps).toBeCloseTo(75)    // 150 tk / 2000ms
  })

  test("returns zeros for a session that hasn't started streaming", () => {
    const metrics = createFreshMetrics()
    const stats = buildHudStats(metrics, Date.now())
    expect(stats.currentTps).toBe(0)
    expect(stats.avgTps).toBe(0)
    expect(stats.elapsedSec).toBe(0)
    expect(stats.ttft).toBeNull()
  })
})
