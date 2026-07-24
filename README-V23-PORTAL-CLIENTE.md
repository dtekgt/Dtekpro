# D-TEK WEB OS v23 — Nuevo Mi D-TEK

Esta versión rehace por completo la experiencia de `cliente.html` sin cambiar las tablas ni funciones existentes de Supabase.

## Cambio principal

El portal dejó de ser un dashboard administrativo con sidebar y pasó a una experiencia centrada en cuatro tareas:

1. **Resumen**
2. **Mis vehículos**
3. **Citas**
4. **Beneficios**

El perfil se abre desde el avatar y ya no compite dentro del menú principal.

## Qué se corrigió

- Se eliminó la barra lateral de altura fija que ocultaba botones.
- `Garage` y `Carro activo` ahora son una sola sección: **Mis vehículos**.
- `Citas` e `Historial` ahora viven juntos con pestañas separadas.
- Se eliminaron los cinco KPIs que hacían sentir la página como un panel administrativo.
- Una misma cita ya no se repite varias veces en el Resumen.
- Los estados en cero no compiten con tareas reales.
- El CTA **Solicitar servicio** permanece visible en la topbar.
- En móvil hay navegación inferior fija de cuatro secciones.
- El CTA móvil vive en la topbar y no tapa contenido.
- El formulario para agregar carro está dividido en dos pasos.
- El cliente con un solo carro ve su expediente directamente.
- El cliente con varios carros tiene selector y lista compacta.
- Los mensajes de error ya no exponen SQL ni Supabase.
- Los estados de carga usan skeletons y mensajes claros.

## Dirección visual

- Fondo gris industrial claro.
- Tarjetas blancas sólidas.
- Sin glassmorphism.
- Sin degradados neón.
- Rojo D-TEK reservado para la acción principal.
- Verde y ámbar usados únicamente para estados.
- Datos técnicos con apariencia monoespaciada.
- Radios de 10–14 px y sombras suaves.

## Archivos modificados

- `cliente.html`
- `portal-cliente.js`
- `styles.css`

No se modificaron las migraciones ni las funciones de Supabase.

## Compatibilidad preservada

Se mantienen:

- Login con Google y correo.
- Perfil del cliente.
- Registro y actualización de vehículos.
- Historial por vehículo.
- Citas vinculadas al correo.
- Reportes técnicos.
- Referidos y Saldo D-TEK.
- URL de agenda con vehículo preseleccionado:

```text
agenda.html?vehicle_id={id}&from=garage
```

## Pruebas realizadas

- Validación de sintaxis JavaScript.
- Validación de CSS.
- IDs HTML sin duplicados.
- Todos los IDs usados por JavaScript existen.
- Formularios críticos conservados.
- Prueba de interacción con backend simulado.
- Navegación desktop y móvil.
- Modal para agregar vehículo.
- Expediente con uno y varios vehículos.
- Prueba a 320 px sin scroll horizontal.

## Antes de publicar

1. Mantener la configuración actual de `supabase-config.js`.
2. Confirmar que el SQL 12 de referidos ya esté ejecutado.
3. Probar login real.
4. Probar un cliente sin vehículos.
5. Probar un cliente con uno y varios vehículos.
6. Confirmar que al tocar **Solicitar servicio** el carro llegue preseleccionado a `agenda.html`.
7. Publicar el contenido completo de esta carpeta, no solo los tres archivos modificados.
