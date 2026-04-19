<#
.SYNOPSIS
    Watchdog del Sistema de Asistencia — PowerShell
.DESCRIPTION
    Script programado que lee app-config.json cada 10 segundos
    para recibir comandos de inicio ("start") asíncronos desde el backend.
#>

$configDir  = Join-Path $env:PROGRAMDATA "SistemaAsistencia"
$configPath = Join-Path $configDir "app-config.json"
$pollIntervalOk = 10
$pollIntervalErr = 30

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    $logFile = Join-Path $configDir "watchdog.log"
    try {
        if (-not (Test-Path $configDir)) { return }
        if (Test-Path $logFile) {
            $lines = Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue
            $lines += $line
            Set-Content -Path $logFile -Value $lines -ErrorAction SilentlyContinue
        } else {
            Set-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
        }
    } catch { }
}

function Get-KioskoExePath {
    try {
        $keys = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -like "*Sistema de Asistencia*" }
        if ($keys -and $keys.InstallLocation) {
            $exe = Join-Path $keys.InstallLocation "Sistema de Asistencia.exe"
            if (Test-Path $exe) { return $exe }
        }
    } catch { }
    $fallback = "C:\Program Files\Sistema de Asistencia\Sistema de Asistencia.exe"
    if (Test-Path $fallback) { return $fallback }
    return $null
}

function Test-KioskoRunning {
    $procs = Get-Process -Name "Sistema de Asistencia", "SistemaAsistencia" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if ($p.MainWindowHandle -ne 0) {
            return $true
        }
    }
    return $false
}

Write-Log "=== Watchdog iniciado ==="
Start-Sleep -Seconds 5

while ($true) {
    try {
        if (-not (Test-Path $configPath)) {
            Start-Sleep -Seconds $pollIntervalOk
            continue
        }

        $raw = Get-Content $configPath -Raw -Encoding UTF8 -ErrorAction Stop
        $config = $raw | ConvertFrom-Json
        
        $escritorioId = $config.escritorio_id
        $backendUrl   = $config.backendUrl
        $token        = $config.auth_token
        
        if (-not $backendUrl) {
            $backendUrl = "https://9dm7dqf9-3002.usw3.devtunnels.ms"
        }

        if (-not $escritorioId) {
            Write-Log "FALTA CONFIGURACION: escritorioId=$escritorioId"
            Start-Sleep -Seconds $pollIntervalOk
            continue
        }

        $backendUrl = $backendUrl.TrimEnd('/')
        $url = "$backendUrl/api/escritorio/$escritorioId/comando-watchdog"
        $headers = @{}
        $headers["Accept"] = "application/json"
        
        if ($token) { $headers["Authorization"] = "Bearer $token" }

        Write-Log "Pidiendo comando a: $url"

        $response = $null
        try {
            $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 8 -Method Get -ErrorAction Stop
        } catch {
            Write-Log "ERROR API o de Red: $($_.Exception.Message)"
            Start-Sleep -Seconds $pollIntervalErr
            continue
        }

        Write-Log "RESPUESTA API: success=$($response.success), accion=$($response.accion)"

        if ($response.success -eq $true -and $response.accion -eq 'start') {
            if (-not (Test-KioskoRunning)) {
                Write-Log "Limpiando procesos fantasma de Electron previos a reencendido..."
                Get-Process -Name "Sistema de Asistencia", "SistemaAsistencia" -ErrorAction SilentlyContinue | Stop-Process -Force
                
                $exePath = Get-KioskoExePath
                Write-Log "DEBUG: Ruta detectada del ejecutable: $exePath"
                if ($exePath) {
                    Write-Log "ACCION: Comando 'start' recibido - iniciando kiosko de forma visible..."
                    Start-Process -FilePath $exePath -WindowStyle Normal
                    Start-Sleep -Seconds 5
                } else {
                    Write-Log "ERROR: No se encontro el ejecutable en el Registro ni en Archivos de Programa."
                }
            } else {
                Write-Log "INFO: Comando 'start' ignorado, kiosko ya esta corriendo"
            }
        }

        Start-Sleep -Seconds $pollIntervalOk

    } catch {
        Write-Log "ERROR en loop: $($_.Exception.Message)"
        Start-Sleep -Seconds $pollIntervalErr
    }
}
