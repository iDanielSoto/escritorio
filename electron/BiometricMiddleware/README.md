# 🏗️ Arquitectura Multi-Marca del BiometricMiddleware

## 📐 Estructura del Proyecto

```
BiometricMiddleware/
├── Adapters/
│   ├── IFingerprintReader.cs          ← Interfaz base (CONTRATO)
│   ├── DigitalPersonaAdapter.cs       ← Implementación completa ✅
│   ├── SecuGenAdapter.cs              ← Placeholder (listo para implementar)
│   └── (futuras marcas aquí)
│
├── FingerprintManager.cs              ← Orquestador principal
├── ReaderFactory.cs                   ← Auto-detección de lectores
├── Program.cs                         ← WebSocket server
├── BiometricMiddleware.csproj
└── BiometricMiddleware.sln
```

---

## 🎯 Concepto de la Arquitectura

### 1. **IFingerprintReader** - La Interfaz Universal

Todos los lectores, sin importar la marca, deben implementar esta interfaz:

```csharp
public interface IFingerprintReader
{
    // Propiedades
    string ReaderBrand { get; }      // "DigitalPersona", "SecuGen", etc.
    string DeviceModel { get; }
    string SerialNumber { get; }
    bool IsConnected { get; }
    bool IsCapturing { get; }

    // Eventos
    event Func<string, string, Task> OnStatusChanged;
    event Func<int, int, Task> OnEnrollProgress;
    event Func<CaptureResult, Task> OnCaptureComplete;

    // Métodos
    Task<bool> Initialize();
    Task StartEnrollment(string userId);
    void CancelEnrollment();
    Task StartVerification(string userId, byte[] template);
    Task StartIdentification(Dictionary<string, byte[]> templates);
    void StopCapture();
}
```

**Ventajas:**

- ✅ Código cliente no depende de marca específica
- ✅ Fácil agregar nuevas marcas sin modificar el core
- ✅ Testing simplificado (mocks de la interfaz)
- ✅ Intercambio de lectores en runtime

---

### 2. **ReaderFactory** - Auto-detección Inteligente

```csharp
// Auto-detecta qué lector está conectado
IFingerprintReader reader = await ReaderFactory.AutoDetectReader();

// O crea uno específico
IFingerprintReader dp = await ReaderFactory.CreateReader("DigitalPersona");
```

**Flujo de detección:**

1. Intenta inicializar `DigitalPersonaAdapter`
2. Si falla, intenta `SecuGenAdapter`
3. Si falla, intenta `ZKTecoAdapter`
4. Retorna el primero que se conecte exitosamente

---

### 3. **FingerprintManager** - Orquestador

No sabe qué marca de lector está usando, solo trabaja con la interfaz:

```csharp
private IFingerprintReader _reader;  // Puede ser cualquier marca

public async Task StartEnrollment(string userId)
{
    // Funciona con cualquier adaptador
    await _reader.StartEnrollment(userId);
}
```

---

## 🔧 Cómo Agregar un Nuevo Adaptador

### Ejemplo: Agregar SecuGen

#### Paso 1: Instalar SDK

```bash
# Descargar de: https://www.secugen.com/support/downloads/
# Instalar: FDx SDK Pro for Windows
```

#### Paso 2: Agregar Referencia en .csproj

```xml
<Reference Include="SecuGen.FDxSDKPro.Windows">
  <HintPath>C:\Program Files\SecuGen\FDx SDK Pro\bin\SecuGen.FDxSDKPro.Windows.dll</HintPath>
  <Private>True</Private>
</Reference>
```

#### Paso 3: Implementar SecuGenAdapter

