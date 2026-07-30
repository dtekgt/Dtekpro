# D-TEK v33 — Estado del Vehículo

## Qué se implementó

- Tablero dentro de cada expediente con todos los elementos revisables.
- Resumen visible: **Atención**, **Próximamente** y **Sin revisar**.
- Barras por tiempo/kilometraje solo para mantenimientos con intervalo.
- Frenos, llantas, batería, suspensión y dirección exigen inspección real.
- Fuente visible de cada dato: D-TEK, servicio automático, estimación o sin revisar.
- Acordeones por sistema para evitar scroll infinito.
- Captura de estados inspeccionados al cerrar una orden de trabajo.
- Actualización automática de componentes vinculados al servicio cerrado.
- Importación retroactiva de servicios completados.
- Enlace `agenda.html?flow=symptoms` abre correctamente el camino por síntomas.
- Cada cambio de paso lleva el foco y el scroll al contenido nuevo.

## Paso obligatorio en Supabase

Ejecutar, una sola vez y después de la migración 19:

`database/20_estado_vehiculo.sql`

La migración no borra datos. Crea el historial de componentes, permisos, funciones,
automatización de cierre y carga retroactiva.

## Regla de confianza

El sistema no muestra un porcentaje general de “salud del carro”. Una barra de
aceite puede estimarse por fecha y kilometraje; una pastilla de freno o una llanta
no se considera buena o mala sin evidencia de inspección.

## Prueba mínima

1. Abrir un vehículo con historial.
2. Verificar que todos los sistemas aparezcan, aunque estén “Sin revisar”.
3. Cerrar un trabajo desde administración.
4. Marcar uno o más resultados en “Estado revisado hoy”.
5. Recargar el expediente del cliente.
6. Confirmar que el resultado, la fuente y la fecha coinciden.
7. Abrir `agenda.html?flow=symptoms`, completar el carro y avanzar.
8. Confirmar que aparece directamente el listado por síntomas y que el paso nuevo queda enfocado.
