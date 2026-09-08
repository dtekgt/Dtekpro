# Historial de versiones — D-TEK GT

Antes esto eran 34 archivos sueltos en la raíz del repositorio, uno por
versión, desde la v13 hasta la v39. Se juntaron acá tal cual estaban: no se
resumió ni se reescribió nada, solo dejaron de estar dispersos.

Las versiones de la v40 en adelante viven en el historial de git, que ya lleva
mensajes descriptivos.

---


## v39 · `README-V39-NAVEGACION-FLOTANTE-LATERALES.md`

# D-TEK v39 — Navegación flotante y laterales retráctiles

## Objetivo

Evitar que las herramientas del Garage y los próximos mantenimientos queden
sepultados al final de la pantalla, conservando el contenido central limpio.

## Cambios

- Barra inferior móvil convertida en una cápsula flotante con cinco destinos y
  texto siempre visible.
- Encabezado flotante y compacto al desplazarse en móvil y escritorio.
- Panel izquierdo retráctil para:
  - cambiar de carro;
  - agregar otro carro;
  - actualizar kilometraje;
  - abrir puntos, citas y cuenta.
- Panel derecho retráctil para:
  - próximos mantenimientos;
  - último trabajo;
  - próxima cita;
  - historial;
  - solicitar servicio.
- Pestañas laterales visibles después de desplazarse, sin tapar la entrada del
  Garage.
- Cierre mediante botón, fondo, tecla Escape y gesto horizontal.
- Línea de fecha y kilometraje persistente debajo del encabezado.
- Resumen corto dentro del contenido para descubrir el panel derecho sin bajar
  hasta el listado completo.
- Escritorio mantiene tres columnas: carros, contenido y próximos
  mantenimientos.
- Paleta oscura D-TEK y recursos con versión `39000001`.

## Datos

No requiere migración SQL. Conserva las 21 migraciones y los contratos
existentes de Supabase.

---


## v38 · `README-V38-EXPERIENCIA-CLARA.md`

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

---


## v37.2 · `README-V37-2-CONTRASTE-MOVIL.md`

# D-TEK v37.2 — Contraste móvil integral

Esta versión corrige la legibilidad en teléfonos del portal de cliente y de los
dos flujos de solicitud de servicio.

## Correcciones

- Fondos sólidos oscuros en el modal interno de `cliente.html`.
- Contraste explícito para categorías y servicios generados por JavaScript.
- Fechas, horarios y estados seleccionados legibles.
- Campos, placeholders, opciones, estados deshabilitados y foco corregidos.
- Mensajes de error y éxito con contraste suficiente.
- Botones primarios y secundarios distinguibles.
- Agenda pública protegida contra reglas heredadas claras.
- Tarjetas de puntos, citas, recompensas, perfil e historial corregidas en móvil.
- Nuevos identificadores de CSS para evitar caché de la versión anterior.

No requiere una migración nueva de Supabase.

---


## v37.1 · `README-V37-1-MOVIL-OSCURO.md`

# D-TEK v37.1 — Corrección visual móvil

- Elimina superficies blancas o transparentes heredadas del portal anterior.
- Mantiene en móvil la paleta grafito, carbón y rojo de la versión de escritorio.
- Usa fondos sólidos en encabezado, línea de vida, Garage, En el radar y navegación inferior.
- Corrige tarjetas, formularios, modales, estados vacíos y pantalla de acceso.
- Agrega compatibilidad visual más estable para Safari/iOS.
- Actualiza el identificador de caché de `styles.css`.

No requiere una migración nueva de Supabase.

---


## v37 · `README-V37-GARAGE-PROFESIONAL.md`

# D-TEK v37 · Garage profesional

## Qué cambia

- Conserva la identidad oscura grafito, carbón y rojo D-TEK.
- La navegación de escritorio tiene dos estados:
  - Completa y con texto al entrar.
  - Más delgada al desplazarse, conservando texto e iconos.
- El Garage usa tres áreas en escritorio:
  - Selector rápido de carros a la izquierda.
  - Expediente y mantenimiento al centro.
  - Panel `En el radar` a la derecha.
