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

$regKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$command = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdogScript`""

Set-ItemProperty -Path $regKey -Name $taskName -Value $command -Force

# Iniciar inmediatamente para no requerir cerrar sesión al usuario post-instalación
try {
    Start-Process "powershell.exe" -ArgumentList "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdogScript`"" -WindowStyle Hidden
} catch {
    Write-Log "Fallo al iniciar el script post-instalacion: $($_.Exception.Message)"
}
