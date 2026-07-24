# D-TEK WEB OS v23 — La Pecera + Nuevo Mi D-TEK

> Para el rediseño completo del portal cliente, leer `README-V23-PORTAL-CLIENTE.md`.

Esta versión convierte la web en un sistema de **retención, segundo vehículo y referidos**, no solo en una página para agendar.

## La regla comercial

> Cada persona recomendada que complete su primer trabajo con D-TEK genera **Q100 de Saldo D-TEK** para quien la recomendó.

El saldo:

- se usa en servicios futuros de D-TEK;
- no se entrega en efectivo;
- se acredita solo cuando el referido se convierte en trabajo;
- puede descontarse desde el panel admin cuando el cliente lo canjea.

## Qué cambia

### 1. El cliente recurrente ya no empieza de cero

En `agenda.html` aparece una entrada clara para usar **Mi D-TEK** y escoger un carro guardado, en vez de volver a escribir todos sus datos.

### 2. El garage busca el segundo y tercer vehículo

En `cliente.html` el llamado principal ahora es **Agregar otro carro**. El formulario explica que puede registrar los demás vehículos de la casa y agendarlos después sin repetir información.

### 3. Nuevo apartado Beneficios

Dentro de Mi D-TEK el cliente puede:

- ver su Saldo D-TEK;
- ver cuántos referidos están pendientes o convertidos;
- registrar una recomendación;
- compartir D-TEK por WhatsApp;
- revisar el estado de sus recomendaciones.

### 4. Página pública para recomendar

`referir.html` permite recomendar aunque la persona todavía no sea cliente ni tenga cuenta.

Solicita únicamente:

- nombre y WhatsApp de quien recomienda;
- nombre y WhatsApp del recomendado;
- carro;
- necesidad opcional.

Si después crea una cuenta con el mismo WhatsApp, el sistema puede reclamar esos referidos y vincular el saldo.

### 5. Control administrativo

En `admin-backend.html` existe un bloque de **Referidos y saldo** para:

- ver recomendaciones nuevas;
- abrir WhatsApp del recomendado o del referente;
- marcar Contactado;
- marcar Con cita;
- Convertir + Q100;
- descartar;
- hacer ajustes de saldo positivos o negativos.

## SQL nuevo obligatorio

En Supabase:

```text
Database → SQL Editor → New Query
Pegar database/12_v22_loyalty_referrals.sql
Run
```

Debe ejecutarse después del SQL 11.

El SQL 12 crea:

- `referrals`;
- `loyalty_ledger`;
- funciones públicas, de cliente y de admin;
- reglas RLS;
- acreditación automática al convertir un referido;
- reclamación de referidos públicos por número de teléfono.

## Archivos nuevos

- `referir.html`
- `referidos.js`
- `database/12_v22_loyalty_referrals.sql`

## Archivos actualizados

- `index.html`
- `agenda.html`
- `cliente.html`
- `admin-backend.html`
- `portal-cliente.js`
- `backend-admin.js`
- `supabase-client.js`
- `styles.css`

## Prueba completa

1. Ejecutar SQL 12.
2. Abrir `referir.html` y registrar una recomendación pública.
3. Entrar como admin y abrir **Referidos y saldo**.
4. Marcar el referido como Contactado y luego Con cita.
5. Marcarlo como Convertido + Q100.
6. Entrar en Mi D-TEK con el referente.
7. Confirmar que el saldo muestra Q100.
8. Desde admin usar **Ajustar saldo** con `-100` cuando se canjee.
9. Confirmar que el saldo del cliente vuelva a Q0.

## Nota operativa

Antes de publicar el enlace de referidos de forma masiva, conviene agregar protección anti-spam tipo Cloudflare Turnstile. La versión actual incluye un honeypot básico, suficiente para pruebas y lanzamiento controlado, pero no sustituye una protección de producción.
