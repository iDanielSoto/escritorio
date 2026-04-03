import React from "react";
import { X, Settings, Smartphone, Sliders } from "lucide-react";

export default function ConfigModal({ onClose, onSelectOption }) {
  const configOptions = [
    {
      id: "general",
      title: "General del Nodo",
      description: "Configuración general del sistema y nodo de trabajo",
      icon: Settings,
      bgColor: "bg-bg-secondary",
      iconBg: "bg-bg-secondary",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      id: "dispositivos",
      title: "Dispositivos Conectados",
      description: "Gestiona los dispositivos vinculados a tu cuenta",
      icon: Smartphone,
      bgColor: "bg-bg-secondary",
      iconBg: "bg-bg-secondary",
      borderColor: "border-green-200 dark:border-green-800",
    },
    {
      id: "preferencias",
      title: "Preferencias",
      description: "Personaliza tu experiencia y ajustes del usuario",
      icon: Sliders,
      bgColor: "bg-bg-secondary",
      iconBg: "bg-bg-secondary",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
  ];

  const handleOptionClick = (optionId) => {
    onSelectOption(optionId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-primary rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-bg-primary p-6 border-b border-border-subtle">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-[#1976D2]" />
              <div>
                <h3 className="text-2xl font-bold text-text-primary">Configuración</h3>
                <p className="text-text-secondary text-sm mt-1">
                  Gestiona la configuración del sistema
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:bg-bg-secondary rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {configOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`w-full ${option.bgColor} border ${option.borderColor} rounded-xl p-5 hover:shadow-lg transition-all group`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 ${option.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-7 h-7 text-[#1976D2]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-bold text-text-primary text-lg mb-1">
                      {option.title}
                    </h4>
                    <p className="text-text-secondary text-sm">
                      {option.description}
                    </p>
                  </div>
                  <svg
                    className="w-6 h-6 text-text-disabled group-hover:text-text-secondary group-hover:translate-x-1 transition-all"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