```csharp
using SecuGen.FDxSDKPro.Windows;

public class SecuGenAdapter : IFingerprintReader
{
    private SGFPMDevice _device;

    public string ReaderBrand => "SecuGen";
    public string DeviceModel { get; private set; }
    public string SerialNumber { get; private set; }
    public bool IsConnected { get; private set; }
    public bool IsCapturing { get; private set; }

    // Eventos obligatorios
    public event Func<string, string, Task> OnStatusChanged;
    public event Func<int, int, Task> OnEnrollProgress;
    public event Func<CaptureResult, Task> OnCaptureComplete;
    // ...

    public async Task<bool> Initialize()
    {
        try
        {
            _device = new SGFPMDevice();

            // Detectar dispositivos SecuGen
            SGFPMDeviceName[] devices = _device.GetDeviceList();

            if (devices.Length == 0)
            {
                IsConnected = false;
                return false;
            }

            // Abrir primer dispositivo
            _device.Open(devices[0]);

            DeviceModel = devices[0].DeviceName;
            SerialNumber = _device.GetSerialNumber();
            IsConnected = true;

            return true;
        }
        catch
        {
            IsConnected = false;
            return false;
        }
    }

    public async Task StartEnrollment(string userId)
    {
        // Capturar múltiples imágenes
        List<byte[]> samples = new List<byte[]>();

        for (int i = 0; i < 4; i++)
        {
            byte[] imageData = _device.GetImage();
            samples.Add(imageData);

            await OnEnrollProgress?.Invoke(i + 1, 4);
        }

        // Crear template
        byte[] template = _device.CreateTemplate(samples);

        // Notificar éxito
        var result = new CaptureResult
        {
            ResultType = CaptureResultType.EnrollmentSuccess,
            UserId = userId,
            Template = template
        };

        await OnCaptureComplete?.Invoke(result);
    }

    public async Task StartVerification(string userId, byte[] template)
    {
        // Capturar imagen actual
        byte[] currentImage = _device.GetImage();

        // Comparar con template
        int matchScore = _device.MatchTemplate(currentImage, template);
        bool verified = matchScore > THRESHOLD;

        var result = new CaptureResult
        {
            ResultType = verified
                ? CaptureResultType.VerificationSuccess
                : CaptureResultType.VerificationFailed,
            UserId = userId,
            MatchScore = matchScore
        };

        await OnCaptureComplete?.Invoke(result);
    }

    // Implementar resto de métodos...
}
```

#### Paso 4: Registrar en ReaderFactory

```csharp
// En ReaderFactory.cs, agregar al método AutoDetectReader:

var adapters = new List<IFingerprintReader>
{
    new DigitalPersonaAdapter(),
    new SecuGenAdapter(),        // ← AGREGAR AQUÍ
    new ZKTecoAdapter(),
};
```

**¡Listo!** El sistema ahora detectará automáticamente SecuGen.

---

## 📋 Checklist para Nuevas Marcas

Cuando agregues un nuevo adaptador, asegúrate de:

- [ ] Implementar `IFingerprintReader` completo
- [ ] Mapear eventos del SDK a eventos de la interfaz
- [ ] Convertir formato de template al formato estándar (byte[])
- [ ] Implementar `Initialize()` con detección de dispositivos
- [ ] Implementar enrollment con progreso
- [ ] Implementar verificación 1:1
- [ ] Implementar identificación 1:N
- [ ] Agregar al `ReaderFactory`
- [ ] Actualizar .csproj con referencias DLL
- [ ] Documentar particularidades del SDK

---

## 🎨 Ejemplo de Uso

### Cliente WebSocket (React/Electron)

```javascript
// El cliente no sabe qué marca es, solo envía comandos estándar
ws.send(
  JSON.stringify({
    command: "startEnrollment",
    userId: "empleado001",
  })
);

// Recibe respuestas estándar
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "enrollProgress":
      console.log(`${data.samplesCollected}/${data.samplesRequired}`);
      break;

    case "captureComplete":
      if (data.result === "enrollmentSuccess") {
        console.log(`✅ ${data.userId} registrado`);
      }
      break;
  }
};
```

**¡El frontend nunca necesita saber qué marca de lector se está usando!**

---

## 🔄 Flujo de Operación

### Enrollment (Registro)

```
[Cliente React]
    │
    │ 1. startEnrollment(userId)
    ▼
[WebSocket Server]
    │
    │ 2. Forward to FingerprintManager
    ▼
[FingerprintManager]
    │
    │ 3. _reader.StartEnrollment(userId)
    ▼
[Adaptador (DP/SG/ZK)]
    │
    │ 4. Captura muestras del lector físico
    │ 5. OnEnrollProgress (1/4, 2/4, 3/4, 4/4)
    │ 6. Crea template
    │ 7. OnCaptureComplete(result)
    ▼
[FingerprintManager]
    │
    │ 8. Guarda template en disco
    │ 9. Notifica a WebSocket
    ▼
[Cliente React]
    │
    │ 10. Muestra "✅ Usuario registrado"
```

---

## 🛡️ Ventajas de Esta Arquitectura

### 1. **Extensibilidad**

- Agregar nuevas marcas sin tocar código existente
- Solo implementar nueva clase de adaptador

