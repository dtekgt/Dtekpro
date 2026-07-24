# D-TEK WEB v27.3.2 PREVIEW

## QA-002 — Agenda móvil: fecha y hora

Corrección limitada al paso 3 de Agenda después de seleccionar el servicio.

- En pantallas de hasta 680 px, fechas y horarios dejan de mostrarse como carruseles horizontales con tarjetas parcialmente visibles.
- Ambos bloques usan una cuadrícula de tres columnas dentro del ancho disponible.
- Los botones pueden reducirse correctamente gracias a `min-width: 0` y `minmax(0, 1fr)`.
- No se modificó JavaScript, Supabase, cálculo de disponibilidad, horarios, envío de citas ni otros flujos.

Base: DTEK-WEB-v27.3.1-PREVIEW.
