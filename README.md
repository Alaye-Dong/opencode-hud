# OpenCode HUD Plugin

A plugin for [OpenCode](https://opencode.ai) that displays a real-time performance HUD while the AI is streaming a response.

## Metrics Displayed

| Metric | Description |
|--------|-------------|
| ⚡ Current TPS | Instantaneous tokens per second (last 200ms window) |
| avg TPS | Average tokens per second since streaming began |
| TTFT | Time To First Token — latency from your message to the first response token |
| Total tokens | Cumulative token count for the current response |
| Elapsed time | Wall-clock time since the first token |

**Example HUD toast:**
```
⚡ 45.2 t/s  avg 38.1 t/s  TTFT 312ms  [1.2k tok / 27.5s]
```

## Installation

This plugin auto-loads when you run `opencode` from this directory, because it lives in `.opencode/plugins/`.

To use it globally, copy `src/` to `~/.config/opencode/plugins/`.

## Development

```bash
# Install dependencies (Bun required)
bun install

# Run unit + integration tests
bun test

# Type-check
bun run typecheck
```

## Project Structure

```
opencode-hud/
├── .opencode/
│   ├── opencode.json          # OpenCode project config
│   └── plugins/
│       └── hud.ts             # Plugin entry (auto-loaded by OpenCode)
├── src/
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── metrics.ts             # Pure calculation functions (TPS, TTFT, etc.)
│   ├── display.ts             # Toast formatting and emission
│   └── index.ts               # Plugin main entry — registers event hooks
├── tests/
│   ├── metrics.test.ts        # Unit tests for calculation logic
│   └── integration.test.ts    # Event flow integration tests
├── package.json
└── tsconfig.json
```

## Architecture

The plugin uses a **`setInterval`-driven display loop** (not event-driven) so the HUD Toast stays visible even during tool calls when the text stream briefly pauses.

Key design decisions:
- `streamingStartTime` is set on the **first token**, not on `session.created`, to exclude LLM think-time from speed calculations
- `messageID` changes in `message.part.updated` detect new conversation rounds and reset per-round stats (prevents cross-round state pollution)
- Each session has its own independent state, so multiple parallel sessions work correctly
