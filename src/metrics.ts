export function now(): number {
  return performance.now()
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function createFreshMetrics() {
  return {
    requestStartTime: null as number | null,
    streamingStartTime: null as number | null,
    completionTime: null as number | null,
    totalTokens: 0,
    currentMessageId: null as string | null,
  }
}
