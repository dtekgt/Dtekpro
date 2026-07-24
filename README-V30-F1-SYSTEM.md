# D-TEK GT v30 · F1 System

Esta entrega extiende el lenguaje visual del hero F1 v29 a las áreas públicas y al Garage sin cambiar el stack ni los contratos de datos.

## Áreas rediseñadas

- **Garage / Resumen:** la línea de tiempo ahora es el centro visual del resumen, con rail LED, hitos de último servicio, hoy y próximo mantenimiento, kilometraje y CTA contextual.
- **Mis vehículos:** selector de carros, expediente, estado, ficha técnica e historial con superficies oscuras y jerarquía editorial.
- **Citas:** navegación, estados y tarjetas consistentes con el sistema visual automotriz.
- **Puntos y referidos:** billetera, progreso, canjes y formularios con el mismo lenguaje F1.
- **Perfil:** portada, avatar, estadísticas, actividad y edición integrados al Garage.
- **Agenda:** flujo progresivo, pasos visibles, fecha/hora y CTA móvil persistente.
- **Servicios:** selector por servicio o síntoma, búsqueda, categorías compactas y adicionales.
- **Compra segura, FAQ, referidos y detalle de servicio:** paleta oscura, líneas LED y tarjetas técnicas.

## Lenguaje visual

- Fondos negros y grafito.
- Rojo inspirado en luces traseras, aplicado como señal y no como decoración constante.
- Bordes finos, cápsulas y superficies tipo negro piano.
- Líneas de velocidad y microbrillos controlados.
- Animaciones de entrada y sheen mediante JavaScript vanilla y CSS.
- Soporte para `prefers-reduced-motion`.

## Archivos principales

- `styles-v30.css`: sistema visual completo añadido como capa segura sobre `styles.css`.
- `dtek-v30.js`: animaciones, reveals y acceso del resumen al historial completo.
- `cliente.html`: nuevo command center de timeline y navegación de Perfil.
- `portal-cliente.js`: timeline resumida y detallada con información contextual y CTA.
- `agenda.html`: textos y confirmación más claros.
- `servicios.html`: orientación por servicio o síntoma.

## Preservado

- HTML, CSS y JavaScript vanilla.
- Supabase y políticas existentes.
- Google OAuth.
- IDs y atributos utilizados por la lógica actual.
- Datos de vehículos, citas, puntos, servicios y referidos.
- Hero F1 v29 y sus imágenes optimizadas.

## QA realizado

- Sintaxis validada para todos los archivos JavaScript.
- CSS parseado sin errores.
- Sin IDs duplicados en páginas públicas y del cliente.
- Sin referencias locales faltantes.
- Revisión visual de escritorio y móvil en Home, Servicios, Agenda, Garage y páginas secundarias.

## Nota de integración

La timeline resumida es horizontal en móvil para conservar tamaño y legibilidad. Incluye una indicación visual para deslizar y ver el siguiente hito. Las tarjetas secundarias del resumen vuelven a mostrarse bajo la timeline en móvil.
