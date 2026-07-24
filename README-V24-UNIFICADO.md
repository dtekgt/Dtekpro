# D-TEK Web v24 — Sistema visual unificado

Esta versión toma como base la v23.3.2 de Mi D-TEK y extiende el mismo lenguaje visual claro, humano y automotriz a las páginas públicas.

## Páginas rediseñadas

- `index.html`
- `servicios.html`
- `servicio.html`
- `agenda.html`
- `compra-segura.html`
- `faq.html`
- `referir.html`

## Portal cliente

`cliente.html` conserva el diseño compacto aprobado, incluyendo:

- selector rápido de vehículos;
- línea de tiempo de mantenimiento;
- correo removido debajo del logo;
- navegación móvil compacta.

## Cambios principales

- Sistema claro con fondo gris industrial, tarjetas blancas y rojo D-TEK como CTA principal.
- Navegación pública simplificada y barra inferior móvil consistente.
- Inicio reorganizado por necesidad del cliente, no por términos técnicos.
- Servicios con acceso por síntomas y catálogo filtrable.
- Categoría inicial `Recomendados` para evitar mostrar todo el catálogo de golpe.
- Detalle de servicio con alcance, precio, duración y requisitos claros.
- Agenda progresiva: el formulario aparece después de elegir un servicio.
- Extras opcionales colapsados detrás de un botón.
- Compra Segura, FAQ y referidos alineados visualmente con el resto del sitio.

## Base de datos

No requiere SQL nuevo. Conserva la misma configuración de Supabase de la versión anterior.

## Probar en Live Server

1. Abrir esta carpeta completa en VS Code.
2. Clic derecho en `index.html`.
3. Elegir **Open with Live Server**.
4. Probar también:
   - `/servicios.html`
   - `/agenda.html`
   - `/cliente.html`
   - `/compra-segura.html`
   - `/faq.html`
   - `/referir.html`

## Validaciones realizadas

- JavaScript sin errores de sintaxis.
- CSS analizado sin errores de parseo.
- Sin IDs HTML duplicados.
- Sin enlaces locales a archivos inexistentes.
- Formularios e IDs dinámicos conservados.
- Pruebas de render en móvil y escritorio para páginas públicas.

## Alcance pendiente

Los paneles `admin.html` y `admin-backend.html` no fueron rediseñados en esta versión. Se conservaron para no mezclar la experiencia pública con la operación interna.
