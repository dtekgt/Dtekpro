# D-TEK v38 — Experiencia clara

Esta versión afina el portal del cliente sobre la v37.2 sin cambiar la base de datos.

## Qué cambia

- Lenguaje directo y cotidiano en Inicio, Garage, Agenda, Cuenta y Solicitar servicio.
- Panel lateral móvil para cambiar o agregar carros, actualizar kilometraje, ver puntos y abrir preferencias.
- Cambio de carro con un toque, conservando el vehículo activo en toda la experiencia.
- Garage móvil reorganizado para mostrar primero:
  1. carro activo;
  2. próximo servicio;
  3. barras de tiempo y kilometraje;
  4. próximos mantenimientos;
  5. historial resumido.
- Historial del carro con los dos rieles existentes: fecha y km/millas.
- Estados administrativos traducidos a mensajes que el cliente entiende.
- Solicitud de servicio simplificada, con una opción visible para quien no sabe qué necesita.
- Datos conocidos del cliente y del carro se reutilizan; no se vuelven a pedir.
- Paleta oscura D-TEK reforzada y contraste AA en textos y controles principales.

## Vocabulario principal

- `Garage`: estado y mantenimiento de un carro.
- `Historial del carro`: trabajos y revisiones realizados.
- `Próximos mantenimientos`: servicios que se acercan.
- `Qué necesita tu carro`: estado actual por sistema.
- `Solicitar servicio`: única frase para iniciar una cita o revisión.
- `Actualizar kilometraje`: registrar la lectura actual del tablero.

## Compatibilidad

- No agrega migraciones SQL.
- Conserva las integraciones actuales con Supabase.
- Conserva el identificador del vehículo al solicitar servicio.
- Mantiene el contrato de `otros-servicios`.

## Despliegue

Reemplazá los archivos del proyecto, hacé commit y desplegá. Los recursos modificados usan el identificador `38000001` para evitar que el navegador móvil reutilice CSS o JavaScript anterior.

