$task = Get-ScheduledTask -TaskName "NeXus_Continuous_Trigger_Radar" -ErrorAction SilentlyContinue
$info = Get-ScheduledTaskInfo -TaskName "NeXus_Continuous_Trigger_Radar" -ErrorAction SilentlyContinue

Write-Host "=== TASK INFO ==="
if ($task) {
    Write-Host "State:              $($task.State)"
}
if ($info) {
    Write-Host "LastRunTime:        $($info.LastRunTime)"
    Write-Host "LastTaskResult:     $($info.LastTaskResult)"
    Write-Host "NextRunTime:        $($info.NextRunTime)"
    Write-Host "NumberOfMissedRuns: $($info.NumberOfMissedRuns)"
} else {
    Write-Host "Keine ScheduledTaskInfo verfuegbar!"
}

Write-Host "`n=== ACTIONS ==="
if ($task) {
    $task.Actions | ForEach-Object {
        Write-Host "Execute:        $($_.Execute)"
        Write-Host "Arguments:      $($_.Arguments)"
        Write-Host "WorkingDirectory: $($_.WorkingDirectory)"
    }
}

Write-Host "`n=== TRIGGERS ==="
if ($task) {
    $task.Triggers | ForEach-Object {
        Write-Host "Id:                  $($_.Id)"
        Write-Host "StartBoundary:       $($_.StartBoundary)"
        Write-Host "RepetitionInterval:  $($_.Repetition.Interval)"
        Write-Host "RepetitionDuration:  $($_.Repetition.Duration)"
        Write-Host "Enabled:             $($_.Enabled)"
    }
}

Write-Host "`n=== SETTINGS ==="
if ($task) {
    Write-Host "MultipleInstancesPolicy: $($task.Settings.MultipleInstancesPolicy)"
    Write-Host "DisallowStartIfOnBatteries: $($task.Settings.DisallowStartIfOnBatteries)"
    Write-Host "StopIfGoingOnBatteries:     $($task.Settings.StopIfGoingOnBatteries)"
    Write-Host "ExecutionTimeLimit:         $($task.Settings.ExecutionTimeLimit)"
}

Write-Host "`n=== RECENT EVENT LOGS (TaskScheduler) ==="
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; ID=100,102,107,200,201} -MaxEvents 20 -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*NeXus_Continuous_Trigger_Radar*" }
    if ($events) {
        $events | ForEach-Object {
            Write-Host "$($_.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')) [ID $($_.Id)] $($_.Message)"
        }
    } else {
        Write-Host "Keine speziellen NeXus-Eintraege im Microsoft-Windows-TaskScheduler/Operational Log gefunden (oder Log deaktiviert)."
    }
} catch {
    Write-Host "Konnte WinEvent nicht abfragen: $_"
}
