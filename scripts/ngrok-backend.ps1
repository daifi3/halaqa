# Serves the local backend (and this laptop's Postgres) to the internet through ngrok,
# so the web app and the Android APK can use it from anywhere, without a hosted server.
#
#   .\scripts\ngrok-backend.ps1                                  # uses $env:HALAQA_NGROK_DOMAIN if set
#   .\scripts\ngrok-backend.ps1 -Domain my-name.ngrok-free.app   # your free static domain
#   .\scripts\ngrok-backend.ps1 -NoBackend                       # backend already running on port 3000
#
# Use your free *static* domain (dashboard.ngrok.com -> Domains). The web build and the APK have
# the backend URL baked in, so a random URL that changes on every restart would break them.
# Ctrl+C stops the backend and the tunnel.

param(
    [string]$Domain = $env:HALAQA_NGROK_DOMAIN,
    [switch]$NoBackend
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$apiPort = 3000

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    throw 'ngrok not found. Install it (winget install ngrok.ngrok) and run: ngrok config add-authtoken <token>'
}

# run-local.ps1 binds the backend to the LAN address (not localhost), so the tunnel targets that.
$ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = 'localhost' }

$ngrokArgs = @('http', "http://${ip}:$apiPort", '--log', 'stdout')
if ($Domain) {
    $Domain = $Domain -replace '^https?://', '' -replace '/.*$', ''
    $ngrokArgs += @('--url', "https://$Domain")
} else {
    Write-Warning 'No -Domain given: ngrok picks a URL that may change on restart. Builds that use it will break when it does.'
}

$log = Join-Path $env:TEMP 'halaqa-ngrok.log'
Remove-Item $log -ErrorAction SilentlyContinue
$ngrok = Start-Process ngrok -ArgumentList $ngrokArgs -RedirectStandardOutput $log -WindowStyle Hidden -PassThru

try {
    # The agent's local API (port 4040) reports the public URL once the tunnel is up.
    $public = $null
    for ($i = 0; $i -lt 40 -and -not $public; $i++) {
        Start-Sleep -Milliseconds 500
        if ($ngrok.HasExited) { throw "ngrok exited early. See $log" }
        try {
            $public = (Invoke-RestMethod http://127.0.0.1:4040/api/tunnels).tunnels |
                Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1 -ExpandProperty public_url
        } catch { }
    }
    if (-not $public) { throw "No tunnel URL after 20s. See $log" }

    Write-Host ''
    Write-Host "  Backend (public)  ->  $public/api" -ForegroundColor Green
    Write-Host "  Web app & APK     ->  build with VITE_API_URL / EXPO_PUBLIC_API_URL = $public/api" -ForegroundColor Green
    Write-Host "  Traffic inspector ->  http://127.0.0.1:4040" -ForegroundColor DarkGray
    Write-Host '  Keep this window open: the apps only work while this laptop, Postgres and the tunnel are up.' -ForegroundColor Yellow
    Write-Host ''

    if ($NoBackend) {
        Write-Host "  Restart the backend with PUBLIC_BASE_URL=$public so avatar, file and recording links work." -ForegroundColor Yellow
        Wait-Process -Id $ngrok.Id
    } else {
        # Avatar, vault, homework and recording links are built from this, so they open from anywhere.
        $env:PUBLIC_BASE_URL = $public
        & (Join-Path $root 'backend\run-local.ps1')
    }
}
finally {
    Stop-Process -Id $ngrok.Id -ErrorAction SilentlyContinue
}
