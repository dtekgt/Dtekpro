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
