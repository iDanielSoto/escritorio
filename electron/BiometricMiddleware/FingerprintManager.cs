using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BiometricMiddleware.Adapters;

namespace BiometricMiddleware
{
    public class FingerprintManager
    {
        public event Func<string, string, Task> OnStatusChanged;
        public event Func<int, int, Task> OnEnrollProgress;
        public event Func<string, string, int?, string, Task> OnCaptureComplete;
        public event Func<bool, Task> OnReaderConnectionChanged;

        private IFingerprintReader _reader;
        private Dictionary<string, byte[]> _enrolledTemplates = new Dictionary<string, byte[]>();
        private System.Threading.Timer _readerCheckTimer;
        private bool _lastReaderState = false;

        /// <summary>
        /// Inicializa el FingerprintManager. Retorna true si encontro un lector.
        /// </summary>
        public async Task<bool> Initialize()
        {
            Console.WriteLine("[INIT] Inicializando BiometricMiddleware...\n");

            var found = await TryDetectReader();

            // Iniciar timer para detectar conexion/desconexion de lectores
            StartReaderMonitor();

            return found;
        }

        /// <summary>
        /// Intenta detectar y conectar un lector biometrico
        /// </summary>
        /// <param name="silent">Si es true, no envia notificaciones (usado por el monitor)</param>
        public async Task<bool> TryDetectReader(bool silent = false)
        {
            try
            {
                // Si ya tenemos un lector conectado, verificar si sigue conectado
                if (_reader != null && _reader.IsConnected)
                {
                    return true;
                }

                // Limpiar lector anterior si existe
                if (_reader != null)
                {
                    _reader.Dispose();
                    _reader = null;
                }

                _reader = await ReaderFactory.AutoDetectReader();

                if (_reader == null)
                {
                    return false;
                }

                _reader.OnStatusChanged += NotifyStatus;
                _reader.OnEnrollProgress += NotifyEnrollProgress;
                _reader.OnCaptureComplete += HandleCaptureComplete;
                _reader.OnFingerDetected += HandleFingerDetected;

                Console.WriteLine("[OK] Lector detectado");
                Console.WriteLine($"    Lector: {_reader.ReaderBrand} {_reader.DeviceModel}\n");

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Deteccion de lector: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Inicia el monitoreo periodico de conexion de lectores
        /// </summary>
        private void StartReaderMonitor()
        {
            _readerCheckTimer = new System.Threading.Timer(async _ =>
            {
                try
                {
                    bool currentState = _reader != null && _reader.IsConnected;

                    // Si no hay lector, intentar detectar uno (silenciosamente)
                    if (!currentState)
                    {
                        var found = await TryDetectReader(silent: true);
                        currentState = found;
                    }

                    // Solo notificar si hay un CAMBIO de estado
                    if (currentState != _lastReaderState)
                    {
                        _lastReaderState = currentState;
                        Console.WriteLine($"[MONITOR] Lector {(currentState ? "CONECTADO" : "DESCONECTADO")}");

                        // Notificar cambio via evento
                        if (OnReaderConnectionChanged != null)
                        {
                            await OnReaderConnectionChanged(currentState);
                        }

                        // Notificar estado via WebSocket solo en cambio
                        if (currentState)
                        {
                            await NotifyStatus("ready", $"Lector conectado - {_reader?.ReaderBrand}");
                        }
                        else
                        {
                            await NotifyStatus("noReader", "Lector desconectado");
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Silenciar errores del monitor para no llenar la consola
                }
            }, null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(3));
        }

        public async Task StartEnrollment(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    throw new ArgumentException("UserId no puede estar vacio");

                if (_reader == null || !_reader.IsConnected)
                {
                    await NotifyStatus("noReader", "Conecta un lector biometrico para continuar");
                    throw new Exception("No hay lector conectado. Conecta uno e intenta de nuevo.");
                }

                Console.WriteLine($"[ENROLL] Iniciando para: {userId}");
                await _reader.StartEnrollment(userId);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] StartEnrollment: {ex.Message}");
                await NotifyStatus("error", ex.Message);
                throw;
            }
        }

        public void CancelEnrollment()
        {
            try
            {
                _reader?.CancelEnrollment();
                Console.WriteLine("[INFO] Enrollment cancelado");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARN] Error cancelando: {ex.Message}");
            }
        }

        public async Task StartVerification(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    throw new ArgumentException("UserId no puede estar vacio");

                if (_reader == null || !_reader.IsConnected)
                {
                    await NotifyStatus("noReader", "Conecta un lector biometrico para continuar");
                    throw new Exception("No hay lector conectado. Conecta uno e intenta de nuevo.");
                }

                if (!_enrolledTemplates.ContainsKey(userId))
                    throw new Exception($"Usuario {userId} no tiene huella registrada");

                var template = _enrolledTemplates[userId];
                Console.WriteLine($"[VERIFY] Iniciando para: {userId}");
                await _reader.StartVerification(userId, template);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] StartVerification: {ex.Message}");
                await NotifyStatus("error", ex.Message);
                throw;
            }
        }

