import { describe, expect, test } from "bun:test"
import { formatDuration, createFreshMetrics, now } from "../src/metrics.js"

describe("formatDuration", () => {
  test("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms")
  })

  test("formats seconds", () => {
    expect(formatDuration(1234)).toBe("1.23s")
  })
})

describe("createFreshMetrics", () => {
  test("creates fresh metrics with null values", () => {
    const metrics = createFreshMetrics()
    expect(metrics.requestStartTime).toBeNull()
    expect(metrics.streamingStartTime).toBeNull()
    expect(metrics.completionTime).toBeNull()
    expect(metrics.totalTokens).toBe(0)
    expect(metrics.currentMessageId).toBeNull()
  })
})

describe("now", () => {
  test("returns a number from performance.now()", () => {
    const t = now()
    expect(typeof t).toBe("number")
    expect(t).toBeGreaterThan(0)
  })
})
