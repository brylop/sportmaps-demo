<#
.SYNOPSIS
    Corre door_bridge.py en loop, reiniciandolo solo si se cae.

.DESCRIPTION
    Este script NO se ejecuta a mano. Lo lanza la tarea programada de
    Windows que crea install_scheduled_task.ps1, al arrancar la PC, sin
    necesidad de que nadie tenga sesion abierta.

    Si el proceso de Python termina por cualquier motivo (error, crash,
    reinicio del equipo), este supervisor lo vuelve a levantar despues de
    unos segundos. Nunca se "queda apagado" esperando que alguien lo note.

    Todo lo que imprime door_bridge.py (y los reinicios) queda en
    bridge_supervisor.log en esta misma carpeta.
#>

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "door_bridge.py"
$LogFile = Join-Path $ScriptDir "bridge_supervisor.log"
$RestartDelaySeconds = 5

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 20MB)) {
        $archived = Join-Path $ScriptDir "bridge_supervisor.$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
        Move-Item $LogFile $archived -Force
    }
}

function Resolve-PythonExe {
    $candidates = @("python", "python3", "py")
    foreach ($c in $candidates) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

$PythonExe = Resolve-PythonExe
if (-not $PythonExe) {
    Write-Log "FATAL: no se encontro python en PATH. Instalar Python y agregarlo al PATH antes de reintentar."
    Write-Log "IMPORTANTE: si esta tarea corre como SYSTEM, verifica que Python este instalado 'para todos los usuarios' o agregado al PATH DEL SISTEMA (no solo del usuario), porque la cuenta SYSTEM no ve el PATH de usuarios individuales."
    exit 1
}

Write-Log "=== Supervisor iniciado. Python: $PythonExe | Script: $PythonScript ==="

while ($true) {
    Write-Log "Arrancando door_bridge.py..."
    try {
        & $PythonExe $PythonScript *>> $LogFile
        $exitCode = $LASTEXITCODE
        Write-Log "door_bridge.py terminó (exit code $exitCode). Reiniciando en $RestartDelaySeconds s..."
    } catch {
        Write-Log "Excepcion lanzando el proceso: $_. Reintentando en $RestartDelaySeconds s..."
    }
    Start-Sleep -Seconds $RestartDelaySeconds
}
