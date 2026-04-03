!define MUI_WELCOMEFINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TITLE "Instalación de Sistema de Asistencia Finalizada"
!macro customInstall
  InitPluginsDir
  SetOutPath $PLUGINSDIR
  File "${PROJECT_DIR}\electron\BiometricMiddleware\installers\DigitalPersona_SDK_Setup.msi"
  DetailPrint "Instalando dependencias biometricas (DigitalPersona SDK)..."
  ExecWait '"msiexec" /i "$PLUGINSDIR\DigitalPersona_SDK_Setup.msi" /quiet /norestart'
!macroend
