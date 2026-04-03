import { AlertCircle } from "lucide-react";

export default function NoEmployeeInfo() {
  return (
    <div className="bg-bg-primary rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center h-full">
      <div className="w-20 h-20 bg-bg-secondary rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-10 h-10 text-text-tertiary" />
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-2">
        No hay información disponible
      </h3>
      <p className="text-sm text-text-secondary text-center max-w-md">
        Este usuario no tiene información de empleado registrada.
      </p>
    </div>
  );
}