        public async Task StartIdentificationWithTemplates(Dictionary<string, byte[]> templates)
        {
            try
            {
                if (_reader == null || !_reader.IsConnected)
                {
                    await NotifyStatus("noReader", "Conecta un lector biometrico para continuar");
                    throw new Exception("No hay lector conectado. Conecta uno e intenta de nuevo.");
                }

                if (templates == null || templates.Count == 0)
                    throw new Exception("No hay templates para identificar");

                Console.WriteLine($"[IDENTIFY] Iniciando con {templates.Count} templates de BD");
                await _reader.StartIdentification(templates);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] StartIdentification: {ex.Message}");
                await NotifyStatus("error", ex.Message);
                throw;
            }
        }

        public void PreloadTemplates(Dictionary<string, byte[]> templates)
        {
            if (_reader == null)
            {
                Console.WriteLine("[WARN] No hay lector para pre-cargar templates");
                return;
            }

            _reader.PreloadTemplates(templates);
        }

        public void StopCapture()
        {
            try
            {
                _reader?.StopCapture();
                Console.WriteLine("[INFO] Captura detenida");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARN] Error deteniendo: {ex.Message}");
            }
        }

        private async Task HandleCaptureComplete(CaptureResult result)
        {
            try
            {
                Console.WriteLine($"[RESULT] {result.ResultType} - {result.Message}");

                if (result.ResultType == CaptureResultType.EnrollmentSuccess && result.Template != null)
                {
                    _enrolledTemplates[result.UserId] = result.Template;
                    Console.WriteLine($"[OK] Template guardado en memoria: {result.Template.Length} bytes");
                }

                string resultType = MapResultType(result.ResultType);

                await NotifyCaptureComplete(resultType, result.UserId, result.MatchScore, result.TemplateBase64);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] HandleCaptureComplete: {ex.Message}");
            }
        }

        private string MapResultType(CaptureResultType type)
        {
            switch (type)
            {
                case CaptureResultType.EnrollmentSuccess:
                    return "enrollmentSuccess";
                case CaptureResultType.EnrollmentFailed:
                    return "enrollmentFailed";
                case CaptureResultType.VerificationSuccess:
                    return "verificationSuccess";
                case CaptureResultType.VerificationFailed:
                    return "verificationFailed";
                case CaptureResultType.IdentificationSuccess:
                    return "identificationSuccess";
                case CaptureResultType.IdentificationFailed:
                    return "identificationFailed";
                default:
                    return type.ToString().ToLower();
            }
        }

        private async Task HandleFingerDetected(string message)
        {
            Console.WriteLine($"[FINGER] {message}");
            await NotifyStatus("fingerTouch", message);
        }

        public bool IsReaderConnected() => _reader != null && _reader.IsConnected;

        public string GetCurrentOperation() => _reader?.IsCapturing == true ? "Capturing" : "None";

        public List<string> GetEnrolledUsers() => _enrolledTemplates.Keys.ToList();

        public string GetReaderInfo()
        {
            if (_reader == null) return "No reader";
            return $"{_reader.ReaderBrand} {_reader.DeviceModel}";
        }

        public string GetReaderSerialNumber()
        {
            return _reader?.SerialNumber;
        }

        public string GetReaderModel()
        {
            return _reader?.DeviceModel;
        }

        private async Task NotifyStatus(string status, string message)
        {
            if (OnStatusChanged != null)
                await OnStatusChanged(status, message);
        }

        private async Task NotifyEnrollProgress(int collected, int required)
        {
            if (OnEnrollProgress != null)
                await OnEnrollProgress(collected, required);
        }

        private async Task NotifyCaptureComplete(string result, string userId, int? score, string templateBase64)
        {
            if (OnCaptureComplete != null)
                await OnCaptureComplete(result, userId, score, templateBase64);
        }

        public void Dispose()
        {
            _readerCheckTimer?.Dispose();
            _reader?.Dispose();
        }
    }
}