- El cambio de carro actualiza el expediente sin salir del Garage.
- La línea de vida queda fija dentro del expediente y usa dos escalas paralelas:
  - Fecha.
  - Kilómetros o millas.
- Los servicios terminados se posicionan con su fecha y recorrido registrados.
- El próximo vencimiento se añade como punto ámbar estimado.
- El lateral mantiene visibles cuatro mantenimientos, el último trabajo y la próxima cita.
- En móvil se conserva la navegación inferior, el selector de carros es horizontal y el panel lateral se transforma en un carrusel.

## Datos y compatibilidad

- No agrega tablas ni columnas.
- No requiere una migración nueva.
- Conserva `database/20_estado_vehiculo.sql`.
- Conserva `database/21_planes_preventivos_editables.sql`.
- La preferencia km/millas sigue guardándose localmente.
- El enlace externo al manual continúa eliminado.

## Archivos principales

- `cliente.html`
- `portal-cliente.js`
- `vehicle-health.js`
- `styles.css`

---


## v36 · `README-V36-GARAGE-ADAPTATIVO.md`

# D-TEK v36 — Garage adaptativo

## Qué cambia

- Se elimina el enlace externo al manual del propietario.
- El criterio preventivo se explica dentro del Garage en lenguaje sencillo.
- El catálogo general se amplía y se filtra según motor, combustible, caja y tracción conocidos.
- El plan se ajusta por uso normal o exigente.
- Los intervalos personalizados guardados por administración tienen prioridad.
- Se conservan las barras paralelas: tiempo arriba y recorrido abajo.
- El cliente elige kilómetros o millas sin modificar los datos internos.
- La navegación queda en Inicio, Garage, Agenda y Cuenta.
- Puntos y recompensas siguen disponibles desde Inicio y Cuenta, sin ocupar un destino permanente.
- Los carros aparecen como selector persistente y cambian el perfil con un toque.
- Se corrige la cascada de estilos que podía dejar el tablero blanco o sin contraste.

## Criterios de verdad

- `Sin revisar` nunca se convierte automáticamente en `Vencido`.
- Frenos, llantas, batería, dirección, suspensión y otros componentes físicos necesitan inspección.
- Un elemento no aplicable se omite cuando los datos del vehículo permiten identificarlo.
- El cierre administrativo puede corregir intervalos; esos valores guardados prevalecen sobre el plan base.

## Base de datos

No requiere una migración adicional. Mantiene:

1. `database/20_estado_vehiculo.sql`
2. `database/21_planes_preventivos_editables.sql`

## Despliegue

Reemplazar el contenido del repositorio, hacer commit y push. Los parámetros de versión de CSS y JavaScript ya fueron actualizados para evitar que el navegador conserve la interfaz anterior.

---


## v35.1 · `README-V35-1-DOBLE-EJE.md`

# D-TEK v35.1 — Doble eje de mantenimiento

## Cambio principal

El Pasaporte del Vehículo muestra por separado y en paralelo:

- vida restante por tiempo;
- vida restante por recorrido.

La línea de tiempo aparece arriba y la de kilómetros o millas abajo. El estado
del mantenimiento sigue determinado por la referencia que venza primero.

## Elección del cliente

El cliente puede escoger `km` o `millas` desde el encabezado del tablero. La
preferencia queda recordada en el navegador. Los datos internos continúan
guardándose en kilómetros para mantener compatibilidad con Supabase y con los
registros anteriores.

No requiere una migración nueva. Continúan siendo necesarias las migraciones
20 y 21 de las versiones anteriores.

---


## v34 · `README-V34-PLAN-PREVENTIVO.md`

# D-TEK v34 — Plan preventivo por vehículo

## Qué cambió

