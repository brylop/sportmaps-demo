<#
.SYNOPSIS
    Corre dreamers_bridge.py en loop, reiniciandolo solo si se cae.

.DESCRIPTION
    Este script NO se ejecuta a mano. Lo lanza la tarea programada de
    Windows que crea install_scheduled_task.ps1, al arrancar la PC, sin
    necesidad de que nadie tenga sesion abierta.

    Si el proceso de Python termina por cualquier motivo (error, crash,
    la ventana se cierra por accidente si alguien la abre manualmente,
    reinicio del equipo), este supervisor lo vuelve a levantar despues de
    unos segundos. Nunca se "queda apagado" esperando que alguien lo note.

    Todo lo que imprime dreamers_bridge.py (y los reinicios) queda en
    bridge_supervisor.log en esta misma carpeta.
#>

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "dreamers_bridge.py"
$LogFile = Join-Path $ScriptDir "bridge_supervisor.log"
$RestartDelaySeconds = 5

# Log con rotacion simple: si supera ~20 MB, lo archiva y arranca uno nuevo
# (evita que crezca sin limite en una PC que nadie revisa por meses).
function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 20MB)) {
        $archived = Join-Path $ScriptDir "bridge_supervisor.$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
        Move-Item $LogFile $archived -Force
    }
}

# Busca python en PATH (py launcher o python.exe, lo que este disponible)
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
    exit 1
}

Write-Log "=== Supervisor iniciado. Python: $PythonExe | Script: $PythonScript ==="

while ($true) {
    Write-Log "Arrancando dreamers_bridge.py..."
    try {
        & $PythonExe $PythonScript *>> $LogFile
        $exitCode = $LASTEXITCODE
        Write-Log "dreamers_bridge.py terminó (exit code $exitCode). Reiniciando en $RestartDelaySeconds s..."
    } catch {
        Write-Log "Excepcion lanzando el proceso: $_. Reintentando en $RestartDelaySeconds s..."
    }
    Start-Sleep -Seconds $RestartDelaySeconds
}
