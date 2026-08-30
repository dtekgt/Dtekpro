/*
  D-TEK GT Web OS v4 Agenda Funnel — Propiedad de D-TEK GT / Dominic Morales.
  Código creado para uso exclusivo de D-TEK GT.
*/

window.DTEK_WHATSAPP_NUMBER = "50247082329"; // Reemplazar por WhatsApp oficial de D-TEK, sin espacios ni guiones.
const DTEK_WHATSAPP_NUMBER = window.DTEK_WHATSAPP_NUMBER;

window.DTEK_OWNER_EMAIL = "rgdominicm@gmail.com"; // Reemplazar por el correo oficial que recibirá confirmaciones.
const DTEK_OWNER_EMAIL = window.DTEK_OWNER_EMAIL;

// Prototipo local:
// - "mailto" abre borradores de correo.
// - "zapier" manda la cita a un Catch Hook de Zapier para automatizar correos, Sheets, Calendar, etc.
window.DTEK_EMAIL_MODE = "zapier"; // "zapier" evita abrir Outlook/mailto. Activa DTEK_ZAPIER_ENABLED cuando tengas webhook.

// Zapier Webhooks by Zapier - Catch Hook.
// IMPORTANTE: directo en frontend sirve para pruebas. En producción conviene usar una función serverless como proxy
// para no exponer el webhook y poder validar spam/abuso.
window.DTEK_ZAPIER_WEBHOOK_URL = ""; // Ejemplo: "https://hooks.zapier.com/hooks/catch/XXXX/YYYY"
window.DTEK_ZAPIER_ENABLED = false; // Cambiar a true cuando pegues el Catch Hook de Zapier.

// Eventos que D-TEK Web OS puede mandar a Zapier cuando el webhook esté activo.
window.DTEK_ZAPIER_EVENTS = {
  appointmentCreated: true,
  appointmentStatusUpdated: true,
  blockedTimeCreated: true
};

// El acceso al panel ya no usa PIN en el cliente: admin.html redirige a
// admin-backend.html, que valida sesión de Supabase y role = "admin".

