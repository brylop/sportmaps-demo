# SportMaps - Script de Acceso Remoto / Multi-Red
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Iniciando SportMaps en Modo Remoto Multi-Red" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$rootDir = (Get-Location).Path
$binDir = Join-Path $rootDir "bin"
$cloudflaredPath = Join-Path $binDir "cloudflared.exe"

# 1. Asegurar binario de cloudflared
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "Descargando Cloudflare Tunnel portable..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $binDir | Out-Null
    curl.exe -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o $cloudflaredPath
}

$bffLog = Join-Path $binDir "tunnel-bff.log"
$frontLog = Join-Path $binDir "tunnel-front.log"

Remove-Item $bffLog -ErrorAction SilentlyContinue
Remove-Item $frontLog -ErrorAction SilentlyContinue

Write-Host "Creando tunel seguro para el BFF (puerto 3000)..." -ForegroundColor Yellow
$bffTunnelProc = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:3000" -PassThru -NoNewWindow -RedirectStandardError $bffLog

Write-Host "Creando tunel seguro para el Frontend (puerto 3001)..." -ForegroundColor Yellow
$frontTunnelProc = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:3001" -PassThru -NoNewWindow -RedirectStandardError $frontLog

# 2. Esperar y extraer las URLs de los tuneles
$bffUrl = ""
$frontUrl = ""
$maxRetries = 25

Write-Host "Esperando URLs publicas HTTPS..." -ForegroundColor Gray
for ($i = 0; $i -lt $maxRetries; $i++) {
    Start-Sleep -Seconds 1
    
    if (($bffUrl -eq "") -and (Test-Path $bffLog)) {
        $contentBff = Get-Content $bffLog -Raw
        if ($contentBff -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $bffUrl = $Matches[1]
        }
    }
    
    if (($frontUrl -eq "") -and (Test-Path $frontLog)) {
        $contentFront = Get-Content $frontLog -Raw
        if ($contentFront -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $frontUrl = $Matches[1]
        }
    }
    
    if (($bffUrl -ne "") -and ($frontUrl -ne "")) {
        break
    }
}

if (($bffUrl -eq "") -or ($frontUrl -eq "")) {
    Write-Host "No se pudieron obtener las URLs de los tuneles." -ForegroundColor Red
    if ($bffTunnelProc) { Stop-Process -Id $bffTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    if ($frontTunnelProc) { Stop-Process -Id $frontTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

Write-Host "====================================================" -ForegroundColor Green
Write-Host " AMBIENTE REMOTO LISTO Y ACTIVO" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host " URL Frontend (Abre esta en tu celular / otra PC):" -ForegroundColor White
Write-Host "    $frontUrl" -ForegroundColor Cyan
Write-Host " URL BFF (API Backend):" -ForegroundColor White
Write-Host "    $bffUrl" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Presiona Ctrl+C para cerrar los tuneles al finalizar." -ForegroundColor Gray

# 3. Iniciar BFF en una ventana separada con CORS configurado
Write-Host "Iniciando BFF..." -ForegroundColor Cyan
$bffCmd = "`$env:CORS_EXTRA_ORIGINS='$frontUrl'; cd '$rootDir\bff'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $bffCmd

# 4. Iniciar Frontend en una ventana separada con VITE_API_URL configurado
Write-Host "Iniciando Frontend..." -ForegroundColor Cyan
$frontCmd = "`$env:VITE_API_URL='$bffUrl'; cd '$rootDir\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontCmd

# Mantener la ventana activa y limpiar tuneles al salir
try {
    while ($true) {
        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host "Cerrando tuneles..." -ForegroundColor Yellow
    if ($bffTunnelProc) { Stop-Process -Id $bffTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    if ($frontTunnelProc) { Stop-Process -Id $frontTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $bffLog -ErrorAction SilentlyContinue
    Remove-Item $frontLog -ErrorAction SilentlyContinue
    Write-Host "Tuneles cerrados." -ForegroundColor Gray
}