- El expediente muestra una lista completa por sistemas y barras de vida restante.
- El plan se resuelve usando marca, línea y año del vehículo.
- Ford Escape 2013–2019 incluye intervalos propios y enlace a la fuente de Ford.
- Los vehículos sin ficha específica reciben un plan base claramente identificado como provisional.
- Al cerrar un trabajo, el administrador puede:
  - marcar un mantenimiento como realizado;
  - registrar el kilometraje;
  - cambiar el intervalo en meses o kilómetros;
  - registrar inspecciones reales de frenos, llantas, batería, suspensión y otros sistemas.
- La barra se reinicia únicamente cuando se marca **Servicio realizado hoy**.
- Los estados de inspección no inventan porcentajes.

## Migración obligatoria

Después de haber ejecutado `database/20_estado_vehiculo.sql`, ejecutar:

`database/21_planes_preventivos_editables.sql`

La migración no borra información. Añade los intervalos editables y actualiza el
kilometraje del vehículo cuando el administrador concluye un servicio.

## Cómo ampliar el catálogo

Los perfiles específicos están en `vehicle-health.js`, dentro de
`planForVehicle()`. Cada perfil debe indicar fuente, enlace y valores por
`component_key`. Si no existe un perfil comprobado, D-TEK usa el plan base y el
administrador puede ajustar el intervalo al revisar el manual correcto.

---


## v33 · `README-V33-ESTADO-VEHICULO.md`

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

---


## v30.3.3 · `README-V30-3-3-RECUPERACION-CONTRASENA.md`

# D-TEK WEB v30.3.3 — Recuperación de contraseña

## Qué corrige

Antes, el correo de recuperación autenticaba temporalmente al usuario pero lo devolvía a la página principal, donde no existía ningún formulario para crear la contraseña nueva.

Esta versión agrega:

- Botón **Olvidé mi contraseña** en el acceso admin.
- Botón equivalente en el Garage del cliente.
- Página `reset-password.html` para establecer la nueva contraseña.
- Redirección automática desde la portada cuando un enlace antiguo de Supabase vuelve con `type=recovery`.
- Cierre de la sesión temporal después de cambiar la contraseña.

## Configuración necesaria en Supabase

En **Authentication → URL Configuration**:

- Site URL: `https://dtekpro.vercel.app`
- Redirect URLs: agregar `https://dtekpro.vercel.app/reset-password.html`

También puede agregarse `https://dtekpro.vercel.app/reset-password` por compatibilidad con rutas limpias de Vercel.

## Uso

1. Publicar esta versión.
2. Abrir `https://dtekpro.vercel.app/admin-backend.html`.
3. Escribir el usuario o correo admin.
4. Presionar **Olvidé mi contraseña**.
5. Abrir el correo y crear la contraseña nueva.

---


## v30.3.2 · `README-V30-3-2-AGENDA-SERVICIOS.md`

# D-TEK WEB v30.3.3 — Corrección de solicitudes

## Problema encontrado

El selector mostraba **Otros / no aparece en la lista**, pero ese servicio no existía en la tabla `public.services` de Supabase. La función de agenda rechazaba la solicitud como “Servicio inválido o inactivo” y el frontend escondía el motivo bajo un mensaje genérico.

Además, el catálogo visual tenía 21 servicios y las migraciones anteriores no garantizaban que los 21 estuvieran activos en Supabase.

## Correcciones

- Sincronización completa de los 21 servicios del frontend con Supabase.
- `otros-servicios` queda como servicio real y visible en administración.
- El frontend respeta `backendServiceId` cuando algún servicio use alias en el futuro.
- Las cuentas que entran solo con usuario pueden solicitar servicio sin agregar correo.
- Se evita guardar el correo sintético `@login.dtekgt.com` como contacto del cliente.
- El botón se bloquea mientras guarda para evitar solicitudes duplicadas.
- Los errores de horario, sesión, vehículo y servicio ahora muestran una causa útil.
- Caché del sitio elevada a `v=30.3.3`.

## Activación

1. En Supabase, abrir **SQL Editor**.
2. Ejecutar `database/16_v30_3_2_booking_catalog_fix.sql`.
3. Confirmar que el resultado final sea `active_catalog_services = 21`.
4. Subir esta carpeta completa a Vercel.
5. Abrir el sitio en una ventana privada o recargar con `Ctrl + F5`.