### 2. **Mantenibilidad**

- Cada adaptador es independiente
- Bugs en un adaptador no afectan a otros

### 3. **Testabilidad**

```csharp
// Crear mock del lector para testing
public class MockReader : IFingerprintReader
{
    public async Task<bool> Initialize() => true;
    public async Task StartEnrollment(string userId)
    {
        // Simular captura exitosa
        await Task.Delay(1000);
        await OnCaptureComplete(new CaptureResult
        {
            ResultType = CaptureResultType.EnrollmentSuccess,
            UserId = userId
        });
    }
}
```

### 4. **Flexibilidad**

```csharp
// Cambiar de lector en runtime
if (currentReader.Brand == "DigitalPersona" && !currentReader.IsConnected)
{
    // Intentar con SecuGen como fallback
    currentReader = await ReaderFactory.CreateReader("SecuGen");
}
```

---

## 📊 Estado Actual del Proyecto

| Marca          | Estado         | SDK Requerido | Notas                               |
| -------------- | -------------- | ------------- | ----------------------------------- |
| DigitalPersona | ✅ Completo    | One Touch SDK | Listo para producción               |
| SecuGen        | 🚧 Placeholder | FDx SDK Pro   | Estructura lista, falta implementar |
| ZKTeco         | ⏳ Pendiente   | ZKFinger SDK  | Crear clase adaptador               |
| Suprema        | ⏳ Pendiente   | BioStar SDK   | Crear clase adaptador               |
| Futronic       | ⏳ Pendiente   | FS SDK        | Crear clase adaptador               |

---

## 🎯 Próximos Pasos

1. **Implementar SecuGenAdapter** (cuando tengas el SDK)
2. **Agregar ZKTecoAdapter** (popular en LATAM)
3. **Crear sistema de plugins** (cargar adaptadores dinámicamente)
4. **Agregar logging estructurado** (Serilog)
5. **Implementar caché de templates** (Redis)
6. **Crear dashboard de administración** (Blazor)

---

## 💡 Tips de Implementación

### Conversión de Templates

Cada SDK tiene su propio formato de template. Tu adaptador debe:

```csharp
// DigitalPersona
DPFP.Template dpTemplate = enrollment.Template;
byte[] standardTemplate = dpTemplate.Bytes; // ✅ Ya es byte[]

// SecuGen
SGTemplate sgTemplate = device.CreateTemplate(images);
byte[] standardTemplate = sgTemplate.ToByteArray(); // Convertir

// ZKTeco
zkfinger.DBAdd(template);
byte[] standardTemplate = zkfinger.ExtractTemplate(); // Extraer
```

### Manejo de Eventos Asíncronos

Algunos SDKs usan callbacks síncronos:

```csharp
// DigitalPersona tiene EventHandler síncrono
public void OnComplete(object Capture, string ReaderSN, Sample Sample)
{
    // Convertir a async con Task.Run
    Task.Run(async () =>
    {
        var features = ExtractFeatures(Sample);
        await ProcessEnrollment(features);
    });
}
```

### Calidad de Imagen

Mapear el feedback de calidad:

```csharp
// DigitalPersona
if (feedback == CaptureFeedback.Good) return features;

// SecuGen
if (quality > 60) return features; // 0-100

// ZKTeco
if (quality == 1) return features; // 0=malo, 1=bueno
```

---

## 🔍 Debugging

### Logs Estructurados

```csharp
Console.WriteLine($"🔧 [{adapter.ReaderBrand}] Inicializando...");
Console.WriteLine($"✅ [{adapter.ReaderBrand}] Lector detectado");
Console.WriteLine($"❌ [{adapter.ReaderBrand}] Error: {ex.Message}");
```

### Testing de Adaptadores

```bash
# Probar solo detección
dotnet run -- --test-detection

# Probar adaptador específico
dotnet run -- --adapter DigitalPersona

# Modo verbose
dotnet run -- --verbose
```

---

## 📚 Recursos Adicionales

- [DigitalPersona SDK Docs](https://www.digitalpersona.com/documentation/)
- [SecuGen SDK Download](https://www.secugen.com/support/downloads/)
- [ZKTeco Developer Portal](https://www.zkteco.com/en/support_detail/developerService)

---

**¿Dudas sobre cómo implementar un nuevo adaptador? Revisa `DigitalPersonaAdapter.cs` como referencia completa.**
