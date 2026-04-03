# BiometricReader - Guía de Uso

El componente `BiometricReader` permite registrar y autenticar usuarios mediante huellas dactilares. Ahora incluye la capacidad de ingresar manualmente el ID del empleado.

## 📋 Características

- ✅ Registro de huellas (modo `enroll`)
- ✅ Autenticación por huella (modo `auth`)
- ✅ Campo manual para ingresar ID de empleado
- ✅ Guardado automático en PostgreSQL (formato BYTEA)
- ✅ Conexión WebSocket con BiometricMiddleware
- ✅ Feedback visual en tiempo real

## 🎯 Modos de Uso

### Modo 1: Registro con ID Manual (Nuevo)

Permite al usuario ingresar el ID del empleado manualmente:

```jsx
import BiometricReader from "./components/kiosk/BiometricReader";

function MiComponente() {
  const [showModal, setShowModal] = useState(false);

  const handleEnrollmentSuccess = (data) => {
    console.log("Huella registrada:", data);
    // data.userId - ID del middleware
    // data.idEmpleado - ID del empleado
    // data.idCredencial - ID de la credencial en BD
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Registrar Huella
      </button>

      <BiometricReader
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onEnrollmentSuccess={handleEnrollmentSuccess}
        mode="enroll"
        // idEmpleado={null} - NO pasar para habilitar campo manual
      />
    </>
  );
}
```

**Características:**
- El usuario verá un campo "ID del Empleado" donde puede ingresar el número
- Campo "User ID" para identificar el template en el middleware
- Validación automática de ambos campos
- Template guardado en PostgreSQL como BYTEA

### Modo 2: Registro con ID Fijo

Útil cuando ya sabes qué empleado está registrando su huella:

```jsx
<BiometricReader
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onEnrollmentSuccess={handleEnrollmentSuccess}
  mode="enroll"
  idEmpleado={123} // ID del empleado fijo
/>
```

**Características:**
- El campo de ID de empleado NO se muestra
- El ID viene del prop `idEmpleado`
- Útil para flujos donde el usuario ya está identificado

### Modo 3: Autenticación

Identifica al usuario por su huella:

```jsx
<BiometricReader
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onAuthSuccess={(usuario) => {
    console.log("Usuario identificado:", usuario);
    // Redirigir, guardar sesión, etc.
  }}
  mode="auth"
/>
```

**Características:**
- El usuario coloca su dedo en el lector
- El sistema identifica automáticamente al usuario (1:N)
- Callback `onAuthSuccess` con datos completos del empleado

## 📝 Props del Componente

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `isOpen` | boolean | false | Controla si el modal está visible |
| `onClose` | function | - | Callback cuando se cierra el modal |
| `onEnrollmentSuccess` | function | - | Callback tras registro exitoso (modo enroll) |
| `onAuthSuccess` | function | - | Callback tras autenticación exitosa (modo auth) |
| `idEmpleado` | number/null | null | ID del empleado (null = campo manual) |
| `mode` | string | "auth" | Modo: "enroll" o "auth" |

## 🔧 Estructura de Datos

### `onEnrollmentSuccess(data)`

```javascript
{
  userId: "emp_123",           // ID usado en el middleware
  idEmpleado: 123,             // ID del empleado en BD
  idCredencial: 456,           // ID de la credencial creada
  timestamp: "2024-01-09T..."  // Timestamp del registro
}
```

### `onAuthSuccess(usuario)`

```javascript
{
  id_empleado: 123,
  nombre: "Juan Pérez",
  correo: "juan@example.com",
  id_usuario: 456,
  estado: "CONECTADO",
  // ... otros campos del empleado
}
```

## 🎨 Ejemplo Completo: Modal de Registro

```jsx
import { useState } from "react";
import BiometricReader from "./BiometricReader";
import { UserPlus } from "lucide-react";

export default function EnrollFingerprintButton() {
  const [showModal, setShowModal] = useState(false);

  const handleSuccess = (data) => {
    console.log("✅ Huella registrada:", data);

    // Mostrar notificación
    alert(`Huella registrada para empleado ${data.idEmpleado}`);

    // Cerrar modal
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center gap-2"
      >
        <UserPlus className="w-5 h-5" />
        Registrar Huella
      </button>

      <BiometricReader
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onEnrollmentSuccess={handleSuccess}
        mode="enroll"
        // Sin idEmpleado = campo manual habilitado
      />
    </>
  );
}
```

