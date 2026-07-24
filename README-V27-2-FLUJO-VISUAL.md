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
