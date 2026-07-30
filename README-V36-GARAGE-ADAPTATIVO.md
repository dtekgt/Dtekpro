# D-TEK v36 — Garage adaptativo

## Qué cambia

- Se elimina el enlace externo al manual del propietario.
- El criterio preventivo se explica dentro del Garage en lenguaje sencillo.
- El catálogo general se amplía y se filtra según motor, combustible, caja y tracción conocidos.
- El plan se ajusta por uso normal o exigente.
- Los intervalos personalizados guardados por administración tienen prioridad.
- Se conservan las barras paralelas: tiempo arriba y recorrido abajo.
- El cliente elige kilómetros o millas sin modificar los datos internos.
- La navegación queda en Inicio, Garage, Agenda y Cuenta.
- Puntos y recompensas siguen disponibles desde Inicio y Cuenta, sin ocupar un destino permanente.
- Los carros aparecen como selector persistente y cambian el perfil con un toque.
- Se corrige la cascada de estilos que podía dejar el tablero blanco o sin contraste.

## Criterios de verdad

- `Sin revisar` nunca se convierte automáticamente en `Vencido`.
- Frenos, llantas, batería, dirección, suspensión y otros componentes físicos necesitan inspección.
- Un elemento no aplicable se omite cuando los datos del vehículo permiten identificarlo.
- El cierre administrativo puede corregir intervalos; esos valores guardados prevalecen sobre el plan base.

## Base de datos

No requiere una migración adicional. Mantiene:

1. `database/20_estado_vehiculo.sql`
2. `database/21_planes_preventivos_editables.sql`

## Despliegue

Reemplazar el contenido del repositorio, hacer commit y push. Los parámetros de versión de CSS y JavaScript ya fueron actualizados para evitar que el navegador conserve la interfaz anterior.
