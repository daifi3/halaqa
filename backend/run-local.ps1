# Starts the Halaqa backend for local development.
#   cd backend; .\run-local.ps1
#
# Port 8080 is taken by Apache on this machine, so the backend uses 3000.
# The LAN address is detected each run, so phones on the same Wi-Fi can reach it
# even after the router hands this PC a new IP.

$ErrorActionPreference = 'Stop'

$env:JAVA_HOME = 'C:\Users\HP\tools\jdk-21.0.13+9'
$maven = 'C:\Users\HP\tools\apache-maven-3.9.9\bin\mvn.cmd'
$port = 3000

# The adapter that has a default gateway is the one on the local network.
$ip = (Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = 'localhost'; Write-Warning 'No network found - phones will not reach the backend.' }

$inUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    $owner = Get-Process -Id $inUse[0].OwningProcess
    throw "Port $port is already used by $($owner.ProcessName) (PID $($owner.Id)). Stop it first: Stop-Process -Id $($owner.Id)"
}

$env:SERVER_ADDRESS = $ip
$env:SERVER_PORT = "$port"
$env:PUBLIC_BASE_URL = "http://${ip}:$port"
$env:LIVEKIT_WS_URL = "ws://${ip}:7880"

Write-Host ''
Write-Host "  Halaqa backend  ->  http://${ip}:$port/api" -ForegroundColor Green
Write-Host "  In the app's .env:  EXPO_PUBLIC_API_URL=http://${ip}:$port/api" -ForegroundColor Green
Write-Host ''

Set-Location $PSScriptRoot
# `clean` so classes written by the editor's Java tooling never mix with Maven's.
& $maven -q clean spring-boot:run