const dtekVehicleCatalog = {
  "Toyota": ["Yaris", "Corolla", "Hilux", "RAV4", "4Runner", "Tacoma", "Land Cruiser", "Prado", "Fortuner", "Avanza", "Hiace", "Camry", "Prius", "Rush"],
  "Kia": ["Picanto", "Rio", "Cerato", "K3", "K5", "Soul", "Sportage", "Sorento", "Seltos", "Carnival"],
  "Hyundai": ["i10", "Accent", "Elantra", "Tucson", "Santa Fe", "Creta", "H-1", "Venue", "Sonata"],
  "Honda": ["Civic", "Accord", "Fit", "HR-V", "CR-V", "Pilot", "Odyssey", "City"],
  "Nissan": ["March", "Versa", "Sentra", "Altima", "Kicks", "X-Trail", "Frontier", "Navara", "Pathfinder", "Qashqai"],
  "Mazda": ["Mazda 2", "Mazda 3", "Mazda 6", "CX-3", "CX-30", "CX-5", "CX-9", "BT-50"],
  "Mitsubishi": ["Mirage", "Lancer", "ASX", "Outlander", "Montero", "Nativa", "L200", "Xpander"],
  "Ford": ["Fiesta", "Focus", "Fusion", "EcoSport", "Escape", "Explorer", "Ranger", "F-150", "Edge", "Mustang"],
  "Chevrolet": ["Spark", "Aveo", "Sonic", "Cruze", "Trax", "Equinox", "Captiva", "Colorado", "Silverado", "Camaro"],
  "Volkswagen": ["Polo", "Golf", "Jetta", "Passat", "Tiguan", "Taos", "Amarok", "Saveiro", "Teramont"],
  "Suzuki": ["Alto", "Celerio", "Swift", "Dzire", "Vitara", "Grand Vitara", "Jimny", "S-Cross", "Ertiga"],
  "Jeep": ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Patriot"],
  "Subaru": ["Impreza", "Legacy", "Forester", "Outback", "XV", "Crosstrek", "WRX", "BRZ"],
  "BMW": ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X3", "X5", "X6"],
  "Mercedes-Benz": ["Clase A", "Clase B", "Clase C", "Clase E", "GLA", "GLC", "GLE", "Sprinter"],
  "Audi": ["A1", "A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "TT"],
  "Isuzu": ["D-Max", "MU-X", "NPR", "NQR"],
  "Renault": ["Kwid", "Sandero", "Duster", "Logan", "Koleos", "Oroch"],
  "Fiat": ["500", "Uno", "Punto", "Palio", "Strada", "Ducato"],
  "Dodge": ["Attitude", "Journey", "Durango", "Ram", "Charger", "Challenger"],
  "Otra marca": ["Otra línea"]
};

const dtekServiceCategories = [
  "Recomendados",
  "Todos",
  "Revisión y diagnóstico",
  "Compra segura",
  "Mantenimiento",
  "Frenos",
  "Inyección y admisión",
  "TPMS, eléctrico y batería",
  "A/C, suspensión y varios",
  "Otros"
];

const dtekServices = [
  {
    id: "revision-express",
    name: "Revisión Express",
    category: "Revisión y diagnóstico",
    partsIncluded: "No",
    priceNote: "Escaneo con lector de códigos",
    price: "Desde Q200",
    duration: "30–45 min",
    featured: true,
    short: "Revisión inicial para saber por dónde empezar.",
    description: "Una revisión rápida para ordenar el caso, detectar señales evidentes y decidir el siguiente paso sin perder tiempo.",
    ideal: ["Primera revisión", "Dudas generales", "Ruidos o síntomas leves", "Saber por dónde empezar"],
    includes: ["Revisión visual inicial", "Preguntas guiadas del síntoma", "Observaciones claras", "Ruta sugerida"],
    dataNeeded: ["Marca", "Modelo", "Año", "Ubicación", "Síntoma principal", "Si arranca y se mueve"],
    bookingPolicy: "Sujeta a confirmación según ubicación, acceso y condición del vehículo."
  },
  {
    id: "check-engine-escaneo-explicado",
    name: "Check Engine / escaneo explicado",
    category: "Revisión y diagnóstico",
    partsIncluded: "No",
    priceNote: "Escáner computarizado e interpretación",
    price: "Desde Q250",
    duration: "30–60 min",
    featured: true,
    short: "Escaneo y explicación clara de códigos.",
    description: "Lectura de códigos y explicación sencilla de lo que significan para evitar conclusiones apresuradas.",
    ideal: ["Check Engine", "Luces de tablero", "Códigos activos", "Revisión antes de cambiar piezas"],
    includes: ["Escaneo OBD-II", "Lectura de códigos", "Explicación del posible origen", "Recomendación inicial"],
    dataNeeded: ["Marca", "Modelo", "Año", "Luz encendida", "Síntoma", "Ubicación"]
  },
  {
    id: "escaneo-datos-vivo",
    name: "Escaneo + datos en vivo",
    category: "Revisión y diagnóstico",
    partsIncluded: "No",
    priceNote: "Análisis con lectura de datos en vivo",
    price: "Desde Q350",
    duration: "60–90 min",
    featured: true,
    short: "Para revisar señales y parámetros en tiempo real.",
    description: "Revisión de datos en vivo para observar sensores y comportamiento real del vehículo según el síntoma.",
    ideal: ["Fallas intermitentes", "Sensores", "Mezcla/fuel trims", "Temperaturas", "Datos de caja o motor"],
    includes: ["Escaneo", "Datos en vivo", "Lectura de parámetros", "Explicación técnica clara"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Condición en que falla", "Ubicación"]
  },
  {
    id: "compra-segura",
    name: "Compra Segura",
    category: "Compra segura",
    partsIncluded: "No",
    priceNote: "Revisión general de carrocería, batería y componentes eléctricos + escaneo",
    price: "Desde Q350",
    duration: "60–90 min",
    featured: true,
    short: "Revisión pre-compra básica para carro usado.",
    description: "Revisión básica antes de pagar por un carro usado para detectar señales de alerta y comprar con más claridad.",
    ideal: ["Compra de carro usado", "Negociar mejor", "Detectar fallas ocultas", "Evitar una mala compra"],
    includes: ["Escáner", "Revisión visual", "Revisión de fugas visibles", "Prueba básica si aplica", "Observaciones por WhatsApp"],
    dataNeeded: ["Vehículo", "Año", "Ubicación del carro", "Si se puede probar", "Fecha y hora ideal"],
    bookingPolicy: "Depende de acceso al vehículo, permiso del vendedor y posibilidad de prueba."
  },
  {
    id: "compra-segura-avanzada",
    name: "Compra Segura Avanzada",
    category: "Compra segura",
    partsIncluded: "No",
    priceNote: "Prueba de compresión + revisión general de suspensión y chasís + análisis de datos en vivo",
    price: "Desde Q850",
    duration: "90–180 min",
    featured: true,
    short: "Incluye desarme de frenos y prueba de compresión.",
    description: "Revisión pre-compra más profunda para vehículos donde necesitás más certeza antes de cerrar el negocio.",
    ideal: ["Carro usado de mayor valor", "Dudas de motor", "Dudas de frenos", "Negociación seria"],
    includes: ["Escaneo y revisión visual", "Desarme de frenos", "Prueba de compresión", "Observaciones para negociar o evitar"],
    dataNeeded: ["Vehículo", "Año", "Ubicación", "Permiso para revisar", "Si se puede probar", "Fecha y hora ideal"],
    bookingPolicy: "Debe confirmarse permiso del vendedor para desarme de frenos y pruebas." 
  },
  {
    id: "diagnostico-pro",
    name: "Diagnóstico Pro",
    category: "Revisión y diagnóstico",
    partsIncluded: "No",
    priceNote: "Casos de estudio: no arranca + prueba de compresión y análisis de datos",
    price: "Desde Q850",
    duration: "180–360 min",
    featured: true,
    short: "Para fallas que necesitan criterio técnico.",
    description: "Diagnóstico con criterio técnico antes de cambiar piezas, ideal para fallas que no se resuelven solo leyendo códigos.",
    ideal: ["Jalones", "Pérdida de fuerza", "Fallas intermitentes", "Problemas de caja", "Problemas de motor"],
    includes: ["Escaneo", "Datos en vivo", "Revisión visual", "Pruebas según síntoma", "Ruta recomendada"],
    dataNeeded: ["Marca", "Modelo", "Año", "Problema", "Cuándo falla", "Ubicación", "Si arranca y se mueve"]
  },
  {
    id: "aprendizajes-calibraciones-simples",
    name: "Aprendizajes / calibraciones simples",
    category: "Revisión y diagnóstico",
    partsIncluded: "No",
    priceNote: "Aprendizaje de cuerpo de aceleración, reaprendizaje de módulos TCM, calibración de sensor de ángulo de timón",
    price: "Desde Q400",
    duration: "60–120 min",
    featured: false,
    short: "Procedimientos de adaptación o reset según vehículo.",
    description: "Procedimientos de aprendizaje, adaptación o calibración cuando el vehículo y el escáner lo permiten.",
    ideal: ["Relearn", "Adaptaciones", "Calibraciones simples", "Después de mantenimiento o reparación"],
    includes: ["Revisión de procedimiento disponible", "Ejecución si aplica", "Confirmación del resultado"],
    dataNeeded: ["Marca", "Modelo", "Año", "Procedimiento requerido", "Síntoma", "Ubicación"]
  },
  {
    id: "reset-mantenimiento-servicio",
    name: "Reset mantenimiento / servicio",
    category: "Mantenimiento",
    partsIncluded: "Reset de luz de mantenimiento",
    price: "Desde Q100",
    duration: "10 min",
    featured: false,
    short: "Reinicio de mantenimiento cuando el vehículo lo permite.",
    description: "Reinicio de aviso de mantenimiento o servicio cuando el sistema del vehículo lo permite. No incluye diagnóstico ni reparación.",
    ideal: ["Aviso de mantenimiento", "Cambio de aceite ya realizado", "Reset de servicio", "Luz de mantenimiento"],
    includes: ["Revisión del aviso", "Reset si el vehículo lo permite", "Confirmación visual"],
    dataNeeded: ["Marca", "Modelo", "Año", "Aviso mostrado", "Ubicación"],
    bookingPolicy: "No incluye diagnóstico ni reparación."
  },
  {
    id: "mantenimiento-express-mo",
    name: "Mantenimiento Express MO",
    category: "Mantenimiento",
    partsIncluded: "No",
    priceNote: "Usted pone el aceite y los filtros, nosotros los instalamos",
    price: "Desde Q350 · solo mano de obra",
    duration: "30 min",
    featured: true,
    short: "Cambio de aceite cuando el cliente trae insumos.",
    description: "Mano de obra para cambio de aceite cuando el cliente ya tiene los insumos correctos.",
    ideal: ["Cliente tiene aceite", "Cliente tiene filtro", "Servicio rápido", "A domicilio"],
    includes: ["Mano de obra", "Cambio de aceite", "Cambio de filtro", "Revisión rápida visual"],
    dataNeeded: ["Marca", "Modelo", "Año", "Aceite y filtro disponibles", "Ubicación", "Fecha y hora ideal"]
  },
  {
    id: "servicio-menor-full",
    name: "Servicio Menor Full",
    category: "Mantenimiento",
    partsIncluded: "Aceite, Filtro de aire, Filtro de aceite",
    priceNote: "Aceite semisintético",
    price: "Desde Q650",
    duration: "30–60 min",
    featured: true,
    short: "Cambio de aceite y filtro con materiales incluidos.",
    description: "Aceite + filtro + mano de obra a domicilio, con materiales incluidos según vehículo y disponibilidad.",
    ideal: ["Mantenimiento programado", "Cambio de aceite", "Servicio a domicilio", "Materiales incluidos"],
    includes: ["Aceite según cotización", "Filtro de aceite", "Mano de obra", "Revisión rápida"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Kilometraje", "Ubicación"]
  },
  {
    id: "servicio-menor-plus",
    name: "Servicio Menor Plus",
    category: "Mantenimiento",
    partsIncluded: "Aceite, Filtro de aire, Filtro de aceite",
    priceNote: "Aceite full sintético premium",
    price: "Desde Q950",
    duration: "30–60 min",
    featured: true,
    short: "Servicio menor con filtro de aire incluido.",
    description: "Servicio menor con aceite, filtro de aceite, mano de obra y filtro de aire incluido según vehículo.",
    ideal: ["Mantenimiento más completo", "Aceite y filtros", "Servicio a domicilio", "Revisión rápida"],
    includes: ["Aceite según cotización", "Filtro de aceite", "Filtro de aire", "Mano de obra", "Revisión rápida"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Kilometraje", "Ubicación"]
  },

  {
    id: "cambio-candelas-bujias",
    name: "Cambio de candelas / bujías",
    category: "Mantenimiento",
    partsIncluded: "4 bujías Iridio",
    priceNote: "Precio con instalación incluida",
    price: "Desde Q800",
    duration: "30 min",
    featured: true,
    short: "Para mantenimiento, jalones o fallas de encendido.",
    description: "Cambio de candelas/bujías según vehículo. Si hay falla activa, se recomienda escaneo o diagnóstico para evitar cambiar piezas a ciegas.",
    ideal: ["Mantenimiento preventivo", "Jalones", "Misfire", "Tiembla en mínimo", "Consumo alto", "Arranque difícil"],
    includes: ["Revisión de acceso", "Cambio de candelas si aplica", "Observación de candelas retiradas", "Recomendación según condición"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Kilometraje", "Si hay falla o es preventivo", "Ubicación"],
    bookingPolicy: "Precio y tiempo dependen del vehículo, acceso, tipo de candela y si requiere diagnóstico previo."
  },
  {
    id: "filtro-cabina-instalado",
    name: "Filtro de cabina instalado",
    category: "Mantenimiento",
    partsIncluded: "Filtro de aire acondicionado",
    priceNote: "Instalación según el vehículo",
    price: "Desde Q175",
    duration: "30 min",
    featured: false,
    short: "Cambio de filtro de cabina.",
    description: "Instalación de filtro de cabina según acceso y modelo del vehículo.",
    ideal: ["Mal olor en A/C", "Flujo de aire bajo", "Mantenimiento preventivo", "Cambio de filtro"],
    includes: ["Instalación", "Revisión rápida del acceso", "Observación del filtro retirado"],
    dataNeeded: ["Marca", "Modelo", "Año", "Ubicación"]
  },
  {
    id: "cambio-banda-distribucion-accesorios",
    name: "Cambio de banda de distribución / accesorios",
    category: "Mantenimiento",
    partsIncluded: "Kit de distribución",
    priceNote: "Precio varía dependiendo del vehículo",
    price: "Desde Q2,500",
    duration: "180–360 min",
    featured: false,
    short: "Mantenimiento por kilometraje o chillido de bandas al arrancar.",
    description: "Cambio de banda de distribución o accesorios según el kilometraje recomendado por el fabricante o síntoma.",
    ideal: ["Mantenimiento por kilometraje", "Chillido al arrancar", "Banda visiblemente desgastada"],
    includes: ["Revisión de bandas", "Cotización de repuesto", "Cambio si se aprueba"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Kilometraje", "Ubicación"]
  },
  {
    id: "cambio-termostato",
    name: "Cambio de termostato",
    category: "Mantenimiento",
    partsIncluded: "Termostato",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q450",
    duration: "120–180 min",
    featured: false,
    short: "El carro se calienta o la aguja de temperatura no sube.",
    description: "Revisión del sistema de enfriamiento y cotización de termostato según tu vehículo antes de reparar.",
    ideal: ["Se calienta el motor", "Aguja de temperatura no sube", "Calefacción no calienta"],
    includes: ["Revisión del sistema de enfriamiento", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-bomba-agua",
    name: "Cambio de bomba de agua",
    category: "Mantenimiento",
    partsIncluded: "Bomba de agua",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q650",
    duration: "180–360 min",
    featured: false,
    short: "Fuga de refrigerante o el carro se calienta en marcha.",
    description: "Revisión del sistema de enfriamiento y cotización de bomba de agua según tu vehículo antes de reparar.",
    ideal: ["Fuga de refrigerante", "Se calienta en marcha", "Ruido en la bomba", "Mantenimiento por kilometraje"],
    includes: ["Revisión del sistema de enfriamiento", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-radiador",
    name: "Cambio de radiador",
    category: "Mantenimiento",
    partsIncluded: "Radiador Nuevo",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,700",
    duration: "120–180 min",
    featured: false,
    short: "Fuga visible en el radiador o el carro se calienta seguido.",
    description: "Revisión del radiador y cotización de repuesto según tu vehículo antes de reparar.",
    ideal: ["Fuga visible", "Se calienta seguido", "Radiador golpeado", "Aletas dañadas"],
    includes: ["Revisión del radiador", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-empaque-tapa-valvulas",
    name: "Cambio de empaque de tapa de válvulas",
    category: "Mantenimiento",
    partsIncluded: "Empaque Nuevo",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q550",
    duration: "60 min",
    featured: false,
    short: "Fuga de aceite en la parte superior del motor o olor a quemado.",
    description: "Revisión de la fuga y cotización del empaque de tapa de válvulas según tu vehículo antes de reparar.",
    ideal: ["Fuga de aceite arriba del motor", "Olor a aceite quemado", "Mancha de aceite en el block"],
    includes: ["Revisión de la fuga", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "servicio-frenos-recomendado",
    name: "Servicio de frenos recomendado",
    category: "Frenos",
    partsIncluded: "Pastillas Delanteras o traseras + Limpieza de cáliper lubricación de Pines y asientos de pastillas",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,000 por eje",
    duration: "60–120 min",
    featured: true,
    short: "Pastillas + mantenimiento de calipers.",
    description: "Servicio recomendado por eje con pastillas y mantenimiento de calipers, sujeto a vehículo y repuestos.",
    ideal: ["Cambio de pastillas", "Ruido al frenar", "Mantenimiento de calipers", "Frenos preventivos"],
    includes: ["Pastillas", "Mantenimiento de calipers", "Mano de obra", "Revisión del eje trabajado"],
    dataNeeded: ["Marca", "Modelo", "Año", "Eje delantero/trasero", "Síntoma", "Ubicación"],
    bookingPolicy: "Precio base por eje. Repuestos sujetos a vehículo y disponibilidad."
  },
  {
    id: "cambio-balatas-delanteras",
    name: "Cambio de balatas delanteras",
    category: "Frenos",
    partsIncluded: "Juego delantero",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q600",
    duration: "60 min",
    featured: false,
    short: "Chillido, raspado o poco frenado en el eje delantero.",
    description: "Cambio de balatas/pastillas delanteras. Confirmamos desgaste y cotizamos repuesto según tu vehículo antes de trabajar.",
    ideal: ["Chillido al frenar", "Raspado metálico", "Pedal más profundo", "Mantenimiento preventivo"],
    includes: ["Revisión de desgaste", "Cotización de repuesto", "Cambio si se aprueba", "Revisión del eje"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-balatas-traseras",
    name: "Cambio de balatas traseras",
    category: "Frenos",
    partsIncluded: "Juego trasero",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q600",
    duration: "60 min",
    featured: false,
    short: "Ruido o desgaste en el eje trasero, incluye tambor o disco según vehículo.",
    description: "Cambio de balatas traseras (tambor o disco según modelo). Confirmamos desgaste y cotizamos antes de trabajar.",
    ideal: ["Ruido en freno trasero", "Freno de mano flojo", "Mantenimiento preventivo"],
    includes: ["Revisión de desgaste", "Cotización de repuesto", "Cambio si se aprueba", "Revisión del eje"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-discos-freno",
    name: "Cambio de discos de freno",
    category: "Frenos",
    partsIncluded: "Juego delantero o trasero",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,400",
    duration: "120–360 min",
    featured: false,
    short: "Vibración al frenar o discos rayados/desgastados.",
    description: "Cambio de discos de freno cuando el desgaste o rayado no permite rectificar. Se confirma con revisión antes de cotizar.",
    ideal: ["Vibra el volante al frenar", "Disco rayado", "Disco desgastado", "Mantenimiento mayor"],
    includes: ["Revisión de discos", "Cotización de repuesto", "Cambio si se aprueba", "Revisión del eje"],
    dataNeeded: ["Marca", "Modelo", "Año", "Eje delantero/trasero", "Ubicación"]
  },
  {
    id: "inyeccion-admision-consulta",
    name: "Inyección y admisión",
    category: "Inyección y admisión",
    partsIncluded: "Diagnóstico",
    priceNote: "Revisión de inyectores y admisión",
    price: "Desde Q350",
    duration: "60–120 min",
    featured: false,
    short: "Servicios de admisión e inyección se confirman según vehículo.",
    description: "Categoría preparada para servicios de limpieza o revisión de admisión e inyección según el tipo de motor.",
    ideal: ["Mantenimiento de admisión", "Dudas de inyección", "Ralentí inestable", "Consumo o jalones"],
    includes: ["Revisión inicial", "Cotización según vehículo", "Ruta recomendada"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Síntoma", "Ubicación"]
  },
  {
    id: "limpieza-cuerpo-aceleracion",
    name: "Limpieza de cuerpo de aceleración",
    category: "Inyección y admisión",
    partsIncluded: "Limpieza",
    priceNote: "Precio varía según vehículo, ya incluye mano de obra",
    price: "Desde Q350",
    duration: "60–120 min",
    featured: false,
    short: "Para ralentí inestable, suciedad de admisión o mantenimiento preventivo.",
    description: "Limpieza de cuerpo de aceleración cuando aplica según vehículo, acceso y síntoma. Si hay falla activa se recomienda diagnóstico previo.",
    ideal: ["Ralentí inestable", "Mantenimiento de admisión", "Acelerador sucio", "Consumo o jalones"],
    includes: ["Revisión de acceso", "Limpieza si aplica", "Observación posterior", "Recomendación según condición"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Síntoma", "Ubicación"],
    bookingPolicy: "Sujeto a acceso, tipo de acelerador y condición del vehículo."
  },
  {
    id: "limpieza-admision",
    name: "Limpieza de admisión",
    category: "Inyección y admisión",
    partsIncluded: "Limpieza",
    priceNote: "Desmontaje de manifold y limpieza manual de válvulas de admisión",
    price: "Desde Q850",
    duration: "120–240 min",
    featured: false,
    short: "Servicio de admisión a cotizar según motor y acceso.",
    description: "Limpieza o mantenimiento de admisión según vehículo, tipo de motor, acceso y nivel de suciedad.",
    ideal: ["Mantenimiento preventivo", "Admisión sucia", "Consumo alto", "Ralentí inestable"],
    includes: ["Evaluación inicial", "Cotización según alcance", "Servicio si aplica", "Recomendación final"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Kilometraje", "Ubicación"]
  },
  {
    id: "limpieza-inyectores-gasolina",
    name: "Limpieza de inyectores gasolina",
    category: "Inyección y admisión",
    partsIncluded: "Limpieza",
    priceNote: "Desmontaje de riel y servicio completo a inyectores",
    price: "Desde Q1,500",
    duration: "180–360 min",
    featured: false,
    short: "Limpieza o servicio de inyectores según sistema y acceso.",
    description: "Servicio de inyectores a gasolina sujeto a tipo de inyección, acceso, empaques y condición del vehículo.",
    ideal: ["Jalones", "Consumo alto", "Mantenimiento", "Falla de mezcla", "Ralentí irregular"],
    includes: ["Evaluación inicial", "Confirmación de método", "Cotización de empaques si aplica", "Servicio según alcance"],
    dataNeeded: ["Marca", "Modelo", "Año", "Motor", "Tipo de falla", "Ubicación"]
  },

  {
    id: "tpms-electrico-bateria",
    name: "TPMS, eléctrico y batería",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Diagnóstico",
    priceNote: "Diagnóstico del sistema TPMS",
    price: "Desde Q350",
    duration: "60 min",
    featured: false,
    short: "Luces de sensores, batería, alternador o sistema eléctrico básico.",
    description: "Revisión inicial para fallas de sensores, batería, carga o luces relacionadas al sistema eléctrico.",
    ideal: ["TPMS", "Batería descargada", "Alternador", "Luces de sensores", "Arranque"],
    includes: ["Revisión inicial", "Escaneo si aplica", "Prueba según síntoma", "Cotización según alcance"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Si arranca", "Ubicación"]
  },
  {
    id: "cambio-alternador",
    name: "Cambio de alternador",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Alternador Nuevo",
    priceNote: "Desmontaje, búsqueda, instalación y pruebas",
    price: "Desde Q2,500",
    duration: "180–360 min",
    featured: false,
    short: "Luz de batería encendida o batería se descarga con el carro prendido.",
    description: "Revisamos el sistema de carga, confirmamos el diagnóstico y cotizamos el alternador según tu vehículo antes de reparar.",
    ideal: ["Luz de batería encendida", "Batería se descarga seguido", "Ruido de rodamiento", "Luces débiles al ralentí"],
    includes: ["Revisión del sistema de carga", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-motor-arranque",
    name: "Cambio de motor de arranque",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Motor de arranque Nuevo",
    priceNote: "Desmontaje, búsqueda, instalación y pruebas",
    price: "Desde Q2,500",
    duration: "180–360 min",
    featured: false,
    short: "Clic al girar la llave, arranque intermitente o motor no gira.",
    description: "Diagnóstico del sistema de arranque y cotización del motor de arranque según tu vehículo antes de reparar.",
    ideal: ["Solo hace clic", "Arranca a veces", "Motor no gira", "Ruido al arrancar"],
    includes: ["Revisión del sistema de arranque", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-bomba-combustible",
    name: "Cambio de bomba de combustible",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Bomba de combustible Nueva",
    priceNote: "Desmontaje, búsqueda, instalación y pruebas",
    price: "Desde Q2,000",
    duration: "180–360 min",
    featured: false,
    short: "Carro se apaga en marcha, cuesta arrancar o pierde fuerza.",
    description: "Diagnóstico del sistema de combustible y cotización de la bomba según tu vehículo antes de reparar.",
    ideal: ["Se apaga en marcha", "Cuesta arrancar en caliente", "Pierde fuerza en subida", "Ruido en el tanque"],
    includes: ["Revisión de presión de combustible", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-bobina-encendido",
    name: "Cambio de bobina de encendido",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Bobina Nueva",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q800",
    duration: "60 min",
    featured: false,
    short: "Check Engine con código de misfire o falla de un cilindro.",
    description: "Escaneo, confirmación del cilindro afectado y cotización de bobina según tu vehículo antes de reparar.",
    ideal: ["Check Engine parpadeando", "Falla de un cilindro", "Jaloneo al acelerar", "Código de misfire"],
    includes: ["Escaneo OBD-II", "Confirmación del cilindro afectado", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Código si lo tenés", "Ubicación"]
  },
  {
    id: "cambio-sensor-cigueñal",
    name: "Cambio de sensor de cigüeñal",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Sensor Nuevo",
    priceNote: "Instalación y pruebas",
    price: "Desde Q550",
    duration: "60–120 min",
    featured: false,
    short: "El carro se apaga sin previo aviso o no enciende de forma intermitente.",
    description: "Escaneo y confirmación del sensor de cigüeñal antes de cotizar el repuesto según tu vehículo.",
    ideal: ["Se apaga sin aviso", "No arranca a veces", "Código de sensor de posición", "Falla intermitente"],
    includes: ["Escaneo OBD-II", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-sensor-arbol-levas",
    name: "Cambio de sensor de árbol de levas",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Sensor Nuevo",
    priceNote: "Instalación y pruebas",
    price: "Desde Q550",
    duration: "60–120 min",
    featured: false,
    short: "Check Engine con código de sensor de fase o arranque difícil.",
    description: "Escaneo y confirmación del sensor de árbol de levas antes de cotizar el repuesto según tu vehículo.",
    ideal: ["Check Engine encendido", "Arranque difícil", "Código de sensor de fase", "Marcha irregular"],
    includes: ["Escaneo OBD-II", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Código si lo tenés", "Ubicación"]
  },
  {
    id: "cambio-sensor-oxigeno",
    name: "Cambio de sensor de oxígeno",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Sensor Nuevo",
    priceNote: "Instalación y pruebas",
    price: "Desde Q750",
    duration: "60–120 min",
    featured: false,
    short: "Check Engine con código de mezcla o consumo de gasolina más alto.",
    description: "Escaneo y confirmación del sensor de oxígeno antes de cotizar el repuesto según tu vehículo.",
    ideal: ["Check Engine encendido", "Consumo más alto de lo normal", "Código de mezcla rica/pobre", "Falla de emisiones"],
    includes: ["Escaneo OBD-II", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Código si lo tenés", "Ubicación"]
  },
  {
    id: "cambio-bombillo-faro",
    name: "Cambio de bombillo de faro",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Cambio de bombillas",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q100",
    duration: "60 min",
    featured: false,
    short: "Faro delantero o luz alta/baja fundida.",
    description: "Cambio de bombillo de faro según acceso y tipo de luz de tu vehículo.",
    ideal: ["Luz fundida", "Faro parpadea", "Revisión antes de viaje", "Mantenimiento preventivo"],
    includes: ["Revisión del acceso", "Cambio del bombillo", "Prueba de luces"],
    dataNeeded: ["Marca", "Modelo", "Año", "Lado y tipo de luz", "Ubicación"]
  },
  {
    id: "cambio-motor-vidrio-electrico",
    name: "Cambio de motor de vidrio eléctrico",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Motor o mando nuevo",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q750",
    duration: "120 min",
    featured: false,
    short: "El vidrio eléctrico no sube, no baja o hace ruido raro.",
    description: "Revisión del mecanismo del vidrio y cotización del motor/regulador según tu vehículo antes de reparar.",
    ideal: ["Vidrio no sube", "Vidrio no baja", "Ruido al subir/bajar", "Se traba a medio camino"],
    includes: ["Revisión del mecanismo", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Puerta afectada", "Ubicación"]
  },
  {
    id: "cambio-manija-puerta",
    name: "Cambio de manija exterior de puerta",
    category: "TPMS, eléctrico y batería",
    partsIncluded: "Manijas Nuevas",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,200",
    duration: "120–360 min",
    featured: false,
    short: "La manija de la puerta está quebrada o no abre bien.",
    description: "Cambio de manija exterior de puerta según modelo y disponibilidad del repuesto.",
    ideal: ["Manija quebrada", "No abre desde afuera", "Se siente floja"],
    includes: ["Revisión del mecanismo", "Cotización de repuesto", "Cambio si se aprueba"],
    dataNeeded: ["Marca", "Modelo", "Año", "Puerta afectada", "Ubicación"]
  },
  {
    id: "ac-suspension-varios",
    name: "A/C, suspensión y varios",
    category: "A/C, suspensión y varios",
    price: "Según evaluación",
    duration: "Según servicio",
    featured: false,
    short: "Aire acondicionado, suspensión, dirección y otros servicios a confirmar.",
    description: "Categoría para servicios que requieren confirmar síntoma, vehículo, acceso y condiciones antes de definir el alcance.",
    ideal: ["A/C no enfría", "Golpes de suspensión", "Dirección", "Ruidos", "Servicios varios"],
    includes: ["Revisión según síntoma", "Cotización por alcance", "Confirmación de materiales si aplica"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación", "Fecha ideal"]
  },
  {
    id: "cambio-amortiguadores",
    name: "Cambio de amortiguadores",
    category: "A/C, suspensión y varios",
    partsIncluded: "Par delantero o trasero",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,800",
    duration: "120–360 min",
    featured: false,
    short: "Golpes secos en baches, carro rebota o se hunde en curvas.",
    description: "Revisión de la suspensión y cotización de amortiguadores según tu vehículo antes de reparar.",
    ideal: ["Rebota al pasar bache", "Se hunde en curvas", "Ruido seco en suspensión", "Mantenimiento preventivo"],
    includes: ["Revisión de suspensión", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-rotulas",
    name: "Cambio de rótulas",
    category: "A/C, suspensión y varios",
    partsIncluded: "Rótula individual",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q450",
    duration: "60–120 min",
    featured: false,
    short: "Clonc al pasar baches o girar el volante.",
    description: "Revisión de rótulas y cotización de repuesto según tu vehículo antes de reparar.",
    ideal: ["Clonc al girar", "Ruido en baches", "Vibración en el volante", "Mantenimiento preventivo"],
    includes: ["Revisión de rótulas", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-terminales-direccion",
    name: "Cambio de terminales de dirección",
    category: "A/C, suspensión y varios",
    partsIncluded: "Terminal de dirección individual",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q500",
    duration: "120–180 min",
    featured: false,
    short: "Volante se siente flojo o desgaste irregular de llantas.",
    description: "Revisión del sistema de dirección y cotización de terminales según tu vehículo antes de reparar.",
    ideal: ["Volante flojo", "Desgaste irregular de llantas", "Ruido al girar"],
    includes: ["Revisión de terminales", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-bomba-direccion-hidraulica",
    name: "Cambio de bomba de dirección hidráulica",
    category: "A/C, suspensión y varios",
    partsIncluded: "Bomba Nueva",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q1,500",
    duration: "180–360 min",
    featured: false,
    short: "Dirección pesada o ruido al girar el volante.",
    description: "Revisión del sistema de dirección hidráulica y cotización de bomba según tu vehículo antes de reparar.",
    ideal: ["Dirección pesada", "Ruido al girar", "Fuga de líquido hidráulico"],
    includes: ["Revisión del sistema", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "cambio-rodamiento-rueda",
    name: "Cambio de rodamiento de rueda",
    category: "A/C, suspensión y varios",
    partsIncluded: "Rodamiento Nuevo",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra, incluye torno",
    price: "Desde Q1,200",
    duration: "180–360 min",
    featured: false,
    short: "Zumbido que cambia con la velocidad, más fuerte en curvas.",
    description: "Revisión del rodamiento y cotización de repuesto según tu vehículo antes de reparar.",
    ideal: ["Zumbido con la velocidad", "Ruido más fuerte en curvas", "Vibración en la llanta"],
    includes: ["Revisión del rodamiento", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Rueda afectada", "Ubicación"]
  },
  {
    id: "cambio-bujes-suspension",
    name: "Cambio de bujes de suspensión",
    category: "A/C, suspensión y varios",
    partsIncluded: "Bujes de muleta o barra",
    priceNote: "Precio varía según el vehículo, ya incluye mano de obra",
    price: "Desde Q350",
    duration: "120–180 min",
    featured: false,
    short: "Ruido de goma reseca o vibración en la carrocería al pasar baches.",
    description: "Revisión de bujes y cotización de repuesto según tu vehículo antes de reparar.",
    ideal: ["Ruido de goma", "Vibración en baches", "Mantenimiento preventivo"],
    includes: ["Revisión de bujes", "Confirmación del diagnóstico", "Cotización de repuesto y mano de obra"],
    dataNeeded: ["Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  },
  {
    id: "otros-servicios",
    name: "Otros / no aparece en la lista",
    category: "Otros",
    price: "Cotización personalizada",
    duration: "60–120 min estimados",
    featured: false,
    requiresDescription: true,
    short: "Contanos qué necesitás aunque no sepás cómo se llama.",
    description: "Salida abierta para cualquier reparación, mantenimiento o clavo que no aparezca en el catálogo. D-TEK confirma alcance, repuestos, tiempo y precio antes de realizarlo.",
    ideal: ["Otro servicio", "No sé cómo se llama", "Necesito varias cosas", "Quiero una cotización"],
    includes: ["Revisión de la solicitud", "Cotización según alcance", "Confirmación antes de trabajar"],
    dataNeeded: ["Qué necesitás", "Marca", "Modelo", "Año", "Síntoma", "Ubicación"]
  }
];


const dtekServiceGroups = [
  { id: "diagnostico", title: "Revisión y diagnóstico", hint: "Luces, jalones, escáner, datos en vivo y fallas raras.", services: ["revision-express", "check-engine-escaneo-explicado", "escaneo-datos-vivo", "diagnostico-pro", "aprendizajes-calibraciones-simples"] },
  { id: "compra", title: "Compra segura", hint: "Para revisar un usado antes de pagar.", services: ["compra-segura", "compra-segura-avanzada"] },
  { id: "mantenimiento", title: "Mantenimiento", hint: "Aceite, filtros, reset, candelas y servicio preventivo.", services: ["mantenimiento-express-mo", "servicio-menor-full", "servicio-menor-plus", "cambio-candelas-bujias", "filtro-cabina-instalado", "reset-mantenimiento-servicio", "cambio-banda-distribucion-accesorios", "cambio-termostato", "cambio-bomba-agua", "cambio-radiador", "cambio-empaque-tapa-valvulas"] },
  { id: "frenos", title: "Frenos", hint: "Ruidos, vibraciones o mantenimiento por eje.", services: ["servicio-frenos-recomendado", "cambio-balatas-delanteras", "cambio-balatas-traseras", "cambio-discos-freno"] },
  { id: "inyeccion", title: "Inyección y admisión", hint: "Admisión, mezcla, consumo y ralentí inestable.", services: ["inyeccion-admision-consulta", "limpieza-cuerpo-aceleracion", "limpieza-admision", "limpieza-inyectores-gasolina"] },
  { id: "electrico", title: "TPMS, eléctrico y batería", hint: "Arranque, batería, alternador, TPMS y sensores.", services: ["tpms-electrico-bateria", "cambio-alternador", "cambio-motor-arranque", "cambio-bomba-combustible", "cambio-bobina-encendido", "cambio-sensor-cigueñal", "cambio-sensor-arbol-levas", "cambio-sensor-oxigeno", "cambio-bombillo-faro", "cambio-motor-vidrio-electrico", "cambio-manija-puerta"] },
  { id: "varios", title: "A/C, suspensión y varios", hint: "A/C, golpes, dirección, vibraciones y casos a confirmar.", services: ["ac-suspension-varios", "cambio-amortiguadores", "cambio-rotulas", "cambio-terminales-direccion", "cambio-bomba-direccion-hidraulica", "cambio-rodamiento-rueda", "cambio-bujes-suspension"] },
  { id: "otros", title: "Otros", hint: "¿No aparece lo que necesitás? Contanos el clavo y lo cotizamos.", services: ["otros-servicios"] }
];

const dtekSymptomGroups = [
  { id: "check-engine", label: "Se encendió el Check Engine", chapin: "Luz amarilla prendida", recommended: ["check-engine-escaneo-explicado", "diagnostico-pro"] },
  { id: "jalones", label: "El carro jalonea", chapin: "Va dando jaloncitos", recommended: ["diagnostico-pro", "escaneo-datos-vivo", "cambio-candelas-bujias", "limpieza-inyectores-gasolina"] },
  { id: "sin-fuerza", label: "No tiene fuerza", chapin: "Se siente huevón / no sube", recommended: ["diagnostico-pro", "escaneo-datos-vivo"] },
  { id: "arranque", label: "Le cuesta arrancar", chapin: "Da starter pero cuesta", recommended: ["tpms-electrico-bateria", "diagnostico-pro", "cambio-candelas-bujias"] },
  { id: "no-arranca", label: "No arranca", chapin: "Se quedó tirado", recommended: ["diagnostico-pro", "tpms-electrico-bateria"] },
  { id: "consume", label: "Gasta mucha gasolina", chapin: "Está gastón", recommended: ["escaneo-datos-vivo", "diagnostico-pro", "limpieza-cuerpo-aceleracion", "limpieza-inyectores-gasolina"] },
  { id: "minimo", label: "Tiembla en mínimo", chapin: "Se siente tembloroso parado", recommended: ["diagnostico-pro", "escaneo-datos-vivo", "cambio-candelas-bujias", "limpieza-cuerpo-aceleracion"] },
  { id: "caja", label: "La caja patea o patina", chapin: "Pega patadas / se tarda", recommended: ["diagnostico-pro", "escaneo-datos-vivo"] },
  { id: "frenos-ruido", label: "Hace ruido al frenar", chapin: "Chilla / raspa", recommended: ["servicio-frenos-recomendado", "revision-express"] },
  { id: "vibra-frena", label: "Vibra al frenar", chapin: "Tiembla cuando freno", recommended: ["servicio-frenos-recomendado", "revision-express"] },
  { id: "suspension", label: "Truena al pasar túmulos", chapin: "Hace clonc / golpe", recommended: ["ac-suspension-varios", "revision-express"] },
  { id: "ac", label: "El A/C no enfría", chapin: "Solo tira aire caliente", recommended: ["ac-suspension-varios", "revision-express"] },
  { id: "tpms", label: "Luz de presión de llantas", chapin: "Luz de llantita", recommended: ["tpms-electrico-bateria"] },
  { id: "comprar", label: "Quiero comprar un carro usado", chapin: "Quiero revisarlo antes de pagar", recommended: ["compra-segura", "compra-segura-avanzada"] }
];


const dtekAddOns = [
  {
    id: "limpieza-bornes-bateria",
    durationMinutes: 20,
    priceAmount: 50,
    name: "Limpieza de bornes de batería",
    price: "+Q50",
    category: "Eléctrico básico",
    short: "Limpieza y protección básica de bornes cuando hay sarro o falso contacto."
  },
  {
    id: "rotacion-llantas",
    durationMinutes: 30,
    priceAmount: 200,
    name: "Rotación de llantas",
    price: "+Q200",
    category: "Llantas",
    short: "Rotación simple cuando el acceso, herramienta y estado de llantas lo permiten."
  },
  {
    id: "cambio-liquido-hidraulico",
    durationMinutes: 45,
    priceAmount: 350,
    name: "Cambio de líquido hidráulico / dirección",
    price: "+Q350",
    category: "Fluidos",
    short: "Servicio sujeto a tipo de sistema, fluido correcto y condición actual."
  },
  {
    id: "flush-refrigerante",
    durationMinutes: 75,
    priceAmount: 750,
    name: "Flush / cambio de refrigerante",
    price: "+Q750",
    category: "Enfriamiento",
    short: "Cambio o limpieza de sistema de refrigeración según acceso y tipo de refrigerante."
  },
  {
    id: "revision-presion-llantas",
    durationMinutes: 10,
    priceAmount: null,
    name: "Revisión de presión de llantas",
    price: "Agregar si aplica",
    category: "Llantas",
    short: "Revisión rápida de presión y observación visual durante el servicio."
  },
  {
    id: "revision-bateria-carga",
    durationMinutes: 20,
    priceAmount: 50,
    name: "Revisión rápida de batería y carga",
    price: "+Q50",
    category: "Eléctrico básico",
    short: "Medición rápida de batería/alternador cuando el servicio lo permite."
  },
  {
    id: "cambio-filtro-aire-motor",
    durationMinutes: 20,
    priceAmount: 200,
    name: "Cambio de filtro de aire motor",
    price: "+Q200",
    category: "Mantenimiento",
    short: "Agregar filtro de aire motor si hay disponibilidad y acceso simple."
  },
  {
    id: "filtro-cabina-addon",
    durationMinutes: 30,
    priceAmount: 175,
    name: "Cambio de filtro de cabina",
    price: "+Q175",
    category: "Mantenimiento / A/C",
    short: "Útil por mal olor, bajo flujo de aire o mantenimiento preventivo."
  },
  {
    id: "limpieza-cuerpo-aceleracion-addon",
    durationMinutes: 60,
    priceAmount: 350,
    name: "Limpieza de cuerpo de aceleración",
    price: "+Q350",
    category: "Admisión",
    short: "Extra posible si el acceso y síntoma lo justifican."
  }
];

const dtekFaqs = [
  ["¿Por qué primero elegir servicio?", "Para no cortar el embudo. Primero elegís el servicio, luego día/hora y datos del vehículo. Al final se genera un WhatsApp completo y ordenado."],
  ["¿La agenda confirma automáticamente la cita?", "No. La solicitud queda sujeta a confirmación según ubicación, acceso, tipo de vehículo y disponibilidad."],
  ["¿Los precios son finales?", "Son precios de referencia base, calculados sobre un sedán de 4 cilindros. Incluyen la mano de obra y, cuando el servicio lo indica, también el repuesto: nosotros lo conseguimos y lo compramos. El total final puede cambiar según el vehículo, el acceso y lo que encontremos en la revisión. Los que dicen «solo mano de obra» no traen repuesto."],
  ["¿Hacen revisión antes de comprar carro?", "Sí. Compra Segura y Compra Segura Avanzada están pensadas para revisar antes de pagar por un usado."],
  ["¿Usan escáner?", "Sí. El escáner se combina con revisión visual, datos en vivo y criterio técnico según el caso."],
  ["¿Qué pasa si el carro no enciende?", "Igual podés llenar la solicitud. En el WhatsApp final queda indicado si arranca y se mueve para confirmar si aplica visita o diagnóstico previo."],
  ["¿Cómo funcionan los puntos?", "Cada servicio completado suma 1 punto por cada Q10. Un referido convertido suma 100 puntos. Los puntos se canjean dentro de Garage D-TEK."]
];

const dtekTimeSlots = ["8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM"];

/* Agenda propia D-TEK: configuración local tipo Setmore, creada desde cero. */
const DTEK_APPOINTMENTS_STORAGE_KEY = "dtek_web_os_appointments_v1";
const DTEK_SCHEDULER_VERSION = "v5-own-scheduler-local";

const dtekWorkingHours = {
  0: null, // domingo cerrado
  1: { start: "08:00", end: "18:00" },
  2: { start: "08:00", end: "18:00" },
  3: { start: "08:00", end: "18:00" },
  4: { start: "08:00", end: "18:00" },
  5: { start: "08:00", end: "18:00" },
  6: { start: "08:00", end: "13:00" }
};

const dtekBookingSettings = {
  "revision-express": { durationMinutes: 45, bufferBefore: 15, bufferAfter: 30, directBooking: true },
  "check-engine-escaneo-explicado": { durationMinutes: 60, bufferBefore: 15, bufferAfter: 30, directBooking: true },
  "escaneo-datos-vivo": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "compra-segura": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "compra-segura-avanzada": { durationMinutes: 180, bufferBefore: 45, bufferAfter: 60, directBooking: true },
  "diagnostico-pro": { durationMinutes: 360, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "aprendizajes-calibraciones-simples": { durationMinutes: 120, bufferBefore: 15, bufferAfter: 30, directBooking: true },
  "reset-mantenimiento-servicio": { durationMinutes: 30, bufferBefore: 15, bufferAfter: 15, directBooking: true },
  "mantenimiento-express-mo": { durationMinutes: 75, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "servicio-menor-full": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "servicio-menor-plus": { durationMinutes: 105, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "cambio-candelas-bujias": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "filtro-cabina-instalado": { durationMinutes: 40, bufferBefore: 15, bufferAfter: 15, directBooking: true },
  "servicio-frenos-recomendado": { durationMinutes: 150, bufferBefore: 45, bufferAfter: 60, directBooking: true },
  "inyeccion-admision-consulta": { durationMinutes: 120, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "limpieza-cuerpo-aceleracion": { durationMinutes: 75, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "limpieza-admision": { durationMinutes: 240, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "limpieza-inyectores-gasolina": { durationMinutes: 360, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "tpms-electrico-bateria": { durationMinutes: 75, bufferBefore: 30, bufferAfter: 30, directBooking: true },
  "ac-suspension-varios": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 45, directBooking: true },
  "otros-servicios": { durationMinutes: 90, bufferBefore: 30, bufferAfter: 45, directBooking: true }
};

dtekServices.forEach((service) => {
  const defaults = { durationMinutes: 60, bufferBefore: 30, bufferAfter: 30, directBooking: true };
  Object.assign(service, defaults, dtekBookingSettings[service.id] || {});
  service.totalBlockMinutes = service.durationMinutes + service.bufferBefore + service.bufferAfter;
});

/* D-TEK v25 · Datos compartidos para selectores progresivos */
window.DTEK_VEHICLE_CATALOG = dtekVehicleCatalog;
window.DTEK_SERVICES = dtekServices;
window.DTEK_SERVICE_GROUPS = dtekServiceGroups;
window.DTEK_SYMPTOM_GROUPS = dtekSymptomGroups;
window.DTEK_ADD_ONS = dtekAddOns;
window.DTEK_ENGINE_OPTIONS = [
  "No sé", "0.8", "1.0", "1.2", "1.3", "1.4", "1.5", "1.6", "1.8", "2.0", "2.2", "2.4", "2.5", "2.7", "3.0", "3.5", "4.0", "5.0", "Diésel", "Turbo", "Híbrido", "Eléctrico", "Otro"
];
