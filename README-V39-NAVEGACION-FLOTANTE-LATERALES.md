# D-TEK v39 — Navegación flotante y laterales retráctiles

## Objetivo

Evitar que las herramientas del Garage y los próximos mantenimientos queden
sepultados al final de la pantalla, conservando el contenido central limpio.

## Cambios

- Barra inferior móvil convertida en una cápsula flotante con cinco destinos y
  texto siempre visible.
- Encabezado flotante y compacto al desplazarse en móvil y escritorio.
- Panel izquierdo retráctil para:
  - cambiar de carro;
  - agregar otro carro;
  - actualizar kilometraje;
  - abrir puntos, citas y cuenta.
- Panel derecho retráctil para:
  - próximos mantenimientos;
  - último trabajo;
  - próxima cita;
  - historial;
  - solicitar servicio.
- Pestañas laterales visibles después de desplazarse, sin tapar la entrada del
  Garage.
- Cierre mediante botón, fondo, tecla Escape y gesto horizontal.
- Línea de fecha y kilometraje persistente debajo del encabezado.
- Resumen corto dentro del contenido para descubrir el panel derecho sin bajar
  hasta el listado completo.
- Escritorio mantiene tres columnas: carros, contenido y próximos
  mantenimientos.
- Paleta oscura D-TEK y recursos con versión `39000001`.

## Datos

No requiere migración SQL. Conserva las 21 migraciones y los contratos
existentes de Supabase.