---


## v30.3.1 · `README-V30-3-1-ADMIN-USUARIO.md`

# D-TEK WEB v30.3.1 — Admin por usuario o correo

Corrección aplicada sobre v30.3.0:

- El acceso de `admin-backend.html` acepta texto, no solo correos.
- El administrador puede iniciar sesión con **usuario o correo**.
- La resolución de usuario funciona también para cuentas existentes con correo real.
- Se conserva la validación del rol `admin` después del inicio de sesión.

## Actualización de Supabase existente

Ejecutar en Supabase SQL Editor:

`database/15_v30_3_1_admin_username.sql`

Después, confirmar que la cuenta admin tenga un usuario asignado:

```sql
update public.profiles
set username = 'dominic', role = 'admin'
where lower(email) = lower('TU_CORREO_ADMIN');
```

El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto o guion bajo.

---


## v30.3 · `README-V30-3-ACCESO-USUARIO.md`

# D-TEK v30.3 — Acceso por usuario o correo

## Qué cambia

- El cliente entra con **usuario o correo + contraseña**.
- El correo pasa a ser **opcional** en cuentas locales D-TEK.
- Google continúa disponible, pero como alternativa opcional.
- Si un correo/usuario no existe, el portal ofrece crear la cuenta.
- Desde Perfil, el cliente puede cambiar su **usuario**, agregar/quitar correo y cambiar su contraseña.
- Las cuentas entregadas por D-TEK muestran aviso de contraseña temporal hasta que el cliente la cambie.
- El panel `admin-backend.html` ahora puede crear el acceso, carro y último servicio en una sola operación.

## Instalación obligatoria

1. En Supabase SQL Editor, ejecutar:
   `database/14_v30_3_local_access.sql`
2. En Supabase: Authentication → Providers → Email, desactivar **Confirm email** mientras se use acceso local sin correo.
3. Publicar todos los archivos del paquete en Netlify.

## Decisión de arquitectura

Supabase Auth sigue manejando contraseñas. Nunca se guardan contraseñas en `profiles` ni en JavaScript. Para una cuenta sin correo se usa un correo interno sintético (`usuario@login.dtekgt.com`) únicamente como identificador técnico; el cliente nunca necesita verlo. El correo real, cuando existe, se guarda aparte como `contact_email`.

## Entrega de credenciales

En `admin-backend.html`, el bloque **Crear acceso de cliente** permite generar usuario y contraseña temporal. El cliente puede conservarlos o cambiarlos desde Perfil → Usuario y contraseña.

## Nota

La creación desde el panel admin utiliza un cliente Supabase aislado con `persistSession: false`, por lo que no cierra ni reemplaza la sesión administrativa.

---


## v30 · `README-V30-F1-SYSTEM.md`

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

---


## v29 · `README-V29-F1-HERO.md`

# D-TEK GT V29 — Hero F1 / Carbon

## Cambios
- Sustitución del SVG conceptual del carro por una composición visual F1 de fibra de carbono y líneas rojas.
- Imagen optimizada para escritorio: `assets/hero-dtek-f1.webp`.
- Recorte dedicado para móvil: `assets/hero-dtek-f1-mobile.webp`.
- Gradientes de lectura para mantener el texto limpio sobre la imagen.
- Líneas de velocidad, barrido rojo y microdetalles técnicos mediante CSS.
- Panel de rutas con superficie oscura translúcida para separar acciones del fondo.
- Precarga responsive de la imagen principal.

## Preparado para la animación de Higgsfield
Cuando exista el video final, conservar estas imágenes como `poster` y sustituir el `<picture class="cinema-media">` de `index.html` por un `<video>` dentro del mismo contenedor. De esta forma no será necesario reconstruir el layout.

## Preservado
- Navegación y enlaces existentes.
- Agenda, Garage, Supabase y lógica JavaScript.
- Selector de servicios y navegación móvil.

---


