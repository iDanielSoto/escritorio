import React, { useState, useEffect } from "react";
import { Search, User, X, Briefcase, FileText } from "lucide-react";
import { getAllEmpleados } from "../../services/empleadoService";
import { getApiEndpoint } from "../../config/apiEndPoint";
import DynamicLoader from "../common/DynamicLoader";

const API_URL = getApiEndpoint("/api");

export default function EmployeeSelectionModal({ onClose, onSelect, biometriaTipo = 'huella' }) {
    const [empleados, setEmpleados] = useState([]);
    const [credenciales, setCredenciales] = useState([]);
    const [filteredEmpleados, setFilteredEmpleados] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const token = localStorage.getItem("auth_token");
                const headers = {
                    "Content-Type": "application/json",
                    ...(token && { Authorization: `Bearer ${token}` }),
                };

                // Obtener empleados y credenciales desde el API en paralelo
                const [empleadosData, credencialesRes] = await Promise.all([
                    getAllEmpleados(),
                    fetch(`${API_URL}/credenciales`, { headers })
                ]);

                let credencialesData = [];
                if (credencialesRes.ok) {
                    const json = await credencialesRes.json();
                    credencialesData = json.data || [];
                }

                setEmpleados(empleadosData);
                setCredenciales(credencialesData);
                applyFilterAndSort(empleadosData, credencialesData, searchTerm);
            } catch (err) {
                console.error("Error cargando datos:", err);
                setError("No se pudieron cargar los empleados.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const hasBiometricData = (empleadoId, type, credencialesData) => {
        const cred = credencialesData.find(c => String(c.empleado_id) === String(empleadoId));
        if (!cred) return false;

        if (type === 'huella') {
            return !!cred.tiene_dactilar;
        } else if (type === 'rostro') {
            return !!cred.tiene_facial;
        }
        return false;
    };

    const applyFilterAndSort = (empleadosList, credsList, term) => {
        let filtered = empleadosList;

        // Filter by search term
        if (term.trim() !== "") {
            const lowerSearch = term.toLowerCase();
            filtered = empleadosList.filter((emp) =>
                (emp.nombre && emp.nombre.toLowerCase().includes(lowerSearch)) ||
                (emp.usuario && emp.usuario.toLowerCase().includes(lowerSearch)) ||
                (emp.id && String(emp.id).toLowerCase().includes(lowerSearch))
            );
        }

        // Sort by biometric status: those WITHOUT data come first
        filtered.sort((a, b) => {
            const aHasData = hasBiometricData(a.id, biometriaTipo, credsList);
            const bHasData = hasBiometricData(b.id, biometriaTipo, credsList);

            if (aHasData === bHasData) return 0;
            return aHasData ? 1 : -1; // true (has data) goes to bottom
        });

        setFilteredEmpleados(filtered);
    };

    useEffect(() => {
        applyFilterAndSort(empleados, credenciales, searchTerm);
    }, [searchTerm, empleados, credenciales, biometriaTipo]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-bg-primary rounded-xl shadow-2xl max-w-lg 2xl:max-w-2xl w-full flex flex-col h-[600px] 2xl:h-[800px] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border-subtle flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#1976D2]/10 p-2 rounded-lg">
                                <User className="w-6 h-6 text-[#1976D2]" />
                            </div>
                            <h2 className="text-xl font-bold text-text-primary">
                                Seleccionar Empleado
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-text-secondary mb-4">
                        Selecciona el empleado para registrar su {biometriaTipo === 'huella' ? 'huella digital' : 'rostro'}.
                    </p>

                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, usuario o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border-subtle rounded-lg bg-bg-secondary focus:ring-2 focus:ring-[#1976D2] focus:border-transparent outline-none transition-all text-text-primary"
                        />
                    </div>
                </div>

                {/* Lista de Empleados */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <DynamicLoader text="Cargando empleados..." size="medium" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-red-500">
                            <p>{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-4 py-2 bg-bg-secondary border border-border-subtle rounded-lg hover:bg-bg-tertiary transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : filteredEmpleados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                            <User className="w-12 h-12 text-text-tertiary mb-3 opacity-50" />
                            <p className="text-text-secondary">No se encontraron empleados que coincidan con la búsqueda.</p>
                        </div>
                    ) : (
                        filteredEmpleados.map((empleado) => {
                            const hasData = hasBiometricData(empleado.id, biometriaTipo, credenciales);
                            return (
                                <button
                                    key={empleado.id}
                                    onClick={() => onSelect(empleado.id, empleado)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-bg-primary hover:bg-bg-secondary hover:border-[#1976D2]/50 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${hasData ? 'bg-green-100 dark:bg-green-900/30' : 'bg-[#E3F2FD] dark:bg-[#1565C0]/20'}`}>
                                            <User className={`w-5 h-5 ${hasData ? 'text-green-600' : 'text-[#1976D2]'}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-text-primary text-sm truncate">
                                                {empleado.nombre || "Sin Nombre"}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs mt-0.5">
                                                <span className="flex items-center gap-1 text-text-tertiary">
                                                    <Briefcase className="w-3 h-3" />
                                                    {empleado.usuario || "N/A"}
                                                </span>
                                                {hasData && (
                                                    <span className="flex items-center gap-1 text-green-600 font-semibold px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded text-[10px]">
                                                        Ya Registrado
                                                    </span>
                                                )}
                                                {!hasData && empleado.rfc && (
                                                    <span className="flex items-center gap-1 text-text-tertiary">
                                                        <FileText className="w-3 h-3" />
                                                        {empleado.rfc}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#1976D2] text-white px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0 ml-2">
                                        {hasData ? "Sobrescribir" : "Seleccionar"}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
