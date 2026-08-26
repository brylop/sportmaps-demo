<#
.SYNOPSIS
    Instala el puente de apertura de GYM RM como tarea programada de
    Windows, con auto-reinicio, corriendo aunque nadie tenga sesion abierta.

.DESCRIPTION
    Correr UNA SOLA VEZ en la PC del gym, como Administrador:

        cd ruta\donde\quedo\esta\carpeta
        powershell -ExecutionPolicy Bypass -File .\install_scheduled_task.ps1

    Despues de esto:
      - La tarea "SportMaps-GymRM-DoorBridge" arranca sola cuando prende
        la PC (no depende de que alguien inicie sesion con su usuario).
      - Si el proceso se cae, se reinicia solo (hasta 999 veces, cada 1
        minuto).
      - Ya no hace falta correr nada a mano nunca mas.

    IMPORTANTE -- variable de entorno con la API key:
    Antes de correr este instalador, configura la variable de entorno DE
    SISTEMA (no de usuario) SPORTMAPS_BRIDGE_API_KEY con el valor que te
    haya dado el equipo de backend. Sin esto, el bridge corre pero el
    backend rechaza todas sus peticiones (401). Se puede setear asi, como
    Administrador, ANTES de instalar la tarea:

        [Environment]::SetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "TU_LLAVE_AQUI", "Machine")

    Para desinstalar: Unregister-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge"
#>

#Requires -RunAsAdministrator

$TaskName = "SportMaps-GymRM-DoorBridge"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SupervisorScript = Join-Path $ScriptDir "run_supervised.ps1"

if (-not (Test-Path $SupervisorScript)) {
    Write-Error "No se encontro run_supervised.ps1 en $ScriptDir. Corre este instalador desde la carpeta del bridge."
    exit 1
}

$apiKey = [Environment]::GetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "Machine")
if (-not $apiKey) {
    Write-Warning "La variable de entorno DE SISTEMA 'SPORTMAPS_BRIDGE_API_KEY' no esta configurada."
    Write-Warning "El bridge se va a instalar igual, pero el backend va a rechazar sus peticiones (401) hasta que la configures."
    Write-Warning 'Setearla asi (como Administrador) y luego reiniciar la tarea:'
    Write-Warning '  [Environment]::SetEnvironmentVariable("SPORTMAPS_BRIDGE_API_KEY", "TU_LLAVE_AQUI", "Machine")'
    Write-Warning '  Restart-ScheduledTask -TaskName "SportMaps-GymRM-DoorBridge"  (o reiniciar la PC)'
}

$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
$pyCheck = Get-Command py -ErrorAction SilentlyContinue
if (-not $pythonCheck -and -not $pyCheck) {
    Write-Warning "No se encontro 'python' ni 'py' en PATH. Instala Python 3 (python.org) y 'pip install -r requirements.txt' en esta carpeta ANTES de que la tarea programada intente arrancar."
}

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SupervisorScript`""

# Arranca con la PC, sin depender de que un usuario inicie sesion.
$Trigger = New-ScheduledTaskTrigger -AtStartup

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

# Corre como SYSTEM: no depende de la sesion de ningun usuario particular.
# CRITICO: si Python se instalo solo "para el usuario actual" (no "para
# todos los usuarios"), la cuenta SYSTEM puede no encontrarlo en su PATH.
# Verificar esto es el primer paso de troubleshooting si la tarea falla.
$Principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Ya existe la tarea '$TaskName' -- se reemplaza con esta configuracion."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Puente de apertura remota de puertas para GYM RM (el F22ID acepta el comando ADMS pero no abre el rele fisico). Ver README.md de esta carpeta." `
    | Out-Null

Write-Host "Tarea '$TaskName' instalada. Arrancando ahora para probar..."
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, LastTaskResult, NextRunTime

Write-Host "`nRevisa bridge_supervisor.log en esta carpeta para confirmar que esta corriendo."
Write-Host "IMPORTANTE: haz una prueba de apertura real desde el dashboard y confirma en el log que llego el comando y se ejecuto."
