# Runs the app against the local backend from a device that can't reach this PC's
# network, such as a cloud iOS simulator. Both servers get a public HTTPS URL through
# Cloudflare quick tunnels (*.trycloudflare.com, no account needed):
#   - Metro   (port 8081) -> announced to the app with EXPO_PACKAGER_PROXY_URL
#   - backend (port 3000) -> EXPO_PUBLIC_API_URL for the app, PUBLIC_BASE_URL for file links
#
#   .\scripts\cloud-dev.ps1              # starts the backend too, in a new window
#   .\scripts\cloud-dev.ps1 -NoBackend   # the backend is already running on port 3000
#
# Not `expo start --tunnel`: its ngrok binary keeps getting stopped on this PC (Windows
# Defender has quarantined npm's ngrok before), which shows up as "Gateway Timeout".
# Quick-tunnel URLs are new on every run. Ctrl+C stops Metro and both tunnels.

param([switch]$NoBackend)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$metroPort = 8081
$apiPort = 3000

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
if (-not (Test-Path $cloudflared)) { throw 'cloudflared not found. Install it: winget install Cloudflare.cloudflared' }

if (Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $metroPort is taken (another Metro / expo start?). Stop it first."
}

# run-local.ps1 binds the backend to the LAN address (not localhost), so its tunnel targets that.
$ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = 'localhost' }

$tunnels = @()

# Starts a quick tunnel to $target and returns its public URL (cloudflared prints it on stderr).
function Start-QuickTunnel([string]$name, [string]$target) {
    $log = Join-Path $env:TEMP "halaqa-cloudflared-$name.log"
    Remove-Item $log -ErrorAction SilentlyContinue
    $proc = Start-Process $cloudflared -ArgumentList 'tunnel', '--no-autoupdate', '--url', $target `
        -RedirectStandardError $log -WindowStyle Hidden -PassThru
    $script:tunnels += $proc
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        if ($proc.HasExited) { throw "cloudflared ($name) exited early. See $log" }
        $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($m) { return $m.Matches[0].Value }
    }
    throw "No tunnel URL for $name after 30s. See $log"
}

try {
    $apiOrigin = Start-QuickTunnel 'api' "http://${ip}:$apiPort"
    $metroOrigin = Start-QuickTunnel 'metro' "http://localhost:$metroPort"

    # Backend, in its own window, building avatar/vault/recording links with its public URL.
    if (-not $NoBackend) {
        $env:PUBLIC_BASE_URL = $apiOrigin
        Start-Process powershell -ArgumentList '-NoExit', '-File', (Join-Path $root 'backend\run-local.ps1')
    }

    Write-Host ''
    Write-Host "  Backend  ->  $apiOrigin/api" -ForegroundColor Green
    if ($NoBackend) {
        Write-Host "  Restart the backend with PUBLIC_BASE_URL=$apiOrigin so file and avatar links work." -ForegroundColor Yellow
    }
    Write-Host "  Metro    ->  $metroOrigin" -ForegroundColor Green
    # Same link as the QR code. It only opens in the Halaqa development build (not Expo Go,
    # not a store build): without it installed, the iPhone camera reports "No usable data".
    $deepLink = 'exp+halaqa://?__expo_url=' + [uri]::EscapeDataString($metroOrigin)
    Write-Host "  App link ->  $deepLink" -ForegroundColor Green
    Write-Host '  Scan the QR code below with a device that has the Halaqa dev build installed,' -ForegroundColor Green
    Write-Host '  or paste the Metro URL into the dev build launcher (cloud simulator: open the App link).' -ForegroundColor Green
    Write-Host '  A new quick tunnel can take ~30s before it answers; retry if the first try fails.' -ForegroundColor DarkGray
    Write-Host ''

    # Process env beats .env. --clear because EXPO_PUBLIC_* values are baked into the bundle.
    $env:EXPO_PACKAGER_PROXY_URL = $metroOrigin
    $env:EXPO_PUBLIC_API_URL = "$apiOrigin/api"
    $env:EXPO_PUBLIC_USE_MOCK = 'false'
    Set-Location $root
    npx expo start --port $metroPort --clear
}
finally {
    $tunnels | ForEach-Object { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue }
}
