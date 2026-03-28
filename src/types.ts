export interface SessionMetrics {
  requestStartTime: number | null
  streamingStartTime: number | null
  completionTime: number | null
  totalTokens: number
  currentMessageId: string | null
}
