export const notices = [
  {
    time: "10:45 a.m.",
    date: "29/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Lic. Amaya Abarca - Recursos Humanos",
    subject: "Evaluación de Desempeño Q4 2025",
    detail:
      "Se convoca a todos los jefes de departamento y personal clave a la reunión de evaluación de desempeño del cuarto trimestre.",
  },
  {
    time: "09:30 a.m.",
    date: "29/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Ing. Soto Aguirre - Jefe de Producción",
    subject: "Modificación temporal de horarios",
    detail:
      "Por motivos de mantenimiento preventivo, el acceso estará restringido de 2:00 PM a 6:00 PM.",
  },
  {
    time: "08:15 a.m.",
    date: "28/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Lic. Tapia Hernández - Sistemas y TI",
    subject: "Nueva versión del sistema biométrico",
    detail:
      "Se informa que este fin de semana se realizará la actualización del sistema.",
  },
  {
    time: "07:45 a.m.",
    date: "27/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Lic. Amaya Abarca - Recursos Humanos",
    subject: "Capacitación en Seguridad",
    detail:
      "Todo el personal debe completar el curso de Seguridad e Higiene Industrial.",
  },
  {
    time: "06:30 a.m.",
    date: "26/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Lic. González Ruiz - Administración",
    subject: "Recordatorio de Pago de Nómina",
    detail:
      "Se les recuerda que el pago de nómina se realizará el próximo viernes 1 de noviembre.",
  },
  {
    time: "05:15 a.m.",
    date: "25/10/2025",
    message:
      "Lorem ipsum dolor, 3 líneas como máximo consecuenctor dipisicin tempordunt",
    type: "info",
    author: "Dir. Martínez López - Dirección General",
    subject: "Celebración Aniversario de la Empresa",
    detail:
      "Invitamos a todos los colaboradores a la celebración del 15° aniversario de la empresa.",
  },
];

export const eventLog = [
  {
    timestamp: "08:45:23",
    user: "Amaya Abarca",
    action: "Registro de entrada exitoso - Reconocimiento facial",
    type: "success",
  },
  {
    timestamp: "08:42:15",
    user: "Carlos Martínez",
    action: "Intento de acceso - Huella digital no reconocida",
    type: "error",
  },
  {
    timestamp: "08:40:08",
    user: "María González",
    action: "Registro de entrada exitoso - PIN",
    type: "success",
  },
  {
    timestamp: "08:38:55",
    user: "Sistema",
    action: "Sincronización de datos con servidor central",
    type: "info",
  },
  {
    timestamp: "08:35:12",
    user: "José Ramírez",
    action: "Registro de entrada exitoso - Huella digital",
    type: "success",
  },
  {
    timestamp: "08:30:44",
    user: "Ana Patricia López",
    action: "Registro de entrada exitoso - Reconocimiento facial",
    type: "success",
  },
  {
    timestamp: "08:28:19",
    user: "Sistema",
    action: "Actualización de firmware del lector biométrico",
    type: "info",
  },
  {
    timestamp: "08:25:03",
    user: "Luis Hernández",
    action: "Intento de acceso - Rostro no identificado",
    type: "error",
  },
];

export const registrosPorDia = {
  "2025-10-28": [
    { hora: "08:05 a.m.", tipo: "Entrada", estado: "Retardo" },
    { hora: "01:00 p.m.", tipo: "Salida comida", estado: "Normal" },
    { hora: "02:05 p.m.", tipo: "Entrada comida", estado: "Normal" },
    { hora: "05:00 p.m.", tipo: "Salida", estado: "Normal" },
  ],
  "2025-10-29": [
    { hora: "07:58 a.m.", tipo: "Entrada", estado: "Normal" },
    { hora: "01:00 p.m.", tipo: "Salida comida", estado: "Normal" },
    { hora: "02:00 p.m.", tipo: "Entrada comida", estado: "Normal" },
    { hora: "05:02 p.m.", tipo: "Salida", estado: "Normal" },
  ],
  "2025-10-30": [
    { hora: "08:15 a.m.", tipo: "Entrada", estado: "Retardo" },
    { hora: "01:00 p.m.", tipo: "Salida comida", estado: "Normal" },
    { hora: "02:10 p.m.", tipo: "Entrada comida", estado: "Normal" },
    { hora: "05:00 p.m.", tipo: "Salida", estado: "Normal" },
  ],
  "2025-10-31": [
    { hora: "07:55 a.m.", tipo: "Entrada", estado: "Normal" },
    { hora: "01:00 p.m.", tipo: "Salida comida", estado: "Normal" },
    { hora: "02:00 p.m.", tipo: "Entrada comida", estado: "Normal" },
    { hora: "05:00 p.m.", tipo: "Salida", estado: "Normal" },
  ],
};
