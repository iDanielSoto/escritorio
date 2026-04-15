!define MUI_WELCOMEFINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TITLE "Instalación de Sistema de Asistencia Finalizada"
!macro customInstall
  InitPluginsDir
  SetOutPath $PLUGINSDIR
  File "${PROJECT_DIR}\electron\BiometricMiddleware\installers\DigitalPersona_SDK_Setup.msi"
  DetailPrint "Instalando dependencias biometricas (DigitalPersona SDK)..."
  ExecWait '"msiexec" /i "$PLUGINSDIR\DigitalPersona_SDK_Setup.msi" /quiet /norestart'

  ReadEnvStr $0 "PROGRAMDATA"

  ; Crear directorio compartido y dar permisos a todos los usuarios
  CreateDirectory "$0\SistemaAsistencia"
  DetailPrint "Configurando permisos de directorio compartido..."
  ExecWait 'icacls "$0\SistemaAsistencia" /grant "Usuarios":(OI)(CI)F /T'
  ExecWait 'icacls "$0\SistemaAsistencia" /grant "Users":(OI)(CI)F /T'

  ; Copiar scripts
  SetOutPath "$0\SistemaAsistencia"
  File "${PROJECT_DIR}\electron\watchdog\watchdog.ps1"
  File "${PROJECT_DIR}\electron\watchdog\install-watchdog.ps1"
  File "${PROJECT_DIR}\electron\watchdog\uninstall-watchdog.ps1"

  DetailPrint "Instalando Watchdog de Sistema..."
  ExecWait 'powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$0\SistemaAsistencia\install-watchdog.ps1"'
!macroend

!macro customUnInstall
  ReadEnvStr $0 "PROGRAMDATA"
  DetailPrint "Eliminando Watchdog de Sistema..."
  ExecWait 'powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$0\SistemaAsistencia\uninstall-watchdog.ps1"'
!macroend