## v28 · `README-V28-CINEMA-HOME.md`

# D-TEK GT v28 · Cinema Home

## Alcance
- Rediseño completo del primer viewport de `index.html`.
- Navegación flotante en cápsulas.
- Composición editorial automotriz con SVG propio, sin dependencias de video.
- Acciones principales y caminos rápidos más claros.
- Responsive móvil con carrusel horizontal y navegación inferior preservada.
- Animaciones CSS con soporte para `prefers-reduced-motion`.

## Archivos modificados
- `index.html`
- `styles.css`

## Preservado
- Stack HTML/CSS/JavaScript vanilla.
- Navegación y enlaces existentes.
- Agenda, Garage, Supabase, Google OAuth y lógica de servicios.
- Navegación móvil existente.

## Próxima fase recomendada
Aplicar el mismo sistema visual a Agenda y luego al Garage, validando cada flujo por separado.

---


## v27.4.1 · `DTEK_v27_4_1_QA_REPORT.md`

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

---


## v27.4.1 · `README-V27-4-1-SELECTOR-COMPACTO.md`

# D-TEK Web v27.4.1 Preview

## Cambio
El paso 2 de Agenda deja de desplegar todo el catálogo y todos los adicionales dentro de la página.

- Categorías compactas en dos columnas.
- Servicios dentro de una hoja/modal con scroll propio.
- Síntomas comunes compactos y lista completa dentro de la hoja.
- Cotización resumida; el detalle se abre solo cuando el cliente lo pide.
- Servicios adicionales dentro de la misma hoja.
- Botón de continuar fijo en móvil.
- Se conserva selección múltiple, “Otros”, cálculo de tiempo y cotización inicial.

No se modificaron Supabase, horarios, autenticación ni almacenamiento de citas.

---


## v27.4 · `README-V27-4-0-COTIZADOR-SERVICIOS.md`

# D-TEK WEB v27.4.0 PREVIEW

## Constructor de servicios y cotización inicial

Esta versión transforma el paso de Servicios de Agenda en un constructor de solicitud múltiple.

### Cambios principales

- El cliente puede agregar y quitar varios servicios dentro de una misma cita.
- Se agregó la categoría **Otros** con la opción **Otros / no aparece en la lista**.
- Al elegir Otros, el cliente debe describir brevemente el trabajo o problema antes de continuar.
- Los servicios adicionales existentes ahora aparecen de forma visible dentro de Agenda y en la página Servicios.
- La cotización inicial se actualiza mientras el cliente agrega o quita elementos.
- Los trabajos con precio conocido se suman; los variables se muestran como **por cotizar** para no prometer un total falso.
- La duración usada para ofrecer horarios suma los tiempos estimados de los servicios y adicionales seleccionados.
- El primer servicio seleccionado se conserva como servicio principal para mantener compatibilidad con el backend actual.
- Los demás servicios, adicionales y la descripción de Otros se guardan dentro de la solicitud y el mensaje de WhatsApp.

### Compatibilidad

- No requiere una migración SQL.
- No cambia las funciones RPC existentes.
- No cambia autenticación, puntos, referidos ni reglas de disponibilidad.
- Todos los recursos usan caché `v=27.4.0`.

### QA local

Probado a 320 px y 375 px:

- selección de tres servicios y un adicional;
- cotización `Desde Q550 + por cotizar`;
- descripción obligatoria de Otros;
- avance a fecha y horario;
- cálculo de horarios usando la duración combinada;
- nueve servicios adicionales visibles;
- cero desbordamiento horizontal;
- cero errores de consola;
- los nueve archivos JavaScript pasan revisión de sintaxis;
- cero referencias locales faltantes.

---


## v27.3.3 · `README-V27-3-3-AUTOCOMPLETAR-CLIENTE.md`

# D-TEK Web v27.3.3 — Datos del cliente sin repetición

Corrección de prioridad alta en el paso 4 de Agenda.

## Comportamiento nuevo

