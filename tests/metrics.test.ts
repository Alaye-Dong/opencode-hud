import { describe, expect, test } from "bun:test"
import { formatDuration, createFreshMetrics, now, estimateTokens } from "../src/metrics.js"

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

describe("estimateTokens", () => {
  test("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0)
  })

  test("estimates tokens from text length", () => {
    expect(estimateTokens("hello")).toBe(2)
    expect(estimateTokens("hello world")).toBe(4)
    expect(estimateTokens("a".repeat(300))).toBe(100)
  })
})
