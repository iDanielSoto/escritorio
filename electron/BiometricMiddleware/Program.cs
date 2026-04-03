using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using BiometricMiddleware.Adapters;

namespace BiometricMiddleware
{
    class Program
    {
        private static HttpListener _httpListener;
        private static List<WebSocketConnection> _connections = new List<WebSocketConnection>();
        private static FingerprintManager _fingerprintManager;
        private static string _authToken = null; // Token de autenticación desde Electron

        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            // Parsear argumentos de línea de comandos
            foreach (var arg in args)
            {
                if (arg.StartsWith("--token="))
                {
                    _authToken = arg.Substring(8);
                    Console.WriteLine($"[AUTH] Token de autenticación configurado");
                }
            }

            if (string.IsNullOrEmpty(_authToken))
            {
                Console.WriteLine("[WARN] No se proporcionó token de autenticación");
                Console.WriteLine("[WARN] Las conexiones no requerirán autenticación");
            }

            PrintBanner();

            _fingerprintManager = new FingerprintManager();

            // Intentar inicializar el lector (no fatal si falla)
            var readerFound = await _fingerprintManager.Initialize();

            if (!readerFound)
            {
                Console.WriteLine("\n[WARN] No se detecto lector biometrico");
                Console.WriteLine("[INFO] El servidor iniciara de todos modos");
                Console.WriteLine("[INFO] Conecta un lector y sera detectado automaticamente\n");
            }

            // Siempre iniciar el servidor WebSocket
            await StartWebSocketServer();
        }

        static void PrintBanner()
        {
            Console.WriteLine("======================================================================");
            Console.WriteLine(" BIOMETRIC MIDDLEWARE SERVER v2.0");
            Console.WriteLine(" DigitalPersona U.are.U Support");
            Console.WriteLine("======================================================================\n");
        }