- Si hay una sesión activa, Agenda carga automáticamente nombre, teléfono, correo, dirección y zona/municipio.
- La prioridad de datos es: perfil guardado → metadatos de acceso Google/correo → preferencias locales → última cita del cliente.
- Los campos completos se compactan y ya no obligan al cliente a volver a llenarlos.
- Solo quedan visibles los datos que realmente falten.
- El cliente puede pulsar “Cambiar datos” para corregirlos.
- Después de guardar una cita, los datos utilizados se guardan en el perfil para la próxima reserva.

## Alcance

No se cambió la lógica de servicios, fechas, horarios, disponibilidad ni puntos.

---


## v27.3.2 · `README-V27-3-2-PREVIEW.md`

# D-TEK WEB v27.3.2 PREVIEW

## QA-002 — Agenda móvil: fecha y hora

Corrección limitada al paso 3 de Agenda después de seleccionar el servicio.

- En pantallas de hasta 680 px, fechas y horarios dejan de mostrarse como carruseles horizontales con tarjetas parcialmente visibles.
- Ambos bloques usan una cuadrícula de tres columnas dentro del ancho disponible.
- Los botones pueden reducirse correctamente gracias a `min-width: 0` y `minmax(0, 1fr)`.
- No se modificó JavaScript, Supabase, cálculo de disponibilidad, horarios, envío de citas ni otros flujos.

Base: DTEK-WEB-v27.3.1-PREVIEW.

---


## v27.3.1 · `README-V27-3-1-PREVIEW.md`

# D-TEK Web v27.3.1 PREVIEW

Esta copia parte de `DTEK-WEB-v27-3-HORARIO-MOVIL-NETLIFY(1).zip`.

## Cambio incluido

- `QA-001`: corrige el recorte horizontal de `referir.html` a 320 px.
- Se agregó un breakpoint en `styles.css` para que `.referral-grid-v24` y sus hijos puedan reducirse al ancho disponible.
- `referir.html` usa `styles.css?v=27.3.1` para evitar caché de la hoja anterior.

No se modificó lógica JavaScript, Supabase, migraciones SQL ni otras pantallas.

---


## v27.3 · `README-V27-3-HORARIO-MOVIL.md`

# D-TEK v27.3 — Horario móvil estable

- Fechas y horas ahora se muestran como carruseles horizontales independientes.
- Ningún botón puede ensanchar la página.
- La agenda se apila también en webviews con viewport lógico ancho, como Instagram y Facebook.
- El resumen se compacta en teléfono y oculta el logo grande.
- No requiere cambios SQL.

---


## v27.2 · `README-V27-2-FLUJO-VISUAL.md`

# D-TEK Web v27.2 — Flujo visual de agenda

## Corrección principal

Al elegir un servicio, la agenda avanza automáticamente al paso **Horario**.

Antes:
- el servicio se guardaba;
- la pantalla subía al panel de resumen;
- el usuario seguía viendo el paso de servicio.

Ahora:
- se guarda el servicio;
- Servicio queda marcado como completado;
- Horario queda activo;
- la vista se posiciona en el selector de día y hora.

## Progreso visual

En la barra superior y en el panel `Tu solicitud`:

- **Verde e iluminado:** dato ya elegido.
- **Rojo:** paso actual.
- **Gris:** dato pendiente.

El panel muestra cuatro estados:

1. Carro
2. Servicio
3. Horario
4. Confirmar

Los datos incompletos aparecen como `Falta elegir` o `Falta completar`.

## Garage D-TEK

La agenda interna del Garage también avanza automáticamente de **Servicio** a **Horario** al tocar una opción y utiliza el mismo lenguaje visual para completado, activo y pendiente.

## Instalación

Subir el ZIP completo a Netlify.

No requiere SQL nuevo. Conserva la base de datos y la configuración de Google/Supabase de la v27.1.

---


## v27.1 · `README-V27-1-TIMELINE-FLOTANTE.md`

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

---


## v27 · `README-V27-PUNTOS-INTUITIVO.md`

# D-TEK Web v27 — Intuitiva + D-TEK Puntos

## Cambio visual

