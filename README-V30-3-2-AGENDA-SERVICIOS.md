# D-TEK WEB v30.3.3 — Corrección de solicitudes

## Problema encontrado

El selector mostraba **Otros / no aparece en la lista**, pero ese servicio no existía en la tabla `public.services` de Supabase. La función de agenda rechazaba la solicitud como “Servicio inválido o inactivo” y el frontend escondía el motivo bajo un mensaje genérico.

Además, el catálogo visual tenía 21 servicios y las migraciones anteriores no garantizaban que los 21 estuvieran activos en Supabase.

## Correcciones

- Sincronización completa de los 21 servicios del frontend con Supabase.
- `otros-servicios` queda como servicio real y visible en administración.
- El frontend respeta `backendServiceId` cuando algún servicio use alias en el futuro.
- Las cuentas que entran solo con usuario pueden solicitar servicio sin agregar correo.
- Se evita guardar el correo sintético `@login.dtekgt.com` como contacto del cliente.
- El botón se bloquea mientras guarda para evitar solicitudes duplicadas.
- Los errores de horario, sesión, vehículo y servicio ahora muestran una causa útil.
- Caché del sitio elevada a `v=30.3.3`.

## Activación

1. En Supabase, abrir **SQL Editor**.
2. Ejecutar `database/16_v30_3_2_booking_catalog_fix.sql`.
3. Confirmar que el resultado final sea `active_catalog_services = 21`.
4. Subir esta carpeta completa a Vercel.
5. Abrir el sitio en una ventana privada o recargar con `Ctrl + F5`.
