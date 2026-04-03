import { useState, useEffect } from "react";
import { getEmpleadoConHorario, getDepartamentosPorEmpleadoId } from "../services/empleadoService";
import { getAvisosDeEmpleado } from "../services/avisosService";

export const useEmployeeData = (usuario) => {
    const [empleadoData, setEmpleadoData] = useState(null);
    const [loadingEmpleado, setLoadingEmpleado] = useState(false);
    const [departamentos, setDepartamentos] = useState([]);
    const [notices, setNotices] = useState([]);

    // Cargar datos completos del empleado al montar el componente
    useEffect(() => {
        const cargarDatosEmpleado = async () => {
            if (!usuario?.es_empleado) return;

            // Si ya tenemos horario completo, usar directamente
            if (usuario?.horario) {
                setEmpleadoData(usuario);
                return;
            }

            // Modo offline: enriquecer desde cache_empleados en SQLite
            if (usuario?.offline && usuario?.empleado_id) {
                console.log("📴 [useEmployeeData] Modo offline — cargando desde SQLite...");
                setLoadingEmpleado(true);
                try {
                    if (window.electronAPI?.offlineDB) {
                        const empCache = await window.electronAPI.offlineDB.getEmpleado(usuario.empleado_id);
                        if (empCache) {
                            console.log("✅ [useEmployeeData] Datos offline cargados:", empCache.nombre);
                            setEmpleadoData({
                                ...empCache,
                                ...usuario,
                                // Campos de cache_empleados tienen prioridad para mostrado en UI
                                nombre: empCache.nombre || usuario.nombre,
                                usuario: empCache.usuario || usuario.usuario || '',
                                correo: empCache.correo || usuario.correo || '',
                                foto: empCache.foto || usuario.foto || null,
                                es_empleado: true,
                                offline: true,
                            });
                            return;
                        }
                    }
                } catch (err) {
                    console.error("❌ [useEmployeeData] Error cargando desde SQLite:", err);
                } finally {
                    setLoadingEmpleado(false);
                }
                setEmpleadoData(usuario);
                return;
            }

            // Modo online: intentar cargar con horario desde API
            if (usuario?.horario_id) {
                setLoadingEmpleado(true);
                try {
                    const datos = await getEmpleadoConHorario(usuario);
                    if (datos) {
                        setEmpleadoData(datos);
                    }
                } catch (error) {
                    console.error("❌ Error cargando datos del empleado:", error);
                    setEmpleadoData(usuario);
                } finally {
                    setLoadingEmpleado(false);
                }
                return;
            }

            // Caso general: usar datos del usuario directamente
            setEmpleadoData(usuario);
        };

        cargarDatosEmpleado();
    }, [usuario]);

    // Cargar departamentos del empleado
    useEffect(() => {
        const cargarDepartamentos = async () => {
            const empleadoId = usuario?.empleado_id;

            if (empleadoId) {
                try {
                    const deptos = await getDepartamentosPorEmpleadoId(empleadoId);
                    setDepartamentos(deptos);
                } catch (error) {
                    console.error("❌ Error cargando departamentos:", error);
                }
            }
        };

        if (usuario?.es_empleado) {
            cargarDepartamentos();
        }
    }, [usuario]);

    // Cargar avisos personales del empleado
    useEffect(() => {
        const cargarAvisos = async () => {
            const empId = usuario?.empleado_id;
            if (!empId) return;
            try {
                const data = await getAvisosDeEmpleado(empId);
                setNotices(data);
            } catch (error) {
                console.error("Error cargando avisos del empleado:", error);
            }
        };
        if (usuario?.es_empleado) {
            cargarAvisos();
        }
    }, [usuario]);

    // Combinar datos del usuario con los datos del empleado cargados
    const datosCompletos = empleadoData || usuario;

    return { datosCompletos, loadingEmpleado, departamentos, notices, setNotices };
};
