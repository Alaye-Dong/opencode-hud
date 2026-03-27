/**
 * OpenCode HUD Plugin — Local plugin entry point.
 *
 * OpenCode auto-loads all TypeScript files in `.opencode/plugins/`.
 * This file contains the full plugin inline (copied from src/) so that
 * OpenCode can load it directly without a build step.
 *
 * To develop, edit src/index.ts and sync changes here.
 * To keep things DRY, you can also publish to npm and reference from opencode.json.
 */

// Re-export from src using Bun's TypeScript-native module resolution.
// Note: tsc cannot resolve this cross-directory path, so .opencode/plugins/ is
// excluded from tsconfig.json. Bun loads it natively at runtime.
export { HudPlugin } from "../../src/index.js"
