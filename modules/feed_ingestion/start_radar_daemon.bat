@echo off
title NeXus Radar Ingestion Daemon (3h)
cd /d "C:\Projekte\happiness-app-react"

:: Check for pythonw to run completely headless, or python minimized
if exist "C:\Python314\pythonw.exe" (
    echo [NeXus Radar] Starte Ingestion-Daemon im Hintergrund (C:\Python314\pythonw.exe)...
    start "" "C:\Python314\pythonw.exe" "C:\Projekte\happiness-app-react\modules\feed_ingestion\scheduler.py"
    echo [NeXus Radar] Daemon laeuft unsichtbar im 3-Stunden-Takt.
    timeout /t 3 /nobreak >nul
    exit /b 0
)

:: Fallback standard python minimized
echo [NeXus Radar] Starte Ingestion-Daemon minimiert...
start /min "NeXus Radar Ingestion Daemon" python "modules\feed_ingestion\scheduler.py"
echo [NeXus Radar] Daemon im Hintergrund gestartet.
timeout /t 3 /nobreak >nul
