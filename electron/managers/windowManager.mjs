import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajustar rutas relativas desde electron/managers
const ELECTRON_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(ELECTRON_ROOT, "..");

// ==========================================
// CONFIGURACIÓN DE MODO KIOSCO Y DEBUG
// ==========================================
// Cambiar a false para depurar sin pantalla completa o true para producción
export const FORCE_KIOSK = process.env.NODE_ENV !== "development";
// Cambiar a true para permitir DevTools en producción si es necesario
export const ALLOW_DEV_TOOLS = true;
// ==========================================

let mainWindow = null;

export function getMainWindow() {
    return mainWindow;
}

// Función para crear la ventana principal
export function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        kiosk: FORCE_KIOSK,              // ACTIVA MODO KIOSCO (si es true)
        alwaysOnTop: false,       // Opcional: true si quieres que nada se ponga encima
        fullscreen: FORCE_KIOSK,  // Asegura pantalla completa (si es true)
        frame: !FORCE_KIOSK,      // Elimina barras de título si es Kiosk, las muestra si no
        webPreferences: {
            devTools: ALLOW_DEV_TOOLS,      // Habilita o deshabilita DevTools según la bandera
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(ELECTRON_ROOT, "preload.cjs"),
            enableWebSQL: false,
            v8CacheOptions: "code",
            // Mejorar rendimiento de video
            backgroundThrottling: false,
            // Deshabilitar seguridad web para permitir CORS en desarrollo
            webSecurity: process.env.NODE_ENV !== "development" ? true : false,
        },
        backgroundColor: "#ffffff",
        show: false, // No mostrar hasta que esté listo
        autoHideMenuBar: FORCE_KIOSK, // Ocultar el menú automáticamente si es Kiosco
        icon: app.isPackaged
            ? path.join(process.resourcesPath, "public", "logo.ico")
            : path.join(PROJECT_ROOT, "public", "logo.ico")
    });

    // Eliminar el menú de la aplicación por completo si es Kiosk
    if (FORCE_KIOSK) {
        mainWindow.setMenu(null);
    }

    // Cargar la aplicación
    if (process.env.NODE_ENV === "development") {
        // En desarrollo, cargar desde el servidor de desarrollo de Vite
        mainWindow.loadURL("http://localhost:5174");
        // Abrir DevTools solo si se necesita para debugging
        // mainWindow.webContents.openDevTools();
    } else {
        // En producción, cargar el archivo index.html compilado desde la app empaquetada
        const indexPath = path.join(app.getAppPath(), "dist", "index.html");

        mainWindow.loadFile(indexPath).catch((err) => {
            console.error("[ERROR] Error cargando index.html:", err);
        });
    }

    // Mostrar cuando esté listo para evitar flash
    mainWindow.once("ready-to-show", () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    // Log de errores de carga
    mainWindow.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription) => {
            console.error("[ERROR] Error de carga:", errorCode, errorDescription);
        },
    );

    // Emitted when the window is closed.
    mainWindow.on("closed", function () {
        mainWindow = null;
    });

    return mainWindow;
}

// Control de ventana
export function minimizeWindow() {
    if (mainWindow) mainWindow.minimize();
}

export function maximizeWindow() {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    }
}

export function closeWindow() {
    if (mainWindow) mainWindow.close();
}

export function isMaximized() {
    return mainWindow ? mainWindow.isMaximized() : false;
}
