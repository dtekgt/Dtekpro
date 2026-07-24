# D-TEK v27.1 · Línea de servicio flotante

Cambio principal en `cliente.html` / Garage D-TEK:

- La línea de mantenimiento deja de vivir únicamente dentro de Resumen.
- Ahora aparece como una barra compacta y sticky debajo de la navegación del Garage.
- Permanece visible en Resumen, Vehículos, Citas, Puntos y Perfil.
- Muestra el carro activo y un resumen corto del último/próximo servicio.
- Al tocar la barra se despliega la línea completa con fechas y kilometraje.
- Incluye acceso rápido a “Cambiar carro”.
- Se oculta automáticamente cuando la cuenta todavía no tiene vehículos.
- En móvil ocupa una franja compacta debajo del encabezado y no tapa la navegación inferior.

No requiere SQL nuevo. Conserva la base de puntos de la v27 y la configuración de Google/Supabase existente.
