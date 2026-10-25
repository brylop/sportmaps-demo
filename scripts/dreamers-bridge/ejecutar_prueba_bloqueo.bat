@echo off
rem ==========================================================================
rem  Prueba GUIADA de bloqueo de UN usuario en UN lector (Dreamers).
rem  Clic derecho > "Ejecutar como administrador". Solo con una persona de
rem  PRUEBA y alguien parado frente al lector.
rem
rem  1) Detiene un momento el bridge.
rem  2) Corre probar_bloqueo_un_pin.py (le va preguntando todo; al final vuelve
rem     a HABILITAR a la persona y lo verifica).
rem  3) Vuelve a arrancar el bridge.
rem
rem  Debe estar en la MISMA carpeta que dreamers_bridge.py.
rem ==========================================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === Deteniendo el bridge un momento ===
schtasks /End /TN "SportMaps-DreamersBridge"
timeout /t 3 /nobreak >nul

echo.
python probar_bloqueo_un_pin.py
if errorlevel 9009 (
  echo No se encontro "python"; probando con "py"...
  py probar_bloqueo_un_pin.py
)

echo.
echo === Volviendo a arrancar el bridge ===
schtasks /Run /TN "SportMaps-DreamersBridge"

echo.
echo Tome una captura de esta ventana y envie el archivo prueba_bloqueo_*.log de esta carpeta.
start "" explorer "%~dp0"
echo.
pause
