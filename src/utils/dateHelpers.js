export const formatTime = (date) => {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatDate = (date) => {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDateShort = (date) => {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

export const formatDay = (date) => {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return days[date.getDay()];
};

export const formatDateKey = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

export const getDaysInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];

  // Días vacíos al inicio
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return days;
};

export const calcularDiasTotales = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) return 0;
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diferencia = fin - inicio;
  const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24)) + 1;
  return dias > 0 ? dias : 0;
};
