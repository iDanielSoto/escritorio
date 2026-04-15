<#
.SYNOPSIS
    Registra el Watchdog en Windows.
#>

$taskName = "SistemaAsistencia-Watchdog"
$watchdogScript = Join-Path $env:PROGRAMDATA "SistemaAsistencia\watchdog.ps1"

if (-not (Test-Path $watchdogScript)) {
    exit 1
}

try {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
} catch { }

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdogScript`""

$principal = New-ScheduledTaskPrincipal `
    -GroupId "Users" `
    -LogonType Interactive `
    -RunLevel Highest

$trigger = New-ScheduledTaskTrigger -AtLogon

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force

Start-ScheduledTask -TaskName $taskName
