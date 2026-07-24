# Activar “Continuar con Google” — Garage D-TEK

La web ya contiene el código de Google OAuth. El botón solo empieza a funcionar cuando Google y Supabase autorizan el mismo proyecto y las mismas direcciones.

## 1. Google Cloud / Google Auth Platform

Crear un cliente OAuth de tipo **Web application**.

### Authorized JavaScript origins

```text
https://dtekpro.netlify.app
http://127.0.0.1:5500
http://localhost:5500
```

### Authorized redirect URI

Usar el callback del proyecto Supabase:

```text
https://bsgvtlkgvjixrhoxxbhl.supabase.co/auth/v1/callback
```

Guardar el **Client ID** y **Client Secret**.

> El Client Secret nunca se pega en `supabase-config.js`, HTML ni JavaScript público.

## 2. Supabase

Entrar a **Authentication → Sign In / Providers → Google**:

1. Activar Google.
2. Pegar el Client ID.
3. Pegar el Client Secret.
4. Guardar.

Después entrar a **Authentication → URL Configuration**.

### Site URL

```text
https://dtekpro.netlify.app
```

### Additional Redirect URLs

```text
https://dtekpro.netlify.app/cliente.html
http://127.0.0.1:5500/cliente.html
http://localhost:5500/cliente.html
```

Opcional para previews de Netlify:

```text
https://**--dtekpro.netlify.app/**
```

## 3. Pantalla de consentimiento de Google

Configurar el nombre **D-TEK GT** y, si la aplicación sigue en modo Testing, agregar como usuarios de prueba las cuentas de Google que se usarán para probar.

Los alcances básicos son:

```text
openid
userinfo.email
userinfo.profile
```

## 4. Probar en Live Server

Abrir:

```text
http://127.0.0.1:5500/cliente.html
```

Presionar **Continuar con Google**. Debe abrir el selector de cuentas de Google y regresar a `cliente.html` con la sesión iniciada.

## 5. Si todavía falla

- **Provider is not enabled:** Google no quedó activado en Supabase.
- **redirect_uri_mismatch:** el callback de Supabase no coincide exactamente en Google Cloud.
- **URL not allowed:** falta la URL local o la de Netlify en Supabase URL Configuration.
- **Access blocked / app in testing:** la cuenta no está agregada como usuario de prueba en Google.

No hace falta ejecutar ningún SQL nuevo para Google Login.
