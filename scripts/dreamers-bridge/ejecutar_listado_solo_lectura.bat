@echo off
rem ==========================================================================
rem  Listado de usuarios de los dos lectores MB360 (SOLO LECTURA) - Dreamers
rem  Doble clic (mejor: clic derecho > "Ejecutar como administrador").
rem
rem  1) Detiene un momento el bridge para que no compita por el lector.
rem  2) Corre listar_usuarios_solo_lectura.py (no escribe nada en los lectores).
rem  3) Vuelve a arrancar el bridge.
rem  4) Abre la carpeta con los archivos usuarios_*.csv que se generaron.
rem
rem  Debe estar en la MISMA carpeta que dreamers_bridge.py (donde ya se hizo
rem  "pip install -r requirements.txt").
rem ==========================================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === 1/3  Deteniendo el bridge un momento ===
schtasks /End /TN "SportMaps-DreamersBridge"
timeout /t 3 /nobreak >nul

echo.
echo === 2/3  Leyendo los dos lectores (puede tardar ~1 minuto) ===
python listar_usuarios_solo_lectura.py
if errorlevel 9009 (
  echo No se encontro "python"; probando con "py"...
  py listar_usuarios_solo_lectura.py
)

echo.
echo === 3/3  Volviendo a arrancar el bridge ===
schtasks /Run /TN "SportMaps-DreamersBridge"

echo.
echo LISTO. Se abre la carpeta con los archivos usuarios_*.csv.
echo Tome una captura de esta ventana y envie esos archivos.
start "" explorer "%~dp0"
echo.
pause