- Inicio reducido a tres decisiones: síntoma, servicio o compra segura.
- Servicios en categorías desplegables.
- Sin párrafos explicativos dentro del catálogo.
- Cada servicio muestra precio, tiempo y puntos estimados.
- Agenda con cuatro decisiones: carro, servicio, horario y confirmar.
- Perfil estilo cuenta: avatar, nombre, actividad y edición oculta.
- Garage conserva agenda interna, carros, citas, historial y línea de mantenimiento.

## D-TEK Puntos

Reglas iniciales:

- 1 punto por cada Q10 del total final del servicio.
- Mínimo 10 puntos por servicio completado.
- 100 puntos por referido convertido.

Canjes iniciales:

| Canje | Puntos |
|---|---:|
| Batería y sistema de carga | 30 |
| Revisión de frenos | 40 |
| Revisión de suspensión | 40 |
| Revisión de A/C | 50 |
| Escaneo gratis | 60 |
| Q100 de crédito | 100 |

## SQL obligatorio

En Supabase SQL Editor, después del SQL 12, ejecutar:

```text
database/13_v27_points_rewards.sql
```

Este SQL crea:

- ledger de puntos;
- catálogo de premios;
- solicitudes de canje;
- puntos automáticos por servicios completados;
- puntos automáticos por referidos convertidos;
- funciones para cliente y administración;
- reconocimiento de servicios y referidos anteriores que ya estén completados.

## Flujo de servicio

- Si la cita se marca como realizada sin reporte: acredita 10 puntos.
- Al guardar el reporte técnico completado con total: recalcula a 1 punto por cada Q10.
- No duplica puntos por la misma cita.

## Flujo de canje

1. El cliente entra a Garage → Puntos.
2. Toca Canjear.
3. Los puntos se reservan inmediatamente.
4. El canje aparece en `admin-backend.html`.
5. Admin marca Entregado o Cancelado.
6. Si se cancela, los puntos regresan automáticamente.

## Publicación

El ZIP final debe tener `index.html` directamente en la raíz. No requiere cambios en Google OAuth ni en `supabase-config.js`.

---


## v26 · `README-V26-GARAGE-DTEK.md`

# D-TEK Web v26 — Garage D-TEK

## Cambios

- “Mi D-TEK” pasa a llamarse **Garage D-TEK** en toda la experiencia pública y privada.
- Cuenta inspirada en patrones familiares de redes sociales: avatar, nombre, menú de cuenta y perfil personal.
- Perfil nuevo con portada, estadísticas, actividad reciente, información de la cuenta y edición desplegable.
- El correo no aparece debajo del logo.
- Google OAuth usa una URL de retorno compatible con carpetas, Live Server y Netlify.
- Errores de Google más claros y lectura de errores devueltos por OAuth.
- No requiere SQL nuevo.

Consultar `README-GOOGLE-LOGIN.md` para activar el proveedor Google.

---


## v25 · `README-V25-SELECTOR-PRO.md`

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

---


## v24 · `README-V24-UNIFICADO.md`

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

---


## v23.3 · `README-DESPLIEGUE-V23-3.txt`

D-TEK v23.3.1 — PAQUETE NETLIFY LISTO

Este ZIP tiene index.html en la raíz.
Subir este ZIP completo al sitio correcto en Netlify.
Después abrir cliente.html en incógnito o hacer Ctrl+F5.
La versión lleva cache-busting en cliente.html y encabezados no-cache.
No requiere SQL nuevo.

---


## v23.2 · `README-V23-2-MOVIL-COMPACTO.md`

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

---


## v23 · `README-MONSTRUO.md`

# D-TEK WEB OS v23 — La Pecera + Nuevo Mi D-TEK

> Para el rediseño completo del portal cliente, leer `README-V23-PORTAL-CLIENTE.md`.

Esta versión convierte la web en un sistema de **retención, segundo vehículo y referidos**, no solo en una página para agendar.

## La regla comercial

> Cada persona recomendada que complete su primer trabajo con D-TEK genera **Q100 de Saldo D-TEK** para quien la recomendó.

