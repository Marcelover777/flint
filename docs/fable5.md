# Caveman with Claude Fable 5

Fable 5 makes token waste more expensive, especially output tokens and repeated context. Caveman V1 handles three surfaces:

- output: caveman mode, cavecrew compact contracts;
- input/context: micro-inject, local memory compression, MCP shrink;
- measurement: `/caveman-stats --json` with input/output/cache token fields and Fable 5 pricing.

## Defaults

```json
{
  "defaultMode": "full",
  "targetModel": "claude-fable-5",
  "injection": {
    "sessionStart": "micro",
    "reinforcement": "adaptive"
  },
  "compression": {
    "defaultStrategy": "hybrid",
    "llmEnabled": false,
    "llmModel": "claude-fable-5"
  }
}
```

Config path: `~/.config/caveman/config.json` on macOS/Linux or `%APPDATA%\caveman\config.json` on Windows.

## Commands

```bash
/caveman-stats --json
/caveman-compress CLAUDE.md --check --local-only
/caveman-compress CLAUDE.source.md --out CLAUDE.md --strict
/caveman-doctor --json
/caveman-bench --offline --report
```

## Safety

Local-only compression does not call the network. LLM compression is opt-in and sends selected prose to Claude API after secret scan and protected-span masking. Do not run LLM compression on sensitive documents. Secret scan blocks known keys, private-key material, credential paths, database URLs, JWT-looking values, and high-entropy tokens before LLM use.

## Limits

Stats are estimates when they use benchmark ratios or char/token fallback. The official Anthropic token-count API is used only when `ANTHROPIC_API_KEY` exists. Caveman reduces visible output and repeated context; it does not directly reduce hidden adaptive thinking tokens.
