# Script para iniciar Frontend y BFF simultáneamente

Write-Host "🚀 Iniciando SportMaps Demo..." -ForegroundColor Cyan

# Función para ejecutar comando en una nueva ventana
function Start-Service($name, $path, $command) {
    Write-Host "Starting $name in $path..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$path'; $command"
}

# Iniciar BFF
Start-Service "BFF" ".\bff" "npm run dev"

# Iniciar Frontend
Start-Service "Frontend" ".\frontend" "npm run dev"

Write-Host "✅ Servicios iniciados en ventanas separadas." -ForegroundColor Green
Write-Host "BFF: http://localhost:3000"
Write-Host "Frontend: http://localhost:3001"
