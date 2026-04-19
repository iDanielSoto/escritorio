<#
.SYNOPSIS
    Elimina el Watchdog.
#>

$taskName = "SistemaAsistencia-Watchdog"

try {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    }
} catch { }

# Eliminar del registro de auto-start
$regKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $regKey -Name $taskName -ErrorAction SilentlyContinue

# Matar el watchdog local si está corriendo para remover la carpeta sin errores de lock
Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match "watchdog.ps1" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
