# D-TEK v34 — Plan preventivo por vehículo

## Qué cambió

- El expediente muestra una lista completa por sistemas y barras de vida restante.
- El plan se resuelve usando marca, línea y año del vehículo.
- Ford Escape 2013–2019 incluye intervalos propios y enlace a la fuente de Ford.
- Los vehículos sin ficha específica reciben un plan base claramente identificado como provisional.
- Al cerrar un trabajo, el administrador puede:
  - marcar un mantenimiento como realizado;
  - registrar el kilometraje;
  - cambiar el intervalo en meses o kilómetros;
  - registrar inspecciones reales de frenos, llantas, batería, suspensión y otros sistemas.
- La barra se reinicia únicamente cuando se marca **Servicio realizado hoy**.
- Los estados de inspección no inventan porcentajes.

## Migración obligatoria

Después de haber ejecutado `database/20_estado_vehiculo.sql`, ejecutar:

`database/21_planes_preventivos_editables.sql`

La migración no borra información. Añade los intervalos editables y actualiza el
kilometraje del vehículo cuando el administrador concluye un servicio.

## Cómo ampliar el catálogo

Los perfiles específicos están en `vehicle-health.js`, dentro de
`planForVehicle()`. Cada perfil debe indicar fuente, enlace y valores por
`component_key`. Si no existe un perfil comprobado, D-TEK usa el plan base y el
administrador puede ajustar el intervalo al revisar el manual correcto.

