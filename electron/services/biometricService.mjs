import { app } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajustar __dirname porque estamos en electron/services y los recursos están en electron/
const ELECTRON_ROOT = path.resolve(__dirname, "..");

let biometricProcess = null;
let biometricToken = null; // Token de autenticación para el middleware

/**
 * Ruta donde debe estar instalado el SDK de DigitalPersona
 */
const DIGITALPERSONA_SDK_PATH = "C:\\Program Files\\DigitalPersona\\One Touch SDK\\.NET\\Bin";
const DIGITALPERSONA_REQUIRED_DLLS = [
    "DPFPShrNET.dll",
    "DPFPDevNET.dll",
    "DPFPEngNET.dll",
    "DPFPVerNET.dll"
];

/**
 * Obtiene la ruta del BiometricMiddleware según el entorno
 * En desarrollo: electron/BiometricMiddleware/bin/
 * En producción: resources/BiometricMiddleware/
 */
export function getBiometricPath() {
    if (app.isPackaged) {
        // Producción: extraResources se copia a resources/BiometricMiddleware
        return path.join(process.resourcesPath, "BiometricMiddleware");
    } else {
        // Desarrollo: ruta relativa a electron/
        return path.join(ELECTRON_ROOT, "BiometricMiddleware", "bin");
    }
}

/**
 * Verifica si el SDK de DigitalPersona está instalado
 * @returns {Object} - { installed: boolean, missingFiles: string[], sdkPath: string }
 */
export function checkDigitalPersonaSdk() {
    const result = {
        installed: false,
        missingFiles: [],
        sdkPath: DIGITALPERSONA_SDK_PATH
    };

    // Verificar si existe el directorio del SDK
    if (!fs.existsSync(DIGITALPERSONA_SDK_PATH)) {
        console.log("[BiometricService] Info: Directorio del SDK no encontrado:", DIGITALPERSONA_SDK_PATH);
        result.missingFiles = DIGITALPERSONA_REQUIRED_DLLS;
        return result;
    }

    // Verificar cada DLL requerida
    for (const dll of DIGITALPERSONA_REQUIRED_DLLS) {
        const dllPath = path.join(DIGITALPERSONA_SDK_PATH, dll);
        if (!fs.existsSync(dllPath)) {
            result.missingFiles.push(dll);
        }
    }

    result.installed = result.missingFiles.length === 0;
    console.log("[BiometricService] Status: Estado del SDK:", result.installed ? "Instalado" : "Faltante", result.missingFiles);
    return result;
}

/**
 * Instala el SDK de DigitalPersona silenciosamente
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function installDigitalPersonaSdk() {
    return new Promise((resolve) => {
        // Ruta al instalador MSI incluido en la app
        let installerPath;

        if (app.isPackaged) {
            // Producción: el instalador está en resources
            installerPath = path.join(process.resourcesPath, "installers", "DigitalPersona_SDK_Setup.msi");
        } else {
            // Desarrollo: ruta relativa
            installerPath = path.join(ELECTRON_ROOT, "BiometricMiddleware", "installers", "DigitalPersona_SDK_Setup.msi");
        }

        console.log("[BiometricService] Action: Buscando instalador en:", installerPath);

        // Verificar que el instalador existe
        if (!fs.existsSync(installerPath)) {
            console.error("[BiometricService] Error: Instalador no encontrado:", installerPath);
            resolve({
                success: false,
                message: `Instalador no encontrado en: ${installerPath}`
            });
            return;
        }

        console.log("[BiometricService] Action: Iniciando instalacion silenciosa del MSI...");

        // Usar msiexec para instalar el MSI silenciosamente
        // /i = install, /quiet = sin UI, /norestart = no reiniciar
        const installProcess = spawn("msiexec", ["/i", installerPath, "/quiet", "/norestart"], {
            windowsHide: true,
            detached: false,
            shell: true
        });

        let installTimeout = setTimeout(() => {
            console.warn("[BiometricService] Warning: Timeout de instalacion - el proceso puede seguir en segundo plano");
            resolve({
                success: true,
                message: "Instalación iniciada. Puede tardar unos minutos."
            });
        }, 120000); // 2 minutos timeout

        installProcess.on("close", (code) => {
            clearTimeout(installTimeout);
            console.log("[BiometricService] Status: Instalador termino con codigo:", code);

            // Verificar si la instalación fue exitosa
            const checkResult = checkDigitalPersonaSdk();

            if (checkResult.installed) {
                resolve({
                    success: true,
                    message: "SDK instalado correctamente"
                });
            } else if (code === 0) {
                // El instalador terminó OK pero puede requerir reinicio
                resolve({
                    success: true,
                    message: "Instalación completada. Es posible que necesite reiniciar la aplicación."
                });
            } else {
                resolve({
                    success: false,
                    message: `La instalación terminó con código ${code}. Intente instalar manualmente.`
                });
            }
        });

        installProcess.on("error", (error) => {
            clearTimeout(installTimeout);
            console.error("[BiometricService] Error: Error en instalacion:", error.message);
            resolve({
                success: false,
                message: `Error al ejecutar instalador: ${error.message}`
            });
        });
    });
}

/**
 * Función para compilar el BiometricMiddleware si no existe el ejecutable
 * @returns {boolean} - true si el ejecutable existe o se compiló correctamente
 */
