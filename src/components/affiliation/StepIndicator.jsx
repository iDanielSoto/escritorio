import { Check } from "lucide-react";

export default function StepIndicator({ currentStep }) {
  const steps = [
    { number: 1, label: "Nodo" },
    { number: 2, label: "Dispositivos" },
    { number: 3, label: "Afiliación" },
    { number: 4, label: "Aprobación" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="flex items-center justify-between relative">
        {/* Connection Line Background */}
        <div className="absolute top-[18px] left-0 w-full h-[1px] bg-border-divider -z-10" />

        {steps.map((stepItem, index) => {
          const isCompleted = currentStep > stepItem.number;
          const isActive = currentStep === stepItem.number;

          return (
            <div key={stepItem.number} className="flex flex-col items-center relative gap-2">
              <div
                className={`
                  w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-500 z-10
                  ${isCompleted
                    ? "bg-accent text-white shadow-sm"
                    : isActive
                      ? "bg-bg-primary border-2 border-accent text-accent shadow-md scale-105"
                      : "bg-bg-secondary border border-border-subtle text-text-disabled"
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <span>{stepItem.number}</span>
                )}
              </div>
              <span
                className={`
                  text-[10px] uppercase tracking-wider font-semibold transition-colors duration-300
                  ${isActive ? "text-accent" : isCompleted ? "text-text-primary" : "text-text-disabled"}
                `}
              >
                {stepItem.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

