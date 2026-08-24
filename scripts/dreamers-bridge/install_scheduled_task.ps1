<#
.SYNOPSIS
    Instala el bridge de Dreamers como tarea programada de Windows, con
    auto-reinicio si falla, corriendo aunque nadie tenga sesion abierta.

.DESCRIPTION
    Correr UNA SOLA VEZ en la PC del club, como Administrador:

        cd ruta\donde\quedo\esta\carpeta
        powershell -ExecutionPolicy Bypass -File .\install_scheduled_task.ps1

    Despues de esto:
      - La tarea "SportMaps-DreamersBridge" arranca sola cuando prende la PC
        (no depende de que alguien inicie sesion con su usuario).
      - Si el proceso se cae, Windows lo reinicia solo (hasta 999 veces,
        cada 1 minuto -- practicamente "para siempre" en terminos operativos).
      - Ya NO hace falta correr ningun .bat a mano nunca mas.

    Para desinstalar: Unregister-ScheduledTask -TaskName "SportMaps-DreamersBridge"
#>

#Requires -RunAsAdministrator

$TaskName = "SportMaps-DreamersBridge"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SupervisorScript = Join-Path $ScriptDir "run_supervised.ps1"

if (-not (Test-Path $SupervisorScript)) {
    Write-Error "No se encontro run_supervised.ps1 en $ScriptDir. Corre este instalador desde la carpeta del bridge."
    exit 1
}

# Verifica que python este instalado ANTES de instalar la tarea, para no
# dejar una tarea programada que va a fallar en loop silenciosamente.
$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCheck) {
    Write-Warning "No se encontro 'python' en PATH. Instala Python 3 (python.org) y 'pip install -r requirements.txt' en esta carpeta ANTES de que la tarea programada intente arrancar. La tarea se va a instalar igual, pero va a fallar hasta que Python este disponible."
}

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SupervisorScript`""

# Arranca con la PC, sin depender de que un usuario inicie sesion.
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Reintentos generosos: si se cae, Windows lo levanta de nuevo cada minuto.
# NoInstance policy = si por algun motivo ya hay una corriendo, no duplica.
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

# Corre como SYSTEM: no depende de la sesion de ningun usuario particular,
# ni de que alguien deje la sesion abierta.
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
    -Description "Puente ZKTeco -> SportMaps para Dreamers Gymnastics (MB360 no soporta HTTPS nativo). Ver README.md de esta carpeta." `
    | Out-Null

Write-Host "Tarea '$TaskName' instalada. Arrancando ahora para probar..."
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo | Format-List TaskName, LastRunTime, LastTaskResult, NextRunTime

Write-Host "`nRevisa bridge_supervisor.log en esta carpeta para confirmar que esta corriendo."
