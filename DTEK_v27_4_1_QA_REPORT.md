# D-TEK Web v27.4.1 — QA del selector compacto

## Objetivo
Eliminar el scroll infinito introducido por el cotizador múltiple de v27.4.0, conservando selección múltiple, servicios adicionales, “Otros”, cálculo de tiempo y cotización inicial.

## Agenda — Paso 2
- 8 categorías compactas visibles.
- Ningún servicio se despliega en la página principal.
- El botón para avanzar permanece deshabilitado hasta seleccionar un servicio.
- Los servicios se eligen dentro de una hoja modal con scroll propio.
- Después de la primera selección, las categorías desaparecen automáticamente.
- La pantalla queda reducida a servicio elegido, cotización resumida, “Agregar otro”, adicionales y continuar.
- El detalle de la cotización permanece plegado por defecto.
- Los 9 adicionales se abren dentro de la misma hoja modal.
- “Otros” sigue siendo obligatorio de describir antes de avanzar.
- El resumen lateral redundante y el footer de escritorio se ocultan en móvil.

## Página Servicios
- Las 8 categorías inician cerradas.
- Solo puede permanecer una categoría abierta a la vez.
- Los 9 servicios adicionales quedan detrás de “Ver 9”.
- El footer de escritorio se oculta en móvil porque ya existe navegación inferior.

## Pruebas
- JavaScript: 9/9 archivos pasan `node --check`.
- Agenda 320 px: sin desbordamiento horizontal.
- Agenda 375 px: sin desbordamiento horizontal.
- Página Servicios 320 px: sin desbordamiento horizontal.
- Selección múltiple: PASS.
- Adicionales: PASS.
- “Otros” + validación obligatoria: PASS.
- Paso Servicio → Horario: PASS.
- No se modificaron Supabase, autenticación, RLS, horarios ni persistencia de citas.
