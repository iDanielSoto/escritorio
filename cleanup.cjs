const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron', 'services', 'biometricService.mjs');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Eliminar installDigitalPersonaSdk() y su JSDoc
code = code.replace(/\/\*\*\s*\n\s*\*\s*Instala el SDK de DigitalPersona silenciosamente[\s\S]*?export async function installDigitalPersonaSdk\(\) \{[\s\S]*?\}\n\s*\}\);\s*\n\}/, '');

// 2. Simplificar startBiometricMiddleware()
code = code.replace(/export async function startBiometricMiddleware\(\) \{[\s\S]*?\/\/\s*Compilar si es necesario/m, `export async function startBiometricMiddleware() {
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

        // Compilar si es necesario`);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Limpieza completada en biometricService.mjs');
