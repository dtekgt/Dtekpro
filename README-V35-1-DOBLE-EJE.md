# D-TEK v35.1 — Doble eje de mantenimiento

## Cambio principal

El Pasaporte del Vehículo muestra por separado y en paralelo:

- vida restante por tiempo;
- vida restante por recorrido.

La línea de tiempo aparece arriba y la de kilómetros o millas abajo. El estado
del mantenimiento sigue determinado por la referencia que venza primero.

## Elección del cliente

El cliente puede escoger `km` o `millas` desde el encabezado del tablero. La
preferencia queda recordada en el navegador. Los datos internos continúan
guardándose en kilómetros para mantener compatibilidad con Supabase y con los
registros anteriores.

No requiere una migración nueva. Continúan siendo necesarias las migraciones
20 y 21 de las versiones anteriores.
