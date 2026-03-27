# AGENTS.md — OpenCode HUD Plugin

Coding agent guidelines for this repository.

---

## Build / Test / Lint Commands

```bash
# Install dependencies (Bun required)
bun install

# Run all tests
bun test

# Run a single test file
bun test tests/metrics.test.ts
bun test tests/integration.test.ts

# Run tests matching a pattern
bun test -t "calcCurrentTps"

# Type-check (no emit)
bun run typecheck

# Build (tsc, outputs to ./dist)
bun run build
```

---

## Project Overview

OpenCode plugin that displays a real-time HUD overlay showing streaming metrics:
- Current TPS (tokens per second)
- Average TPS
- TTFT (Time To First Token)
- Total tokens / elapsed time

**Tech Stack**: TypeScript, Bun runtime, OpenCode Plugin SDK

**Key Architecture**:
- `setInterval`-driven display loop (survives tool-call pauses)
- Per-session state stored in a `Map<sessionId, SessionMetrics>`
- Lazy `streamingStartTime` (set on first token, not session creation)
- Message ID changes detect new conversation rounds → stats reset

---

## Code Style Guidelines

### Imports

```typescript
// Type-only imports first
import type { Plugin } from "@opencode-ai/plugin"
import type { SessionMetrics } from "./types.js"

// Value imports second
import { buildHudStats, createFreshMetrics } from "./metrics.js"
import { showHud } from "./display.js"
```

- **Always use `.js` extension** in import paths (TypeScript/ES modules requirement)
- **Separate type imports** using `import type { ... }`
- Group imports: external packages → local modules

### File Structure

```typescript
/**
 * File header comment explaining the module's purpose.
 * Include key architecture decisions when relevant.
 */

import type { ... } from "./types.js"
import { ... } from "./module.js"

// ── Constants ──────────────────────────────────────────────────────────

const SOME_CONSTANT = 100

// ── Section Name ───────────────────────────────────────────────────────

function someFunction() { ... }
```

- **File header comment** at top (JSDoc-style block)
- **Section separators** using `// ── Section Name ─────────...` pattern
- Sections: Constants, Pure Functions, Helpers, Event Handlers, etc.

### TypeScript

- **Strict mode enabled** — no `any`, no `@ts-ignore`, no `as any`
- **Prefer type narrowing** over type assertions
- **Nullish values**: Use `| null` for optional state, initialize as `null`
- **Return types**: Optional for small functions, required for public APIs

```typescript
// Good: explicit interface, null for optional state
export interface SessionMetrics {
  streamingStartTime: number | null
  totalTokens: number
  intervalId: ReturnType<typeof setInterval> | null
}

// Good: type narrowing for unknown input
export function extractTextLength(part: unknown): number {
  if (
    part !== null &&
    typeof part === "object" &&
    "type" in part &&
    (part as { type: string }).type === "text"
  ) {
    return (part as { text: string }).text.length
  }
  return 0
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase | `SessionMetrics`, `HudStats` |
| Functions | camelCase | `calcCurrentTps`, `buildHudStats` |
| Constants (module-level) | SCREAMING_SNAKE_CASE | `MIN_ELAPSED_MS`, `INTERVAL_MS` |
| Constants (local) | camelCase | `const base = 1000` |
| Private helpers | camelCase | `function getOrCreate(...)` |

### Functions

- **Prefer pure functions** — no side effects, easy to test
- **Single responsibility** — one job per function
- **Early returns** — guard clauses at the top

```typescript
// Good: pure function with early returns
export function calcCurrentTps(deltaTokens: number, deltaMs: number): number {
  if (deltaMs < MIN_ELAPSED_MS || deltaTokens <= 0) return 0
  return (deltaTokens / deltaMs) * 1000
}
```

### Error Handling

- **No empty catch blocks** — always handle or re-throw
- **Defensive programming** for external inputs (events, API responses)
- **Graceful degradation** — return safe defaults rather than crash

```typescript
// Good: defensive, returns safe default
function getOrCreate(sessionId: string): SessionMetrics {
  let m = sessions.get(sessionId)
  if (!m) {
    m = createFreshMetrics()
    sessions.set(sessionId, m)
  }
  return m
}
```

### Comments

- **Why, not what** — explain decisions, not syntax
- **JSDoc for public APIs** — params, returns, purpose
- **Section headers** for visual organization

---

## Testing

- **Framework**: Bun test (`bun:test`)
- **Location**: `tests/` directory mirrors `src/` structure
- **Pattern**: `describe` blocks for related tests, `test` for individual cases

```typescript
import { describe, expect, test, mock, beforeEach } from "bun:test"

describe("calcCurrentTps", () => {
  test("returns 0 when delta is below MIN_ELAPSED_MS", () => {
    expect(calcCurrentTps(50, 50)).toBe(0)
  })

  test("basic calculation", () => {
    expect(calcCurrentTps(100, 1000)).toBeCloseTo(100)
  })
})
```

**Testing Guidelines**:
- Pure functions → no mocking needed
- Integration tests → mock timers and external APIs
- Use `beforeEach` for test setup
- Clear mocks between tests: `mockFn.mockClear()`

---

## Project Structure

```
opencode-hud/
├── .opencode/
│   ├── opencode.json          # OpenCode project config
│   └── plugins/
│       └── hud.ts             # Plugin entry (auto-loaded)
├── src/
│   ├── types.ts               # TypeScript interfaces
│   ├── metrics.ts             # Pure calculation functions
│   ├── display.ts             # Toast formatting/emission
│   └── index.ts               # Plugin main entry
├── tests/
│   ├── metrics.test.ts        # Unit tests
│   └── integration.test.ts    # Event flow tests
├── package.json
└── tsconfig.json
```

**Module Responsibilities**:
- `types.ts` — Shared interfaces only, no logic
- `metrics.ts` — Pure calculation functions, no I/O
- `display.ts` — Formatting and OpenCode client interaction
- `index.ts` — Event handling, state management, orchestration

---

## Important Notes

- **`tsconfig.json` excludes `.opencode/**/*`** — those files use Bun's runtime TS support
- **No build step for local dev** — Bun runs TypeScript directly
- **Character count as token proxy** — roughly 1 char ≈ 0.25–0.5 tokens
- **`.js` extension required in imports** — TypeScript ES modules convention
