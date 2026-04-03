import os from "os";

let networkMonitorInterval = null;
let lastNetworkState = null;

/**
 * Obtiene los detalles de la red actual (IP y MAC)
 * Prioriza Ethernet sobre WiFi, y IPv4 no interno.
 * @returns {Object} { ipAddress, macAddress }
 */
export function getNetworkDetails() {
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = "No detectada";
    let macAddress = "No detectada";

    // Prioridad: Ethernet > WiFi > Otros
    // Buscamos primero interfaces que parezcan Ethernet
    for (const [name, nets] of Object.entries(networkInterfaces)) {
        if (name.toLowerCase().includes("ethernet") || name.toLowerCase().includes("eth")) {
            for (const net of nets) {
                if (net.family === "IPv4" && !net.internal) {
                    return { ipAddress: net.address, macAddress: net.mac.toUpperCase() };
                }
            }
        }
    }

    // Si no encontramos Ethernet, buscamos WiFi
    for (const [name, nets] of Object.entries(networkInterfaces)) {
        if (name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wlan") || name.toLowerCase().includes("wireless")) {
            for (const net of nets) {
                if (net.family === "IPv4" && !net.internal) {
                    return { ipAddress: net.address, macAddress: net.mac.toUpperCase() };
                }
            }
        }
    }

    // Si no, devolvemos la primera IPv4 externa que encontremos
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === "IPv4" && !net.internal) {
                ipAddress = net.address;
                macAddress = net.mac.toUpperCase();
                return { ipAddress, macAddress };
            }
        }
    }

    return { ipAddress, macAddress };
}

/**
 * Inicia el monitoreo de cambios de red
 * @param {BrowserWindow} window - Ventana a la que enviar eventos
 */
export function startMonitoring(window) {
    if (networkMonitorInterval) clearInterval(networkMonitorInterval);

    // Estado inicial
    lastNetworkState = getNetworkDetails();

    // Polling cada 2 segundos
    networkMonitorInterval = setInterval(() => {
        const currentDetails = getNetworkDetails();

        if (
            currentDetails.ipAddress !== lastNetworkState.ipAddress ||
            currentDetails.macAddress !== lastNetworkState.macAddress
        ) {
            console.log("[NetworkService] Event: Cambio de red detectado:", currentDetails);
            lastNetworkState = currentDetails;

            if (window && !window.isDestroyed()) {
                window.webContents.send("network-status-change", currentDetails);
            }
        }
    }, 2000);

    console.log("[NetworkService] Status: Monitoreo de red iniciado");
}

/**
 * Detiene el monitoreo de red
 */
export function stopMonitoring() {
    if (networkMonitorInterval) {
        clearInterval(networkMonitorInterval);
        networkMonitorInterval = null;
        console.log("[NetworkService] Status: Monitoreo de red detenido");
    }
}
