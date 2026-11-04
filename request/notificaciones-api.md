# Notificaciones y push

Requerimiento: `request/notificaciones-push.md` (copia en la app). Contrato de la app:
[mobile-api.md](mobile-api.md) §P4. Del lado del panel: `ConfigPanel/docs/push-tenant-api.md`.
Código: `src/notificaciones/` (núcleo y API web) y `src/mobile/notificaciones/` (API de la app).
Migración: `02-11-2026-notificaciones-seguimiento-viaje.sql`.

## Cómo funciona

```
Evento de negocio (bus BACKLOGISTIC_EVENTS) o SeguimientoService
        │  NotificacionesService.notificar(userIds, aviso)   ← nunca lanza
        ▼
tabla notificacion (la campana) ── pushEstado = pendiente
        │  PushWorker, cada 15 s, lotes de 100
        │  POST {PUSH_PANEL_URL}/api/tenant/push/send   (X-Client-Key: PUSH_PANEL_KEY)
        ▼
ConfigPanel → Firebase Cloud Messaging → Android / iOS / navegador
```

- **La campana es la fuente de la verdad.** El aviso se guarda siempre; el push es el timbre.
- **Nunca bloquea la operación**: `notificar()` atrapa sus errores y el envío ocurre después,
  en el worker.
- **Los correos que ya existían siguen igual** (p. ej. `SobreanticipoNotificacionListener`);
  `NotificacionesListener` agrega la campana y el push.
- El backend guarda los **tokens** (tabla `dispositivo`); el panel no los guarda.

## Configuración (env)

| Variable | Uso |
|---|---|
| `PUSH_PANEL_URL` | Base del panel, p. ej. `https://api.panel.longistik.com` |
| `PUSH_PANEL_KEY` | Llave `sk_push_…` del cliente (panel → ficha del cliente → Notificaciones push). Sin ella (o mal formada) no hay push: los avisos quedan `no_aplica` y la campana funciona |
| `PUSH_WORKER` | `off` apaga el worker (p. ej. en una segunda instancia del backend) |

## Tablas

**`notificacion`**: `userId`, `tipo`, `titulo` (65), `mensaje` (240), `link` (JSON
`{ tipo, id, seccion? }`), `prioridad`, `creadaEn`, `leidaEn` y el estado del push:
`pushEstado` (`pendiente` | `enviada` | `sin_dispositivos` | `error` | `no_aplica`),
`pushIntentos`, `pushSiguienteIntento`, `pushError`. Se borran a los 90 días.

**`dispositivo`**: `userId`, `token` (único), `plataforma` (`android` | `ios` | `web`),
`appVersion`, `descripcion`, `creadoEn`, `ultimoUso`. Un token que llega con otro usuario pasa al
nuevo. Se borran los tokens sin uso en 60 días, los de usuarios desactivados y los que FCM reporta
como inválidos.

## Envío (PushWorker)

Cada 15 s toma hasta 100 pendientes, les adjunta los tokens del usuario y llama al panel:

| Resultado | Qué pasa |
|---|---|
| Al menos un token recibió el mensaje | `enviada` |
| El usuario no tiene dispositivos | `sin_dispositivos` (sigue en la campana) |
| Pasó su vigencia (`ttl` del tipo) sin enviarse | `error` "vencido sin enviarse" |
| Sin respuesta, `408`, `429` o `5xx` del panel | Reintento a los 30 s, 2 min, 10 min y 1 h; después `error` |
| `400` / `401` del panel (cuerpo inválido, llave revocada) | `error` sin reintento |
| `invalidos` en la respuesta | Esos tokens se borran |

Una vez al día borra los avisos viejos, los tokens abandonados y los de usuarios inactivos.

## Catálogo (`src/notificaciones/avisos.ts`)

| `tipo` | Para quién | Canal Android | Push | Vigencia del push |
|---|---|---|---|---|
| `sobreanticipo.solicitado` | Aprobadores (`canEdit` en `/liquidacion-solicitudes`), salvo quien la pidió | `operacion` | Sí | 24 h |
| `sobreanticipo.decidido` | Quien la pidió | `operacion` | Sí | 72 h |
| `seguimiento.asignado` | El conductor | `seguimiento` | Sí, alta | 12 h |
| `seguimiento.pedido` | El conductor | `seguimiento` | Sí, alta; los de un viaje se reemplazan en el teléfono | 20 min |
| `seguimiento.cumplir` | El conductor (llegó al destino) | `operacion` | Sí | 6 h |
| `seguimiento.auxilio` | `seguimiento.ver` | `alertas` | Sí, alta | 1 h |
| `seguimiento.desvio` | `seguimiento.ver` | `alertas` | Sí, alta | 1 h |
| `seguimiento.sin_respuesta` | `seguimiento.ver` | `alertas` | Sí | 2 h |
| `seguimiento.pausado` | `seguimiento.ver` | `operacion` | Sí | 6 h |
| `seguimiento.llegada` | `seguimiento.ver` | — | Solo campana | — |

Los textos se arman en una función por tipo, para que la app y la web muestren lo mismo. Sin
datos personales en el push (ni documentos ni teléfonos); los valores en pesos van solo al propio
solicitante.

**Pendientes del catálogo** (necesitan que el core emita el evento): `sobreanticipo.pagado`,
`rndc.rechazo`, `manifiesto.asignado` (`chargeOrder.creado`, reservado) y `remesa.entregada`
(`track.entregada`, reservado).

## API web (`/notificaciones`, `AuthGuard('jwt')`)

Mismo contrato que la de la app; los errores llevan su código HTTP real.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/notificaciones?soloNoLeidas=&page=&pageSize=` | Lista paginada |
| `GET` | `/notificaciones/sin-leer` | `{ sinLeer }` para el contador de la campana |
| `POST` | `/notificaciones/{id}/leida` | `204` (`404` si no es del usuario) |
| `POST` | `/notificaciones/leidas` | `204` |
| `POST` | `/notificaciones/dispositivos` | `{ token, plataforma: "web", descripcion }` → `204` (web push) |
| `DELETE` | `/notificaciones/dispositivos/{token}` | Al cerrar sesión |

## Agregar un aviso nuevo

1. Agregar el `tipo` a `AVISOS` (canal, prioridad, vigencia, push) y su función de texto en
   `avisos.ts`.
2. Llamar `notificaciones.notificar(userIds, aviso)` desde un listener del bus de eventos (o desde
   el servicio que lo origina, fuera de su transacción).
3. Documentarlo en el catálogo de arriba y, si abre una pantalla nueva, coordinar el `link` con la app.
