# Transición a GitHub Releases (Auto-Updater Profesional)

Migrar el almacenamiento y distribución de las actualizaciones a la infraestructura global de GitHub es la decisión más acertada para aplicaciones que rozan el Medio Gigabyte (500MB). Esto eliminará la carga de tu servidor Node.js, garantizará velocidades de descarga mundiales insuperables (usando los CDN de GitHub) y automatizará totalmente la publicación de los instaladores.

## ¿Cómo cambia la arquitectura?
- **El Backend Node.js:** Ya no alojará archivos de medio gigabyte. Se liberará del 100% de ese estrés. Eliminaremos el endpoint problemático de subida.
- **El Panel Web Admin:** Cambiará su función. Ya no te pedirá que arrastres u subas los 500MB desde el navegador cerrado. En su lugar, simplemente "Avisará" visualmente obteniendo datos técnicos en tiempo real de tu cuenta de GitHub (ej. "Versión 1.0.1 publicada hace 3 horas vía GitHub").
- **El Kiosko (Desktop App):** Usará el adaptador interno más potente de `electron-updater` que se conecta a los repositorios de código directamente.

## Decisiones Arquitectónicas Confirmadas

> [!NOTE]
> **Repositorio:** `iDanielSoto/escritorio`
> **Visibilidad:** Público
>
> 🔹 **Mantenerlo Público:** Dado que decides dejarlo público por ahora, la configuración en la otra IA (Kiosko) será trivialmente sencilla. Cualquier terminal del mundo que tenga el software cliente puede rastrear la versión más reciente consultando GitHub y descargándola con cero configuración de autorizaciones ocultas o tokens mágicos en el código. Esto facilita el desarrollo enormemente a costa de abrir tu código al público cibernauta (una compensación aceptable en esta fase temprana).

---

## Fases de Implementación Propuestas

### Fase 1: Limpieza del Servidor y Refactorización del Admin Kiosko (API y Panel Web)
En lugar de subir versiones, el modal `UpdatesModal.jsx` leerá la API pública de GitHub.
1. **[DELETE]** `api/src/middlewares/updateUpload.js`
2. **[MODIFY]** `api/src/controllers/updates.controller.js` (Solo se guardará código si se va a privatizar luego).
3. **[MODIFY]** `frontend/apps/admin/src/pages/Dispositivos.jsx` y `UpdatesModal.jsx`
   * Implementaremos un diseño elegante que se conecta a: 
   `GET https://api.github.com/repos/iDanielSoto/escritorio/releases/latest`
   * Si hay versión, te mostrará amablemente la versión y peso. Pero te dirá explícitamente: "Sube las actualizaciones directamente desde el Kiosko Developer."

### Fase 2: Configuración del Agente Publicador de Kiosko (Para el Chat de Escritorio)
Cosas que tendrás que decirle a tú otro agente (React/Electron):
1. **Configuración de Builder (`package.json` de Escritorio):**
   Aporta esta configuración a tu robot local:
   ```json
   "build": {
     "publish": [{
       "provider": "github",
       "owner": "iDanielSoto",
       "repo": "escritorio"
     }]
   }
   ```
2. **El Comando Mágico de Publicación:** En lugar de ti generar un instalador web manualmente, crear una script `"release": "electron-builder -p always"`. 
   * Al ejecutar este comando en tu propia computadora, Electron **automáticamente compila los 500MB**, sube el archivo por sí mismo a los servidores encriptados de GitHub, crea la etiqueta de Git y construye la rama de "Lanzamiento" (`Latest.yml`). Absolutamente sin pasar por navegadores, evadiendo fallos de "Red".
3. **Variables Entorno de Desarrollador:** Tendrás que emitirte un `GH_TOKEN` desde las Opciones de Desarrollador en GitHub y ponerlo de manera local en un archivo para darle "licencia" y Autorización al terminal de tu PC de publicar repositorios pesados.

### Fase 3: Auto-Updater Inteligente (Kiosko Local)
Adentros del Kiosko de Electron, la adaptación en `main.js`:
```javascript
const { autoUpdater } = require('electron-updater');

// Solo si tu repo es PRIVADO:
// autoUpdater.requestHeaders = { "Authorization": "token TU_PAT_TOKEN_GITHUB" };

autoUpdater.checkForUpdatesAndNotify();
```
El Agente Kiosko continuará enviando mensajes de `download-progress` al frontend visual para pintar la gráfica y barra de color impecablemente.

---

## Plan Aprobado y Listo

Basado en tus elecciones (GitHub y Público `iDanielSoto/escritorio`), el proceso ha sido adaptado. Todo está dispuesto para ejecutar la Fase 1.
