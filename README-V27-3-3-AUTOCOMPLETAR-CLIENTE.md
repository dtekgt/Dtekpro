# D-TEK Web v27.3.3 — Datos del cliente sin repetición

Corrección de prioridad alta en el paso 4 de Agenda.

## Comportamiento nuevo

- Si hay una sesión activa, Agenda carga automáticamente nombre, teléfono, correo, dirección y zona/municipio.
- La prioridad de datos es: perfil guardado → metadatos de acceso Google/correo → preferencias locales → última cita del cliente.
- Los campos completos se compactan y ya no obligan al cliente a volver a llenarlos.
- Solo quedan visibles los datos que realmente falten.
- El cliente puede pulsar “Cambiar datos” para corregirlos.
- Después de guardar una cita, los datos utilizados se guardan en el perfil para la próxima reserva.

## Alcance

No se cambió la lógica de servicios, fechas, horarios, disponibilidad ni puntos.