        static async Task StartWebSocketServer()
        {
            string url = "http://localhost:8787/";
            _httpListener = new HttpListener();
            _httpListener.Prefixes.Add(url);

            try
            {
                _httpListener.Start();
                Console.WriteLine($"[OK] WebSocket Server: {url}");
                Console.WriteLine("Esperando conexiones...\n");

                while (true)
                {
                    var context = await _httpListener.GetContextAsync();

                    if (context.Request.IsWebSocketRequest)
                    {
                        var wsContext = await context.AcceptWebSocketAsync(null);
                        var connection = new WebSocketConnection(wsContext.WebSocket, _fingerprintManager, _authToken);

                        lock (_connections)
                        {
                            _connections.Add(connection);
                        }

                        Console.WriteLine($"[+] Nueva conexion (Total: {_connections.Count})");
                        _ = Task.Run(async () => await HandleWebSocketConnection(connection));
                    }
                    else
                    {
                        context.Response.StatusCode = 400;
                        context.Response.Close();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error en servidor: {ex.Message}");
            }
        }

        static async Task HandleWebSocketConnection(WebSocketConnection connection)
        {
            try
            {
                await connection.HandleMessages();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Error en conexion: {ex.Message}");
            }
            finally
            {
                lock (_connections)
                {
                    _connections.Remove(connection);
                }
                Console.WriteLine($"[-] Conexion cerrada (Total: {_connections.Count})");
            }
        }
    }

    public class WebSocketConnection
    {
        private readonly WebSocket _webSocket;
        private readonly FingerprintManager _fingerprintManager;
        private static readonly HttpClient _httpClient = new HttpClient();
        
        // Token de autenticación y estado
        private readonly string _expectedToken;
        private bool _authenticated = false;

        // Caché estática de templates - compartida entre todas las conexiones
        private static Dictionary<string, byte[]> _templatesCache = null;
        private static string _cachedApiUrl = null;
        private static string _cachedEmpresaId = null;
        private static DateTime _cacheLoadedAt = DateTime.MinValue;
        private static readonly object _cacheLock = new object();
        private static readonly TimeSpan CACHE_TTL = TimeSpan.FromMinutes(5);

        public WebSocketConnection(WebSocket webSocket, FingerprintManager fingerprintManager, string authToken)
        {
            _webSocket = webSocket;
            _fingerprintManager = fingerprintManager;
            _expectedToken = authToken;
            
            // Si no hay token configurado, considerar autenticado automáticamente
            _authenticated = string.IsNullOrEmpty(authToken);

            _fingerprintManager.OnStatusChanged += SendStatusUpdate;
            _fingerprintManager.OnEnrollProgress += SendEnrollProgress;
            _fingerprintManager.OnCaptureComplete += SendCaptureComplete;
            _fingerprintManager.OnReaderConnectionChanged += SendReaderConnectionChanged;
        }

        private async Task SendReaderConnectionChanged(bool connected)
        {
            // Invalidar caché cuando el lector se reconecta para forzar datos frescos
            if (connected)
            {
                lock (_cacheLock)
                {
                    if (_cacheLoadedAt != DateTime.MinValue)
                    {
                        Console.WriteLine("[CACHE] Lector reconectado - caché invalidado para próxima identificación");
                        _cacheLoadedAt = DateTime.MinValue; // Forzar expiración
                    }
                }
            }

            await SendMessage(new
            {
                type = "readerConnection",
                connected,
                readerSerialNumber = _fingerprintManager.GetReaderSerialNumber(),
                readerModel = _fingerprintManager.GetReaderModel(),
                message = connected ? "Lector conectado - Digital Persona" : "Lector desconectado",
                timestamp = DateTime.Now
            });
        }

        public async Task HandleMessages()
        {
            var buffer = new byte[4096];

            while (_webSocket.State == WebSocketState.Open)
            {
                var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                    break;
                }

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await ProcessMessage(message);
            }
        }

        private async Task ProcessMessage(string message)
        {
            try
            {
                var request = JsonConvert.DeserializeObject<WebSocketRequest>(message);
                Console.WriteLine($"[CMD] {request.Command}");

                switch (request.Command)
                {
                    case "auth":
                        // Comando de autenticación - siempre permitido
                        await HandleAuth(request.Token);
                        break;

                    case "startEnrollment":
                        if (!RequireAuth()) return;
                        await _fingerprintManager.StartEnrollment(request.UserId);
                        break;

                    case "cancelEnrollment":
                        if (!RequireAuth()) return;
                        _fingerprintManager.CancelEnrollment();
                        break;

                    case "startVerification":
                        if (!RequireAuth()) return;
                        await _fingerprintManager.StartVerification(request.UserId);
                        break;

                    case "startIdentification":
                        if (!RequireAuth()) return;
                        await StartIdentificationWithDbTemplates(request.ApiUrl, request.EmpresaId);
                        break;

                    case "reloadTemplates":
                        if (!RequireAuth()) return;
                        await ReloadTemplatesCache(request.ApiUrl, request.EmpresaId);
                        break;

                    case "cacheStatus":
                        if (!RequireAuth()) return;
                        await SendCacheStatus();
                        break;

                    case "stopCapture":
                        if (!RequireAuth()) return;
                        _fingerprintManager.StopCapture();
                        break;

                    case "getStatus":
                        if (!RequireAuth()) return;
                        await SendStatus();
                        break;

                    case "listUsers":
                        if (!RequireAuth()) return;
                        await SendUserList();
                        break;

                    case "getReaderInfo":
                        if (!RequireAuth()) return;
                        await SendReaderInfo();
                        break;

                    default:
                        await SendError($"Comando desconocido: {request.Command}");
                        break;
                }
            }
            catch (Exception ex)
            {
                await SendError($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Maneja el comando de autenticación
        /// </summary>
        private async Task HandleAuth(string token)
        {
            if (string.IsNullOrEmpty(_expectedToken))
            {
                // No hay token configurado, autenticación no requerida
                _authenticated = true;
                Console.WriteLine("[AUTH] Autenticación no requerida (sin token configurado)");
                await SendMessage(new { type = "authResult", success = true, message = "Autenticación no requerida" });
                return;
            }

            if (token == _expectedToken)
            {
                _authenticated = true;
                Console.WriteLine("[AUTH] Conexión autenticada exitosamente");
                await SendMessage(new { type = "authResult", success = true, message = "Autenticado correctamente" });
            }
            else
            {
                _authenticated = false;
                Console.WriteLine("[AUTH] Token inválido - conexión rechazada");
                await SendMessage(new { type = "authResult", success = false, message = "Token de autenticación inválido" });
                
                // Cerrar la conexión después de un breve delay
                await Task.Delay(100);
                await _webSocket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Token inválido", CancellationToken.None);
            }
        }

        /// <summary>
        /// Verifica si la conexión está autenticada. Si no lo está, envía error.
        /// </summary>
        /// <returns>true si está autenticado, false si no</returns>
        private bool RequireAuth()
        {
            if (!_authenticated)
            {
                Console.WriteLine("[AUTH] Comando rechazado - no autenticado");
                _ = SendError("No autenticado. Envía el comando 'auth' con el token primero.");
                return false;
            }
            return true;
        }

        private async Task SendMessage(object data)
        {
            if (_webSocket.State == WebSocketState.Open)
            {
                var json = JsonConvert.SerializeObject(data);
                var bytes = Encoding.UTF8.GetBytes(json);
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        private async Task SendStatusUpdate(string status, string message)
        {
            await SendMessage(new
            {
                type = "status",
                status,
                message,
                timestamp = DateTime.Now
            });
        }

        private async Task SendEnrollProgress(int samplesCollected, int samplesRequired)
        {
            await SendMessage(new
            {
                type = "enrollProgress",
                samplesCollected,
                samplesRequired,
                percentage = (samplesCollected * 100) / samplesRequired
            });
        }

        private async Task SendCaptureComplete(string result, string userId, int? matchScore, string templateBase64)
        {
            await SendMessage(new
            {
                type = "captureComplete",
                result,
                userId,
                matchScore,
                templateBase64,
                timestamp = DateTime.Now
            });
        }

        private async Task SendStatus()
        {
            await SendMessage(new
            {
                type = "systemStatus",
                readerConnected = _fingerprintManager.IsReaderConnected(),
                currentOperation = _fingerprintManager.GetCurrentOperation(),
                readerInfo = _fingerprintManager.GetReaderInfo(),
                readerSerialNumber = _fingerprintManager.GetReaderSerialNumber(),
                readerModel = _fingerprintManager.GetReaderModel(),
                version = "2.0.0"
            });
        }

        private async Task SendUserList()
        {
            var users = _fingerprintManager.GetEnrolledUsers();
            await SendMessage(new
            {
                type = "userList",
                users,
                count = users.Count
            });
        }

        private async Task SendReaderInfo()
        {
            await SendMessage(new
            {
                type = "readerInfo",
                info = _fingerprintManager.GetReaderInfo(),
                connected = _fingerprintManager.IsReaderConnected()
            });
        }

        private async Task SendError(string error)
        {
            await SendMessage(new
            {
                type = "error",
                message = error,
                timestamp = DateTime.Now
            });
        }

        private async Task StartIdentificationWithDbTemplates(string apiUrl, string empresaId)
        {
            try
            {
                if (string.IsNullOrEmpty(apiUrl))
                {
                    await SendError("API URL no proporcionada");
                    return;
                }

                Dictionary<string, byte[]> templates;
                bool useCachedTemplates = false;
                bool cacheExpired = false;

                // Verificar si ya tenemos templates en caché
                lock (_cacheLock)
                {
                    if (_templatesCache != null && _templatesCache.Count > 0 && _cachedApiUrl == apiUrl && _cachedEmpresaId == empresaId)
                    {
                        templates = _templatesCache;
                        useCachedTemplates = true;
                        
                        // Verificar si el caché expiró (TTL)
                        var cacheAge = DateTime.Now - _cacheLoadedAt;
                        cacheExpired = cacheAge > CACHE_TTL;
                        
                        Console.WriteLine($"[CACHE] Usando {templates.Count} templates en caché " +
                            $"(edad: {cacheAge.TotalMinutes:F1} min, expirado: {cacheExpired})");
                    }
                    else
                    {
                        templates = null;
                    }
                }

                // Si usamos caché, iniciar identificación (fuera del lock)
                if (useCachedTemplates && templates != null)
                {
                    // Si el caché expiró, recargar en background (no bloquea la identificación actual)
                    if (cacheExpired)
                    {
                        var apiUrlCopy = apiUrl; // Capturar para el closure
                        var empresaIdCopy = empresaId;
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                Console.WriteLine("[CACHE] Recargando en background (TTL expirado)...");
                                var newTemplates = await LoadTemplatesFromApi(apiUrlCopy, empresaIdCopy);
                                
                                if (newTemplates != null && newTemplates.Count > 0)
                                {
                                    lock (_cacheLock)
                                    {
                                        _templatesCache = newTemplates;
                                        _cachedApiUrl = apiUrlCopy;
                                        _cachedEmpresaId = empresaIdCopy;
                                        _cacheLoadedAt = DateTime.Now;
                                    }
                                    
                                    // Pre-deserializar los nuevos templates
                                    _fingerprintManager.PreloadTemplates(newTemplates);
                                    
                                    Console.WriteLine($"[CACHE] Background reload completado: {newTemplates.Count} templates");
                                    
                                    // Notificar al cliente que el caché fue actualizado
                                    await SendMessage(new
                                    {
                                        type = "cacheReloaded",
                                        reason = "TTL expired",
                                        templatesCount = newTemplates.Count,
                                        loadedAt = DateTime.Now
                                    });
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[CACHE] Error en background reload: {ex.Message}");
                            }
                        });
                    }
                    
                    await SendStatusUpdate("identifying", $"Coloca tu dedo en el lector ({templates.Count} usuarios)");
                    await _fingerprintManager.StartIdentificationWithTemplates(templates);
                    return;
                }

                // Si no hay caché, cargar desde la API
                templates = await LoadTemplatesFromApi(apiUrl, empresaId);

                if (templates == null || templates.Count == 0)
                {
                    return; // Error ya fue enviado por LoadTemplatesFromApi
                }

                // Guardar en caché
                lock (_cacheLock)
                {
                    _templatesCache = templates;
                    _cachedApiUrl = apiUrl;
                    _cachedEmpresaId = empresaId;
                    _cacheLoadedAt = DateTime.Now;
                }

                // Pre-deserializar templates para identificación más rápida
                _fingerprintManager.PreloadTemplates(templates);

                Console.WriteLine($"[OK] {templates.Count} templates cargados y guardados en caché\n");
                await SendStatusUpdate("identifying", $"Coloca tu dedo en el lector ({templates.Count} usuarios)");

                await _fingerprintManager.StartIdentificationWithTemplates(templates);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] {ex.Message}");
                await SendError($"Error cargando huellas: {ex.Message}");
            }
        }

        private async Task ReloadTemplatesCache(string apiUrl, string empresaId)
        {
            try
            {
                if (string.IsNullOrEmpty(apiUrl))
                {
                    await SendError("API URL no proporcionada para recargar caché");
                    return;
                }

                Console.WriteLine("[CACHE] Recargando templates desde la API...");
                await SendStatusUpdate("reloading", "Recargando huellas registradas...");

                // Cargar nuevos templates
                var templates = await LoadTemplatesFromApi(apiUrl, empresaId);

                if (templates == null || templates.Count == 0)
                {
                    return; // Error ya fue enviado
                }

                // Actualizar caché
                lock (_cacheLock)
                {
                    _templatesCache = templates;
                    _cachedApiUrl = apiUrl;
                    _cachedEmpresaId = empresaId;
                    _cacheLoadedAt = DateTime.Now;
                }

                // Pre-deserializar templates para identificación más rápida
                _fingerprintManager.PreloadTemplates(templates);

                Console.WriteLine($"[CACHE] Caché actualizado: {templates.Count} templates\n");

                await SendMessage(new
                {
                    type = "cacheReloaded",
                    templatesCount = templates.Count,
                    loadedAt = _cacheLoadedAt,
                    message = $"Caché actualizado con {templates.Count} templates"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] ReloadTemplatesCache: {ex.Message}");
                await SendError($"Error recargando caché: {ex.Message}");
            }
        }

        private async Task SendCacheStatus()
        {
            lock (_cacheLock)
            {
                var status = new
                {
                    type = "cacheStatus",
                    hasCache = _templatesCache != null && _templatesCache.Count > 0,
                    templatesCount = _templatesCache?.Count ?? 0,
                    apiUrl = _cachedApiUrl,
                    loadedAt = _cacheLoadedAt != DateTime.MinValue ? _cacheLoadedAt.ToString("yyyy-MM-dd HH:mm:ss") : null
                };

                SendMessage(status).Wait();
            }
        }

        private async Task<Dictionary<string, byte[]>> LoadTemplatesFromApi(string apiUrl, string empresaId)
        {
            // Usar el endpoint público de credenciales
            string queryParams = !string.IsNullOrEmpty(empresaId) ? $"?empresa_id={empresaId}" : "";
            string fullUrl = $"{apiUrl}/credenciales/publico/lista{queryParams}";
            Console.WriteLine($"[API] Solicitando templates: {fullUrl}");
            await SendStatusUpdate("loading", "Cargando huellas registradas...");

            var response = await _httpClient.GetAsync(fullUrl);

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[API] Error: {response.StatusCode}");
                await SendError($"Error HTTP: {response.StatusCode}");
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            var result = JsonConvert.DeserializeObject<CredencialesResponse>(json);

            if (result?.Data == null || result.Data.Count == 0)
            {
                Console.WriteLine("[API] No hay credenciales registradas");
                await SendError("No hay huellas registradas en el sistema");
                return null;
            }

            // Filtrar solo los que tienen huella dactilar
            var usuariosConHuella = result.Data.FindAll(c => c.TieneDactilar);

            if (usuariosConHuella.Count == 0)
            {
                Console.WriteLine("[API] No hay usuarios con huella dactilar");
                await SendError("No hay huellas dactilares registradas en el sistema");
                return null;
            }

            Console.WriteLine($"[API] {usuariosConHuella.Count} usuarios con huella encontrados");

            var templates = new Dictionary<string, byte[]>();

            foreach (var credencial in usuariosConHuella)
            {
                try
                {
                    // Obtener el template del empleado (ruta pública)
                    string itemQueryParams = !string.IsNullOrEmpty(empresaId) ? $"?empresa_id={empresaId}" : "";
                    string itemUrl = $"{apiUrl}/credenciales/publico/dactilar/{credencial.EmpleadoId}{itemQueryParams}";
                    Console.WriteLine($"   [FETCH] {itemUrl}");
                    var templateResponse = await _httpClient.GetAsync(itemUrl);

                    if (templateResponse.IsSuccessStatusCode)
                    {
                        var templateJson = await templateResponse.Content.ReadAsStringAsync();
                        var templateResult = JsonConvert.DeserializeObject<DactilarResponse>(templateJson);

                        if (templateResult?.Success == true && templateResult?.Data?.Dactilar != null)
                        {
                            var templateBytes = Convert.FromBase64String(templateResult.Data.Dactilar);
                            templates[$"emp_{credencial.EmpleadoId}"] = templateBytes;
                            Console.WriteLine($"   [OK] emp_{credencial.EmpleadoId}: {templateBytes.Length} bytes");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"   [ERROR] emp_{credencial.EmpleadoId}: {ex.Message}");
                }
            }

            if (templates.Count == 0)
            {
                await SendError("No se pudieron cargar los templates");
                return null;
            }

            return templates;
        }
    }

    // DTO Classes
    public class WebSocketRequest
    {
        public string Command { get; set; }
        public string UserId { get; set; }
        
        [JsonProperty("token")]
        public string Token { get; set; }

        [JsonProperty("apiUrl")]
        public string ApiUrl { get; set; }

        [JsonProperty("empresaId")]
        public string EmpresaId { get; set; }
    }

    // Respuesta del endpoint GET /api/credenciales
    public class CredencialesResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("data")]
        public List<Credencial> Data { get; set; }
    }

    public class Credencial
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("empleado_id")]
        public string EmpleadoId { get; set; }

        [JsonProperty("tiene_dactilar")]
        public bool TieneDactilar { get; set; }

        [JsonProperty("tiene_facial")]
        public bool TieneFacial { get; set; }

        [JsonProperty("tiene_pin")]
        public bool TienePin { get; set; }

        [JsonProperty("empleado_nombre")]
        public string EmpleadoNombre { get; set; }
    }

    // Respuesta del endpoint GET /api/credenciales/empleado/:id/dactilar
    public class DactilarResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("data")]
        public DactilarData Data { get; set; }
    }

    public class DactilarData
    {
        [JsonProperty("dactilar")]
        public string Dactilar { get; set; }
    }
}
