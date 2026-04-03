# BiometricMiddleware - Código Fuente

Este directorio contiene el **código fuente completo** del BiometricMiddleware, integrado directamente en tu proyecto.

## 📋 Contenido

```
BiometricMiddleware/
├── Adapters/                          ← Adaptadores de diferentes marcas
│   ├── IFingerprintReader.cs         ← Interfaz base
│   ├── DigitalPersonaAdapter.cs      ← Implementación DigitalPersona ✅
│   └── SecuGenAdapter.cs             ← Placeholder SecuGen
├── Program.cs                         ← Servidor WebSocket
├── FingerprintManager.cs              ← Orquestador principal
├── ReaderFactory.cs                   ← Auto-detección de lectores
├── BiometricMiddleware.csproj         ← Archivo del proyecto
├── BiometricMiddleware.sln            ← Solución de Visual Studio
├── build.bat                          ← Script de compilación
└── README.md                          ← Documentación completa
```

## 🚀 Compilación Rápida

### Opción 1: Script Automático (Recomendado)

Simplemente ejecuta el script de compilación:

```bash
cd electron/BiometricMiddleware
build.bat
```

El script:
- ✅ Verifica que .NET SDK esté instalado
- ✅ Compila el proyecto
- ✅ Copia los archivos a la carpeta `bin/`
- ✅ Muestra mensajes de éxito o error

### Opción 2: Manual con dotnet CLI

```bash
cd electron/BiometricMiddleware
dotnet build BiometricMiddleware.csproj -c Release -p:Platform=x86
```

Los archivos compilados estarán en:
```
bin/Release/net48/
```

### Opción 3: Visual Studio

1. Abre `BiometricMiddleware.sln` en Visual Studio
2. Selecciona configuración: **Release | x86**
3. Presiona **Ctrl+Shift+B** para compilar
4. El ejecutable estará en `bin/Release/net48/BiometricMiddleware.exe`

## 📦 Requisitos Previos

### 1. .NET Framework 4.8

Ya viene instalado en Windows 10/11. Si no lo tienes:

👉 [Descargar .NET Framework 4.8](https://dotnet.microsoft.com/download/dotnet-framework/net48)

### 2. SDK de DigitalPersona (Opcional)

Solo necesario si usas lectores **DigitalPersona U.are.U**:

1. Descarga: [DigitalPersona One Touch SDK](https://www.digitalpersona.com/developers/)
2. Instala en: `C:\Program Files\DigitalPersona\One Touch SDK\`
3. Las DLLs necesarias ya están referenciadas en el `.csproj`

**Nota:** Si NO usas DigitalPersona, puedes comentar las referencias en el `.csproj` o simplemente ignorar los errores del adaptador.

### 3. SDK de SecuGen (Opcional)

Para usar lectores **SecuGen**:

1. Descarga: [SecuGen FDx SDK Pro](https://www.secugen.com/support/downloads/)
2. Implementa el adaptador (actualmente es un placeholder)
3. Descomenta las referencias en el `.csproj`

## 🔧 Estructura del Código

### Arquitectura Multi-Marca

El middleware usa un **patrón de adaptadores** que permite soportar múltiples marcas de lectores sin modificar el código principal:

```
┌─────────────────────────────────────┐
│   WebSocket Server (Program.cs)    │
│   Puerto 8787                       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  FingerprintManager                 │
│  (Orquestador principal)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  ReaderFactory                      │
│  (Auto-detección de lectores)       │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│  DP Adapter │  │  SG Adapter │
│  (DigitalP) │  │  (SecuGen)  │
└─────────────┘  └─────────────┘
```

### Archivos Principales

#### `Program.cs`
- Servidor WebSocket en puerto **8787**
- Maneja conexiones de clientes (React/Electron)
- Procesa comandos: `startEnrollment`, `startVerification`, etc.

#### `FingerprintManager.cs`
- Orquestador principal
- Gestiona el adaptador activo
- Guarda templates en carpeta `FingerprintTemplates/`
- Convierte templates a **Base64** para PostgreSQL

#### `ReaderFactory.cs`
- Auto-detecta qué lector está conectado
- Intenta inicializar cada adaptador en orden
- Retorna el primero que se conecte exitosamente

#### `Adapters/IFingerprintReader.cs`
- **Interfaz base** que todos los adaptadores deben implementar
- Define métodos: `Initialize()`, `StartEnrollment()`, `StartVerification()`, etc.
- Garantiza compatibilidad entre marcas

#### `Adapters/DigitalPersonaAdapter.cs`
- Implementación completa para lectores **DigitalPersona U.are.U**
- Usa el SDK oficial de DigitalPersona
- Captura 4 muestras para enrollment
- Soporta verificación (1:1) e identificación (1:N)

## 🎯 Ventajas del Código Fuente

### ✅ Mayor Control
- Puedes modificar el comportamiento del middleware
- Agregar logging personalizado
- Cambiar configuraciones (puerto, timeout, etc.)

### ✅ Debugging
- Coloca breakpoints en Visual Studio
- Inspecciona variables en tiempo real
- Rastrea errores directamente en el código

### ✅ Agregar Nuevas Marcas
Para agregar soporte para otra marca (ej. ZKTeco):

1. Crea `Adapters/ZKTecoAdapter.cs`
2. Implementa la interfaz `IFingerprintReader`
3. Agrega al `ReaderFactory.cs`
4. ¡Listo! El sistema lo detectará automáticamente

### ✅ Integración Completa
- Todo en un solo repositorio
- Sin dependencias externas (excepto SDKs de hardware)
- Fácil de versionar con Git

## 🔄 Integración con Electron

El archivo `electron/main.mjs` ya está configurado para usar el ejecutable compilado:

```javascript
const middlewarePath = path.join(__dirname, 'BiometricMiddleware', 'bin', 'BiometricMiddleware.exe');
```

### Flujo de Ejecución

1. **Electron inicia** → `app.whenReady()`
2. **Lanza el middleware** → `startBiometricMiddleware()`
3. **Middleware abre WebSocket** → `ws://localhost:8787`
4. **React se conecta** → `BiometricReader.jsx`
5. **Usuario interactúa** → Captura de huella
6. **Middleware responde** → Template Base64
7. **React guarda en BD** → PostgreSQL

## 🐛 Solución de Problemas

### Error: "BiometricMiddleware.exe no encontrado"

**Causa:** No has compilado el proyecto.

**Solución:**
```bash
cd electron/BiometricMiddleware
build.bat
```

### Error: "No se detectó ningún lector"

**Causas posibles:**
1. Lector no está conectado → Conecta el lector USB
2. Drivers no instalados → Instala drivers del fabricante
3. SDK no instalado → Instala el SDK correspondiente (DigitalPersona, SecuGen, etc.)

**Debug:**
- Verifica en "Administrador de dispositivos" que el lector esté reconocido
- Prueba el software del fabricante primero
- Revisa los logs del middleware en la consola

### Error: "DPFPShrNET.dll no encontrado"

**Causa:** SDK de DigitalPersona no está instalado o no está en la ruta esperada.

**Solución:**
1. Instala el SDK de DigitalPersona
2. O comenta las referencias en el `.csproj` si no usas DigitalPersona

### Error al compilar: "Target framework not found"

**Causa:** No tienes .NET Framework 4.8 instalado.

**Solución:**
```powershell
# Instalar .NET Framework 4.8
winget install Microsoft.DotNet.Framework.DeveloperPack_4
```

## 📝 Logs y Debugging

El middleware imprime logs detallados en la consola:

```
╔════════════════════════════════════════════════════════╗
║   🔐 BIOMETRIC MIDDLEWARE SERVER v2.0                ║
╚════════════════════════════════════════════════════════╝

🔍 AUTO-DETECCIÓN DE LECTORES
═══════════════════════════════════════
🔍 Probando: DigitalPersona...
✅ LECTOR DETECTADO: DigitalPersona
   Modelo: U.are.U 4500
   S/N: ABC12345
═══════════════════════════════════════

✅ WebSocket Server corriendo en: http://localhost:8787/
⏳ Esperando conexiones de clientes...
```

Para debugging avanzado:
1. Abre el proyecto en Visual Studio
2. Presiona **F5** para ejecutar con debugger
3. Coloca breakpoints en el código
4. Inspecciona variables y flujo de ejecución

## 🔐 Seguridad

### Templates de Huellas

Los templates se guardan en dos lugares:

1. **Archivos locales:** `FingerprintTemplates/*.fpt` (formato binario)
2. **Base de datos:** PostgreSQL (formato Base64)

**Importante:**
- Los templates NO son imágenes de huellas
- NO se pueden reconstruir en una imagen
- Son representaciones matemáticas irreversibles
- Son seguros para almacenar en bases de datos

### Permisos

El middleware requiere:
- ✅ Acceso USB (para lector de huellas)
- ✅ Permisos de red (WebSocket puerto 8787)
- ⚠️ En algunos casos, permisos de administrador (según el lector)

## 📚 Documentación Adicional

- **README.md completo:** Contiene arquitectura detallada y guías de implementación
- **Comentarios en código:** Cada clase y método está documentado
- **Ejemplos:** Ver `README.md` para ejemplos de uso

## 🤝 Contribuir

Para agregar soporte de una nueva marca:

1. Crea un nuevo adaptador en `Adapters/`
2. Implementa `IFingerprintReader`
3. Agrega al `ReaderFactory`
4. Documenta los requisitos del SDK
5. Prueba con el hardware real

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs del middleware
2. Verifica que el hardware esté funcionando
3. Consulta la documentación del SDK del fabricante
4. Revisa el código fuente para entender el flujo

---

**🎉 ¡Ahora tienes control total sobre el BiometricMiddleware!**

Puedes modificarlo, extenderlo y personalizarlo según tus necesidades. El código fuente está completamente disponible y documentado.
