# Windows install fallback

If `irm https://raw.githubusercontent.com/Marcelover777/flint/main/install.ps1 | iex` fails on Windows, set up plugin-skill activation by hand. This does **not** install the standalone hooks or the statusline — for those, run the unified Node installer afterwards: `npx -y github:Marcelover777/flint -- --only claude` (or `node bin/install.js --only claude` from a clone).

```powershell
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$PluginSkillDir = Join-Path $ClaudeDir ".agents\plugins\flint\skills\flint"
$MarketplaceDir = Join-Path $ClaudeDir ".agents\plugins"
$MarketplaceFile = Join-Path $MarketplaceDir "marketplace.json"

# Copy SKILL.md into the plugin path (run from a clone of the repo)
New-Item -ItemType Directory -Path $PluginSkillDir -Force | Out-Null
Copy-Item ".\skills\flint\SKILL.md" "$PluginSkillDir\SKILL.md" -Force

# Create or update marketplace.json with the flint entry
New-Item -ItemType Directory -Path $MarketplaceDir -Force | Out-Null
if (Test-Path $MarketplaceFile) {
  $marketplace = Get-Content $MarketplaceFile -Raw | ConvertFrom-Json
} else {
  $marketplace = [pscustomobject]@{}
}
if (-not ($marketplace.PSObject.Properties.Name -contains "plugins")) {
  $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{})
}
$plugins = [ordered]@{}
foreach ($p in $marketplace.plugins.PSObject.Properties) { $plugins[$p.Name] = $p.Value }
$plugins["flint"] = [ordered]@{ name = "flint"; source = "Marcelover777/flint"; version = "main" }
$marketplace.plugins = [pscustomobject]$plugins
$marketplace | ConvertTo-Json -Depth 10 | Set-Content -Path $MarketplaceFile -Encoding UTF8
```

Verify: `Test-Path "$PluginSkillDir\SKILL.md"` should print `True`. Restart Claude Code, then run `/flint` to confirm the skill loads.

## Codex on Windows

1. Enable symlinks first: `git config --global core.symlinks true` (requires Developer Mode or admin).
2. Clone repo → Open VS Code → Codex Settings → Plugins → find "Flint" under the local marketplace → Install → Reload Window.
3. Codex hooks are currently disabled on Windows, so type `/flint` to start the mode manually each session.

## `npx skills` symlink fallback

`npx skills` uses symlinks by default. If symlinks fail, add `--copy`:

```powershell
npx skills add Marcelover777/flint --copy
```

## Want it always on (any agent)?

Paste this into the agent's system prompt or rules file:

```
Terse like flint. Technical substance exact. Only fluff die.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].
ACTIVE EVERY RESPONSE. No revert after many turns. No filler drift.
Code/commits/PRs: normal. Off: "stop flint" / "normal mode".
```
