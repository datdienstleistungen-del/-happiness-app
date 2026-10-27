# Script to register the automated NeXus Continuous Trigger Event Radar in Windows Task Scheduler
# Executes daily silently in the background using pythonw.exe
# Zero Supabase writes - persists exclusively to data/research/continuous_radar_events.json

$taskName = "NeXus_Continuous_Trigger_Radar"
$pythonw = "C:\Python314\pythonw.exe"
$scriptPath = "C:\Projekte\happiness-app-react\modules\feed_ingestion\run_scheduler_job.py"
$workingDir = "C:\Projekte\happiness-app-react"

if (-not (Test-Path $pythonw)) {
    # Fallback to python.exe if pythonw is missing
    $pythonCmd = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ($pythonCmd) {
        $pythonw = $pythonCmd
    } else {
        $pythonw = "C:\Python314\python.exe"
    }
}

Write-Host "==========================================================================="
Write-Host "🛰️  Konfiguriere Windows-Aufgabenplanung: $taskName"
Write-Host "  Executable:       $pythonw"
Write-Host "  Script:           $scriptPath"
Write-Host "  Arbeitsordner:    $workingDir"
Write-Host "  Ausführungsplan:  Alle 3 Stunden (24/7 Wiederholung, Intervall PT3H)"
Write-Host "==========================================================================="

# 1. Action: Execute pythonw.exe with script
$action = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $workingDir

# 2. Trigger: Kontinuierlicher 3-Stunden-Takt (24/7 Wiederholung alle 3 Stunden)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At "00:00" `
    -RepetitionInterval (New-TimeSpan -Hours 3) `
    -RepetitionDuration (New-TimeSpan -Days 9999)

# 3. Settings: Batteriefreundlich, StartWhenAvailable (nachholen falls PC aus)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# 4. Register Task
try {
    # Unregister existing old tasks if present
    Unregister-ScheduledTask -TaskName "NeXus_Feed_Ingestion" -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    
    $task = Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "NeXus HIT Kontinuierlicher Trigger-Event-Radar (läuft vollautomatisch im 3-Stunden-Takt im Hintergrund, recherchiert öffentlich zugängliche DACH-Quellen ohne DB-Schreibzugriffe)"
    
    Write-Host "`n✅ Aufgabenplanung erfolgreich eingerichtet!" -ForegroundColor Green
    Write-Host "  Task-Name:                 $($task.TaskName)"
    Write-Host "  Status:                    $($task.State)"
    
    # Query details
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "  Nächster geplanter Lauf:   $($info.NextRunTime)"
    Write-Host "==========================================================================="
} catch {
    Write-Host "`n❌ Fehler bei der Registrierung der Aufgabe: $_" -ForegroundColor Red
    exit 1
}
