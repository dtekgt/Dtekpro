# D-TEK WEB v30.3.1 — Admin por usuario o correo

Corrección aplicada sobre v30.3.0:

- El acceso de `admin-backend.html` acepta texto, no solo correos.
- El administrador puede iniciar sesión con **usuario o correo**.
- La resolución de usuario funciona también para cuentas existentes con correo real.
- Se conserva la validación del rol `admin` después del inicio de sesión.

## Actualización de Supabase existente

Ejecutar en Supabase SQL Editor:

`database/15_v30_3_1_admin_username.sql`

Después, confirmar que la cuenta admin tenga un usuario asignado:

```sql
update public.profiles
set username = 'dominic', role = 'admin'
where lower(email) = lower('TU_CORREO_ADMIN');
```

El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto o guion bajo.
