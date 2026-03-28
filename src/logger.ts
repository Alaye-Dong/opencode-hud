import { appendFileSync, mkdirSync, existsSync } from "fs"
import { dirname } from "path"
import { getConfig } from "./config.js"

export function log(msg: string): void {
  const config = getConfig()
  if (!config.enableLogging) return

  const logFile = config.logFilePath
  if (!logFile) return

  const timestamp = new Date().toISOString().slice(11, 23)
  try {
    if (!existsSync(logFile)) {
      mkdirSync(dirname(logFile), { recursive: true })
    }
    appendFileSync(logFile, `[${timestamp}] ${msg}\n`)
  } catch {}
}
