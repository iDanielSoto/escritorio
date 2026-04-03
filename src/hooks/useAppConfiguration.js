import { useState, useEffect } from "react";
import storage from "../utils/storage";

export const useAppConfiguration = () => {
    const [currentPage, setCurrentPage] = useState("loading");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkConfiguration = async () => {
            try {
                const isConfigured = await storage.getItem("appConfigured");
                setCurrentPage(isConfigured ? "kiosk" : "affiliation");
            } catch (error) {
                console.error("Error verificando configuración:", error);
                // En caso de error, asumir que no está configurado
                setCurrentPage("affiliation");
            } finally {
                setIsLoading(false);
            }
        };

        checkConfiguration();
    }, []);

    const handleAffiliationComplete = async () => {
        await storage.setItem("appConfigured", "true");
        localStorage.setItem("pendingDeviceSync", "true");
        setCurrentPage("kiosk");
    };

    const handleNewAffiliation = async () => {
        // Limpiar todo el estado de configuración (usando storage para Electron)
        await storage.removeItem("appConfigured");
        await storage.removeItem("escritorio_id");
        // await storage.removeItem("auth_token"); // Omitted to keep DevTunnels connection
        await storage.removeItem("solicitud_id");
        await storage.removeItem("solicitud_token");
        setCurrentPage("affiliation");
    };

    return {
        currentPage,
        setCurrentPage,
        isLoading,
        handleAffiliationComplete,
        handleNewAffiliation,
    };
};