export function buildBiometricMiddlewareIfNeeded() {
    const biometricDir = getBiometricPath();
    const middlewarePath = path.join(biometricDir, "BiometricMiddleware.exe");

    // Si ya existe el ejecutable, no hacer nada
    if (fs.existsSync(middlewarePath)) {
        return true;
    }

    // En producción, el ejecutable debe existir en extraResources
    if (app.isPackaged) {
        console.error("[BiometricService] Error: BiometricMiddleware.exe no encontrado en produccion:", middlewarePath);
        return false;
    }

    console.log("[BIOMETRIC] Compilando BiometricMiddleware...");

    const middlewareDir = path.join(ELECTRON_ROOT, "BiometricMiddleware");

    // Verificar que existe el proyecto
    const csprojPath = path.join(middlewareDir, "BiometricMiddleware.csproj");
    if (!fs.existsSync(csprojPath)) {
        console.error("[BiometricService] Error: BiometricMiddleware.csproj no encontrado en:", csprojPath);
        return false;
    }

    try {

        // Ejecutar dotnet build directamente
        execSync("dotnet build BiometricMiddleware.csproj -c Release -p:Platform=x86", {
            cwd: middlewareDir,
            stdio: "inherit",
            encoding: "utf8",
        });

        // Crear carpeta bin si no existe
        const binDir = path.join(middlewareDir, "bin");
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }

        // Copiar ejecutable y DLLs (x86 porque se compila con Platform=x86)
        const releaseDir = path.join(middlewareDir, "bin", "x86", "Release", "net48");
        const exeSrc = path.join(releaseDir, "BiometricMiddleware.exe");

        if (fs.existsSync(exeSrc)) {
            fs.copyFileSync(exeSrc, middlewarePath);

            // Copiar DLLs
            const files = fs.readdirSync(releaseDir);
            for (const file of files) {
                if (file.endsWith(".dll")) {
                    fs.copyFileSync(path.join(releaseDir, file), path.join(binDir, file));
                }
            }
        }

        // Verificar que se creó el ejecutable
        if (fs.existsSync(middlewarePath)) {
            return true;
        } else {
            console.error("[BiometricService] Error: La compilacion termino pero no se creo el ejecutable");
            return false;
        }
    } catch (error) {
        console.error("[BiometricService] Error: Error al compilar BiometricMiddleware:", error.message);
        console.error("[BiometricService] Info: Asegurate de tener .NET SDK instalado");
        return false;
    }
}

/**
 * Función para iniciar el BiometricMiddleware como administrador
 * Espera a que el SDK esté instalado antes de iniciar
 */
export async function startBiometricMiddleware() {
    if (biometricProcess) {
        console.log("[BiometricService] Info: BiometricMiddleware ya está en ejecución.");
        return;
    }

    try {
        const sdkStatus = checkDigitalPersonaSdk();

        if (!sdkStatus.installed) {
            console.warn("[BiometricService] Warning: SDK no instalado. El servidor biométrico no puede iniciar. Ejecute el instalador de la app.");
            return;
        }

        console.log("[BiometricService] Info: SDK validado correctamente, continuando...");

        // Compilar si es necesario
        if (!buildBiometricMiddlewareIfNeeded()) {
            console.error("[BiometricService] Error: No se pudo obtener el ejecutable de BiometricMiddleware");
            return;
        }

        // Ejecutable compilado (usa ruta según entorno)
        const biometricDir = getBiometricPath();
        const middlewarePath = path.join(biometricDir, "BiometricMiddleware.exe");
        const workingDir = biometricDir;

        // Generar token de autenticación único para esta sesión
        biometricToken = crypto.randomUUID();
        console.log("[BiometricService] Status: Token de autenticacion generado");

        const spawnOptions = {
            cwd: workingDir,
            shell: process.platform === "win32" ? false : undefined,
            windowsHide: process.platform === "win32" ? false : undefined,
            detached: false,
        };

        const args = [`--token=${biometricToken}`];

        biometricProcess = spawn(middlewarePath, args, spawnOptions);

        biometricProcess.stdout.on("data", () => { });

        biometricProcess.stderr.on("data", (data) => {
            console.error(`[BiometricMiddleware] ${data.toString().trim()}`);
        });

        biometricProcess.on("close", () => {
            biometricProcess = null;
        });

        biometricProcess.on("error", (error) => {
            console.error("[BiometricService] Error: Error al iniciar BiometricMiddleware:", error.message);
            biometricProcess = null;
        });

    } catch (error) {
        console.error("[BiometricService] Error: Error al iniciar BiometricMiddleware:", error);
    }
}

/**
 * Función para detener el BiometricMiddleware
 */
export function stopBiometricMiddleware() {
    if (biometricProcess) {
        try {
            biometricProcess.kill();
            biometricProcess = null;
        } catch (error) {
            console.error("[BiometricService] Error: Error al detener BiometricMiddleware:", error.message);
        }
    }
}

/**
 * Obtener token de autenticación
 */
export function getBiometricToken() {
    return biometricToken;
}
