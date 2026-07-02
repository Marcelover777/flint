# flint — installer shim (Windows / PowerShell).
#
# Thin wrapper around bin/install.js (the unified Node installer). Every flag
# you'd pass to bin/install.js can be passed here; we just forward them.
#
# One-line install:
#   irm https://raw.githubusercontent.com/Marcelover777/flint/main/install.ps1 | iex
#
# Local clone:
#   pwsh install.ps1 [flags]
#
# Why a Node installer? install.sh + install.ps1 used to be parallel sources of
# truth and constantly drifted (issue #249 was a `node -e "..."` quoting bug
# that silently dropped the JSON merge step on every Windows install). One
# Node script works everywhere without quoting bugs.
#
# iex-safety: this script must survive `irm ... | iex`, where (a) there is no
# script file, so $MyInvocation.MyCommand.Path is $null, and (b) the automatic
# $args variable cannot be re-declared as a param ("variable has been
# optimized" error). Hence the $InstallArgs name and the guarded Split-Path —
# mirrors install.sh's `${BASH_SOURCE[0]:-}` guard.

[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$InstallArgs
)

$ErrorActionPreference = "Stop"
$Repo = "Marcelover777/flint"

# Require Node ≥18.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error @"
flint: Node.js (>=18) required. Install:
  - winget install OpenJS.NodeJS.LTS
  - or download from https://nodejs.org
"@
  exit 1
}

$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 18) {
  Write-Error "flint: Node $nodeMajor too old. Need Node >=18. Upgrade: https://nodejs.org"
  exit 1
}

# If we're inside the repo clone, run the local installer directly. Under
# `irm | iex` there is no script path — skip straight to the npx branch.
$here = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
if ($here) {
  $local = Join-Path $here "bin/install.js"
  if (Test-Path $local) {
    & node $local @InstallArgs
    exit $LASTEXITCODE
  }
}

# Curl-pipe path: delegate to npx.
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
  Write-Error "flint: npx required (ships with Node >=18). Reinstall Node.js."
  exit 1
}

# Do NOT pass `--` here — npm 7+ npx already forwards trailing args to the
# package, and a literal `--` was tripping bin/install.js's parseArgs as an
# unknown flag.
& npx -y "github:$Repo" @InstallArgs
exit $LASTEXITCODE
