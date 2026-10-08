$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableRuntime = Join-Path $PSScriptRoot '.tools/node-v22.23.3-win-x64'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path -LiteralPath (Join-Path $portableRuntime 'node.exe'))) {
        throw 'Install Node.js 22.12 or newer, then run npm install and npm run dev.'
    }
    $env:PATH = $portableRuntime + ';' + $env:PATH
}
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm.cmd install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
npm.cmd run dev
