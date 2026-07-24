# D-TEK WEB v30.3.3 — Recuperación de contraseña

## Qué corrige

Antes, el correo de recuperación autenticaba temporalmente al usuario pero lo devolvía a la página principal, donde no existía ningún formulario para crear la contraseña nueva.

Esta versión agrega:

- Botón **Olvidé mi contraseña** en el acceso admin.
- Botón equivalente en el Garage del cliente.
- Página `reset-password.html` para establecer la nueva contraseña.
- Redirección automática desde la portada cuando un enlace antiguo de Supabase vuelve con `type=recovery`.
- Cierre de la sesión temporal después de cambiar la contraseña.

## Configuración necesaria en Supabase

En **Authentication → URL Configuration**:

- Site URL: `https://dtekpro.vercel.app`
- Redirect URLs: agregar `https://dtekpro.vercel.app/reset-password.html`

También puede agregarse `https://dtekpro.vercel.app/reset-password` por compatibilidad con rutas limpias de Vercel.

## Uso

1. Publicar esta versión.
2. Abrir `https://dtekpro.vercel.app/admin-backend.html`.
3. Escribir el usuario o correo admin.
4. Presionar **Olvidé mi contraseña**.
5. Abrir el correo y crear la contraseña nueva.
