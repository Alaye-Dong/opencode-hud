import type { OpencodeClient } from "@opencode-ai/sdk"

const TOAST_DURATION_MS = 5000

export async function showHud(client: OpencodeClient, options: { message: string }): Promise<void> {
  await client.tui.showToast({
    body: {
      message: options.message,
      variant: "info",
      duration: TOAST_DURATION_MS,
    },
  })
}
