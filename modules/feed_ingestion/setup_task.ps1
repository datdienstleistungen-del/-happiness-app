# Script to register the automated NeXus Feed Ingestion task in Windows Task Scheduler
# Executes every 3 hours silently in the background using pythonw.exe

$taskName = "NeXus_Feed_Ingestion"
$pythonw = "C:\Python314\pythonw.exe"
$scriptPath = "C:\Projekte\happiness-app-react\modules\feed_ingestion\run_scheduler_job.py"
$workingDir = "C:\Projekte\happiness-app-react"

if (-not (Test-Path $pythonw)) {
    # Fallback to python.exe if pythonw is missing
    $pythonw = (Get-Command python -ErrorAction SilentlyContinue).Source
}

Write-Host "Configuring Windows Scheduled Task: $taskName"
Write-Host "  Executable: $pythonw"
Write-Host "  Script:     $scriptPath"
Write-Host "  Interval:   Alle 3 Stunden"

# 1. Action: Execute pythonw.exe with script
$action = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument "`"$scriptPath`"" `
    -WorkingDirectory $workingDir

# 2. Trigger: Start immediately and repeat every 3 hours indefinitely
$startTime = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At $startTime `
    -RepetitionInterval (New-TimeSpan -Hours 3)

# 3. Settings: Run on battery, catch up if missed (StartWhenAvailable)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# 4. Register Task
try {
    # Unregister existing task if present
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    
    $task = Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "NeXus Pan-European C-Level & Board Vacancy Feed Ingestion (läuft vollautomatisch alle 3 Stunden im Hintergrund)"
    
    Write-Host "`n✅ Aufgabenplanung erfolgreich eingerichtet!" -ForegroundColor Green
    Write-Host "Task Name: $($task.TaskName)"
    Write-Host "State:     $($task.State)"
    
    # Query details
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "Nächster geplanter Lauf: $($info.NextRunTime)"
} catch {
    Write-Host "`n❌ Fehler bei der Registrierung der Aufgabe: $_" -ForegroundColor Red
    exit 1
}
