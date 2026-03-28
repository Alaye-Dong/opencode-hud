export interface SessionMetrics {
  promptSentAt: number | null
  streamingStartTime: number | null
  totalTokens: number
  currentMessageId: string | null
}
