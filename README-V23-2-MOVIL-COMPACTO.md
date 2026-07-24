# D-TEK Web v23.2 — Mi D-TEK móvil compacto

## Objetivo
Reducir el desplazamiento vertical del Resumen móvil y permitir cambiar de vehículo sin bajar hasta el final de la página.

## Cambios
- Selector horizontal de vehículos al inicio del Resumen.
- Cada vehículo muestra alias, marca/línea y año.
- Botón `+ Agregar` junto al selector.
- Vehículo activo y próxima acción se integran en un solo módulo compacto.
- Beneficios y “otros carros” dejan de duplicarse en el Resumen móvil; siguen accesibles desde la navegación inferior.
- La pantalla Resumen con datos normales cabe dentro de un viewport móvil de 390 × 844 px.
- En `Mis vehículos`, la lista de carros se convierte en un carrusel horizontal fijo arriba del expediente.
- Eliminado el encabezado duplicado en móvil.
- Sin scroll horizontal entre 320 y 1024 px.
- Escritorio conserva la distribución de v23.

## Archivos modificados
- `portal-cliente.js`
- `styles.css`

No requiere migraciones de Supabase.
