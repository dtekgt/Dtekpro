# D-TEK Web v25 — Selector Pro

Esta versión reorganiza la web alrededor de una sola secuencia:

1. Escoger vehículo.
2. Escoger servicio o síntoma.
3. Escoger horario.
4. Confirmar.

## Cambios principales

### Inicio
- Portada reducida a una propuesta clara y tres rutas de entrada.
- Menos secciones, menos tarjetas y menos texto repetido.
- Vista compacta de categorías de servicio mediante acordeones.

### Servicios
- Catálogo organizado por categorías desplegables.
- Cada servicio se abre para mostrar descripción, precio y duración.
- Búsqueda rápida.
- Alternancia entre “Por servicio” y “Por síntoma”.

### Agenda pública
- Flujo progresivo de cuatro pasos.
- Selección escalonada de vehículo: marca → línea → año → motor.
- Lista de servicios agrupada y desplegable.
- Solo se muestra una decisión principal por pantalla.

### Mi D-TEK
- Los vehículos guardados ya no regresan al selector público.
- “Solicitar servicio” abre un agendamiento interno con el vehículo preseleccionado.
- Flujo interno: servicio → horario → confirmación.
- Se conservan Supabase, historial, beneficios, vehículos y preselección.

### Registro de vehículos
- El formulario usa selección escalonada: marca → línea → año → motor.
- Se conservan campos manuales para vehículos no incluidos en el catálogo.

## Archivos nuevos
- `selector-pro.js`: acordeones, catálogo y agenda pública progresiva.
- `client-booking.js`: agendamiento interno desde Mi D-TEK.

## Base de datos
No hay migraciones SQL nuevas. Esta versión reutiliza las funciones existentes de Supabase, especialmente el alta de citas vinculadas a vehículos guardados.

## Probar en Live Server
1. Descomprimir el ZIP.
2. Abrir la carpeta completa en Visual Studio Code.
3. Ejecutar `index.html` con **Open with Live Server**.
4. Revisar `cliente.html` con una sesión real para probar el agendamiento interno.

## Publicar en Netlify
El ZIP de entrega tiene `index.html` en la raíz. Puede arrastrarse directamente a la sección **Deploys** del sitio.
