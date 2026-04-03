import { useState, useEffect, useRef } from "react";
import { obtenerEscritorio, verificarEstadoPublico } from "../services/escritorioService";

export const useNodeStatus = () => {
    const [isNodeDisabled, setIsNodeDisabled] = useState(false);
    const [nodeInfo, setNodeInfo] = useState(null);
    const [isCheckingNode, setIsCheckingNode] = useState(false);

    const initialLoadDone = useRef(false);

    const checkNodeStatus = async () => {
        // escritorio_id se guarda en localStorage directamente
        const escritorioId = localStorage.getItem("escritorio_id");
        if (!escritorioId) return;

        try {
            // Solo establecemos el estado de carga la primera vez para no generar re-renders bloqueantes visualmente
            if (!initialLoadDone.current) {
                setIsCheckingNode(true);
                
                // Carga inicial pesada
                const nodo = await obtenerEscritorio(escritorioId);
                if (nodo) {
                    setNodeInfo(nodo);
                    
                    // Guardar empresa_id si viene en la respuesta para asegurar consistencia
                    if (nodo.empresa_id) {
                        localStorage.setItem("empresa_id", nodo.empresa_id);
                    }

                    // es_activo puede llegar como boolean false o número 0
                    const disabled = nodo.es_activo === false || nodo.es_activo === 0;
                    setIsNodeDisabled(disabled);
                    initialLoadDone.current = true;
                }
            } else {
                // Polling en tiempo real (ligero)
                const res = await verificarEstadoPublico(escritorioId);
                if (res && res.success && res.data) {
                    const publicStatus = res.data;
                    
                    // Actualizamos únicamente los datos devueltos (id, nombre, es_activo)
                    setNodeInfo(prev => prev ? { ...prev, ...publicStatus } : publicStatus);
                    
                    const disabled = publicStatus.es_activo === false || publicStatus.es_activo === 0;
                    setIsNodeDisabled(disabled);
                }
            }
        } catch (error) {
            console.warn("No se pudo verificar el estado del nodo:", error);
        } finally {
            if (isCheckingNode) setIsCheckingNode(false);
        }
    };

    useEffect(() => {
        checkNodeStatus();
        // Disminuimos el intervalo a 10s para reaccionar casi en tiempo real (antes: 60s)
        const interval = setInterval(checkNodeStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    return { isNodeDisabled, setIsNodeDisabled, nodeInfo, setNodeInfo, isCheckingNode, checkNodeStatus };
};
