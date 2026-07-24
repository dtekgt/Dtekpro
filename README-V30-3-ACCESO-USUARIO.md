# D-TEK v30.3 — Acceso por usuario o correo

## Qué cambia

- El cliente entra con **usuario o correo + contraseña**.
- El correo pasa a ser **opcional** en cuentas locales D-TEK.
- Google continúa disponible, pero como alternativa opcional.
- Si un correo/usuario no existe, el portal ofrece crear la cuenta.
- Desde Perfil, el cliente puede cambiar su **usuario**, agregar/quitar correo y cambiar su contraseña.
- Las cuentas entregadas por D-TEK muestran aviso de contraseña temporal hasta que el cliente la cambie.
- El panel `admin-backend.html` ahora puede crear el acceso, carro y último servicio en una sola operación.

## Instalación obligatoria

1. En Supabase SQL Editor, ejecutar:
   `database/14_v30_3_local_access.sql`
2. En Supabase: Authentication → Providers → Email, desactivar **Confirm email** mientras se use acceso local sin correo.
3. Publicar todos los archivos del paquete en Netlify.

## Decisión de arquitectura

Supabase Auth sigue manejando contraseñas. Nunca se guardan contraseñas en `profiles` ni en JavaScript. Para una cuenta sin correo se usa un correo interno sintético (`usuario@login.dtekgt.com`) únicamente como identificador técnico; el cliente nunca necesita verlo. El correo real, cuando existe, se guarda aparte como `contact_email`.

## Entrega de credenciales

En `admin-backend.html`, el bloque **Crear acceso de cliente** permite generar usuario y contraseña temporal. El cliente puede conservarlos o cambiarlos desde Perfil → Usuario y contraseña.

## Nota

La creación desde el panel admin utiliza un cliente Supabase aislado con `persistSession: false`, por lo que no cierra ni reemplaza la sesión administrativa.