## 🎨 Ejemplo Completo: Autenticación

```jsx
import { useState } from "react";
import BiometricReader from "./BiometricReader";
import { Fingerprint } from "lucide-react";

export default function BiometricLoginButton() {
  const [showModal, setShowModal] = useState(false);

  const handleAuthSuccess = (usuario) => {
    console.log("✅ Usuario identificado:", usuario);

    // Guardar sesión
    localStorage.setItem("usuario", JSON.stringify(usuario));

    // Redirigir al dashboard
    window.location.href = "/dashboard";
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2"
      >
        <Fingerprint className="w-5 h-5" />
        Iniciar con Huella
      </button>

      <BiometricReader
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAuthSuccess={handleAuthSuccess}
        mode="auth"
      />
    </>
  );
}
```

## 🔄 Flujo de Registro

1. Usuario abre el modal de registro
2. Ingresa el ID del empleado (ej: 123)
3. Ingresa un User ID para el middleware (ej: "emp_123")
4. Hace clic en "Iniciar Registro"
5. Coloca su dedo en el lector 4 veces
6. El sistema captura el template
7. **El template se guarda en PostgreSQL como BYTEA**
8. Callback `onEnrollmentSuccess` se ejecuta

## 🔍 Flujo de Autenticación

1. Usuario abre el modal de autenticación
2. Coloca su dedo en el lector
3. El sistema captura el template
4. **El template se compara con todos los de la BD**
5. Si hay match, devuelve los datos del empleado
6. Callback `onAuthSuccess` se ejecuta

## 🐛 Solución de Problemas

### "❌ No conectado al servidor"

**Causa:** El BiometricMiddleware no está corriendo.

**Solución:**
```bash
# El middleware debe iniciarse automáticamente con Electron
npm run dev
```

### "⚠️ Sin lector de huellas detectado"

**Causa:** Lector no conectado o drivers no instalados.

**Solución:**
1. Conecta el lector USB
2. Instala el SDK de DigitalPersona
3. Reinicia Electron

### "❌ No hay ID de empleado configurado"

**Causa:** Campo de ID de empleado está vacío.

**Solución:**
- Ingresa un ID válido en el campo
- O pasa el prop `idEmpleado={123}` al componente

### "❌ Error guardando en DB"

**Causa:** Backend no disponible o error de conexión.

**Solución:**
1. Verifica que el backend esté corriendo
2. Verifica la URL en `apiEndPoint.js`
3. Revisa logs del backend

## 📊 Base de Datos

El template se guarda en la tabla `credenciales`:

```sql
-- Estructura de la tabla
CREATE TABLE credenciales (
  id_credencial SERIAL PRIMARY KEY,
  id_empleado INT REFERENCES empleados(id_empleado),
  tipo_credencial VARCHAR(50),
  valor_credencial TEXT,
  huella_digital BYTEA,  -- ⭐ Template de huella en BYTEA
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

El campo `huella_digital` almacena el template como **BYTEA** (binario), convertido desde Base64.

## 🔐 Seguridad

- ✅ Templates son representaciones matemáticas irreversibles
- ✅ NO se pueden reconstruir en imágenes
- ✅ Seguros para almacenar en bases de datos
- ✅ Comunicación WebSocket local (localhost:8787)
- ✅ Backend valida todos los datos antes de guardar

## 📚 Referencias

- **BiometricReader.jsx**: [src/components/kiosk/BiometricReader.jsx](../src/components/kiosk/BiometricReader.jsx)
- **BiometricMiddleware**: [electron/BiometricMiddleware/](../electron/BiometricMiddleware/)
- **API Backend**: [Endpoints de biometría](./API_ENDPOINTS.md)

---

**¿Preguntas?** Revisa el código fuente del BiometricReader o el BiometricMiddleware para más detalles.
