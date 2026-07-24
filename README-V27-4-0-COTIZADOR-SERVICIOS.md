# D-TEK WEB v27.4.0 PREVIEW

## Constructor de servicios y cotización inicial

Esta versión transforma el paso de Servicios de Agenda en un constructor de solicitud múltiple.

### Cambios principales

- El cliente puede agregar y quitar varios servicios dentro de una misma cita.
- Se agregó la categoría **Otros** con la opción **Otros / no aparece en la lista**.
- Al elegir Otros, el cliente debe describir brevemente el trabajo o problema antes de continuar.
- Los servicios adicionales existentes ahora aparecen de forma visible dentro de Agenda y en la página Servicios.
- La cotización inicial se actualiza mientras el cliente agrega o quita elementos.
- Los trabajos con precio conocido se suman; los variables se muestran como **por cotizar** para no prometer un total falso.
- La duración usada para ofrecer horarios suma los tiempos estimados de los servicios y adicionales seleccionados.
- El primer servicio seleccionado se conserva como servicio principal para mantener compatibilidad con el backend actual.
- Los demás servicios, adicionales y la descripción de Otros se guardan dentro de la solicitud y el mensaje de WhatsApp.

### Compatibilidad

- No requiere una migración SQL.
- No cambia las funciones RPC existentes.
- No cambia autenticación, puntos, referidos ni reglas de disponibilidad.
- Todos los recursos usan caché `v=27.4.0`.

### QA local

Probado a 320 px y 375 px:

- selección de tres servicios y un adicional;
- cotización `Desde Q550 + por cotizar`;
- descripción obligatoria de Otros;
- avance a fecha y horario;
- cálculo de horarios usando la duración combinada;
- nueve servicios adicionales visibles;
- cero desbordamiento horizontal;
- cero errores de consola;
- los nueve archivos JavaScript pasan revisión de sintaxis;
- cero referencias locales faltantes.
