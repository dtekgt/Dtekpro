# D-TEK v37 · Garage profesional

## Qué cambia

- Conserva la identidad oscura grafito, carbón y rojo D-TEK.
- La navegación de escritorio tiene dos estados:
  - Completa y con texto al entrar.
  - Más delgada al desplazarse, conservando texto e iconos.
- El Garage usa tres áreas en escritorio:
  - Selector rápido de carros a la izquierda.
  - Expediente y mantenimiento al centro.
  - Panel `En el radar` a la derecha.
- El cambio de carro actualiza el expediente sin salir del Garage.
- La línea de vida queda fija dentro del expediente y usa dos escalas paralelas:
  - Fecha.
  - Kilómetros o millas.
- Los servicios terminados se posicionan con su fecha y recorrido registrados.
- El próximo vencimiento se añade como punto ámbar estimado.
- El lateral mantiene visibles cuatro mantenimientos, el último trabajo y la próxima cita.
- En móvil se conserva la navegación inferior, el selector de carros es horizontal y el panel lateral se transforma en un carrusel.

## Datos y compatibilidad

- No agrega tablas ni columnas.
- No requiere una migración nueva.
- Conserva `database/20_estado_vehiculo.sql`.
- Conserva `database/21_planes_preventivos_editables.sql`.
- La preferencia km/millas sigue guardándose localmente.
- El enlace externo al manual continúa eliminado.

## Archivos principales

- `cliente.html`
- `portal-cliente.js`
- `vehicle-health.js`
- `styles.css`