El saldo:

- se usa en servicios futuros de D-TEK;
- no se entrega en efectivo;
- se acredita solo cuando el referido se convierte en trabajo;
- puede descontarse desde el panel admin cuando el cliente lo canjea.

## Qué cambia

### 1. El cliente recurrente ya no empieza de cero

En `agenda.html` aparece una entrada clara para usar **Mi D-TEK** y escoger un carro guardado, en vez de volver a escribir todos sus datos.

### 2. El garage busca el segundo y tercer vehículo

En `cliente.html` el llamado principal ahora es **Agregar otro carro**. El formulario explica que puede registrar los demás vehículos de la casa y agendarlos después sin repetir información.

### 3. Nuevo apartado Beneficios

Dentro de Mi D-TEK el cliente puede:

- ver su Saldo D-TEK;
- ver cuántos referidos están pendientes o convertidos;
- registrar una recomendación;
- compartir D-TEK por WhatsApp;
- revisar el estado de sus recomendaciones.

### 4. Página pública para recomendar

`referir.html` permite recomendar aunque la persona todavía no sea cliente ni tenga cuenta.

Solicita únicamente:

- nombre y WhatsApp de quien recomienda;
- nombre y WhatsApp del recomendado;
- carro;
- necesidad opcional.

Si después crea una cuenta con el mismo WhatsApp, el sistema puede reclamar esos referidos y vincular el saldo.

### 5. Control administrativo

En `admin-backend.html` existe un bloque de **Referidos y saldo** para:

- ver recomendaciones nuevas;
- abrir WhatsApp del recomendado o del referente;
- marcar Contactado;
- marcar Con cita;
- Convertir + Q100;
- descartar;
- hacer ajustes de saldo positivos o negativos.

## SQL nuevo obligatorio

En Supabase:

```text
Database → SQL Editor → New Query
Pegar database/12_v22_loyalty_referrals.sql
Run
```

Debe ejecutarse después del SQL 11.

El SQL 12 crea:

- `referrals`;
- `loyalty_ledger`;
- funciones públicas, de cliente y de admin;
- reglas RLS;
- acreditación automática al convertir un referido;
- reclamación de referidos públicos por número de teléfono.

## Archivos nuevos

- `referir.html`
- `referidos.js`
- `database/12_v22_loyalty_referrals.sql`

## Archivos actualizados

- `index.html`
- `agenda.html`
- `cliente.html`
- `admin-backend.html`
- `portal-cliente.js`
- `backend-admin.js`
- `supabase-client.js`
- `styles.css`

## Prueba completa

1. Ejecutar SQL 12.
2. Abrir `referir.html` y registrar una recomendación pública.
3. Entrar como admin y abrir **Referidos y saldo**.
4. Marcar el referido como Contactado y luego Con cita.
5. Marcarlo como Convertido + Q100.
6. Entrar en Mi D-TEK con el referente.
7. Confirmar que el saldo muestra Q100.
8. Desde admin usar **Ajustar saldo** con `-100` cuando se canjee.
9. Confirmar que el saldo del cliente vuelva a Q0.

## Nota operativa

Antes de publicar el enlace de referidos de forma masiva, conviene agregar protección anti-spam tipo Cloudflare Turnstile. La versión actual incluye un honeypot básico, suficiente para pruebas y lanzamiento controlado, pero no sustituye una protección de producción.

---


## v23 · `README-V23-PORTAL-CLIENTE.md`

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

---


## v13 · `README-FORM-FIX.txt`

DTEK Web OS v13 — Form to Supabase Fix

Esta versión hace diagnóstico estricto del formulario de agenda:
- Solo abre WhatsApp si Supabase devuelve ID de cita.
- Imprime en consola DTEK_FORM_RPC_PAYLOAD, DTEK_FORM_RPC_RESPONSE y DTEK_FORM_SAVE_RESULT.
- Si no se guarda, muestra error debajo del botón rojo.

Configurar supabase-config.js otra vez antes de probar.

---
