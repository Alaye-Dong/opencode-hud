import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

export interface HudConfig {
  enableLogging: boolean
  logFilePath?: string
}

const CONFIG_FILE_NAME = "opencode-hud.json"

const DEFAULT_CONFIG: HudConfig = {
  enableLogging: false,
  logFilePath: ".opencode/hud-debug.log",
}

let currentConfig: HudConfig = { ...DEFAULT_CONFIG }

function getConfigPaths(): string[] {
  return [
    join(homedir(), ".config", "opencode", CONFIG_FILE_NAME),
    join(process.cwd(), ".opencode", CONFIG_FILE_NAME),
  ]
}

export function loadConfigFromFile(): void {
  for (const configPath of getConfigPaths()) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8")
        const parsed = JSON.parse(content) as Partial<HudConfig>
        currentConfig = { ...DEFAULT_CONFIG, ...parsed }
        return
      } catch {}
    }
  }
}

export function getConfig(): HudConfig {
  return currentConfig
}

export function setConfig(config: Partial<HudConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG }
}
