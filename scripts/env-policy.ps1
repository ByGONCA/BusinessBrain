<#
.SYNOPSIS
    BusinessBrain Multi-PC Environment & Tooling Policy Runner
.DESCRIPTION
    Executes the deterministic TypeScript policy engine.
    Default mode: Safe diagnostic check (read-only).
    Apply mode: Requires -Apply switch.
.EXAMPLE
    .\scripts\env-policy.ps1          # Diagnostic run
    .\scripts\env-policy.ps1 -Apply   # Apply policy changes with backups
#>

[CmdletBinding()]
param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$tsScript = Join-Path $scriptDir "env-policy.ts"

if (-not (Test-Path $tsScript)) {
    Write-Error "Could not locate policy script at $tsScript"
    exit 1
}

$cmdArgs = @("tsx", $tsScript)
if ($Apply) {
    $cmdArgs += "--apply"
}

Write-Host "Running BusinessBrain Environment Policy Engine..." -ForegroundColor Cyan
& npx $cmdArgs
exit $LASTEXITCODE
