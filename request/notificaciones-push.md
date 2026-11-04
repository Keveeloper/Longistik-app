# Requerimiento — Notificaciones y push (app móvil + web)

**Estado:** implementado en backend, panel y app (02/11/2026); falta la web (§8). Reemplaza y
amplía la propuesta P4 de `mobile-app-api-requirements.md`. Es la base del seguimiento de viaje
(`seguimiento-viaje.md`). Contratos: `mobile-api.md` §P4, `notificaciones-api.md` (backend) y
`ConfigPanel/docs/push-tenant-api.md` (panel).

Diferencias con esta propuesta al implementarla:
- La llave `sk_push_` se guarda en la tabla `api_clients` del panel (`kind = 'push'`), como las de
  soporte, en una fila aparte para revocar el push sin cortar el soporte.
- En el push, `data.empresa` la agrega el panel (sale de la llave); el backend no la envía.
- La web tiene además `GET /notificaciones/sin-leer` para el contador de la campana.
- Del catálogo (§6) ya salen los dos de sobreanticipos y los de seguimiento; `sobreanticipo.pagado`,
  `rndc.rechazo`, `manifiesto.asignado` y `remesa.entregada` esperan a que el core emita su evento.
- Prerrequisitos pendientes (§3): `appId` definitivo, plataformas nativas, cuentas de las tiendas,
  proyecto de Firebase y cuenta de servicio. Sin ellos la campana funciona y el push queda apagado.

**Para quién:** los equipos de backend (`backlogistic`), panel (`ConfigPanel`), app móvil
(`Longistik-app`) y web (`longistik-frontend`).

---

## 1. Objetivo

Avisar a cada usuario de lo que le toca hacer o de lo que cambió, en el celular y en el
navegador, aunque no tenga la app o la web abiertas. Por ejemplo:

- Al conductor: *"Tu sobreanticipo de $350.000 fue aprobado"*.
- Al despachador: *"El RNDC rechazó la remesa RM0004501"*.

Principios:

1. **El centro de notificaciones (la campana) es la fuente de la verdad.** Cada aviso se guarda
   en el backend de la empresa. El push solo es el "timbre": si no llega (teléfono apagado,
   permiso negado, navegador cerrado), el aviso igual está en la campana.
2. **Nunca bloquea la operación.** Si falla el envío, el flujo que generó el aviso (aprobar,
   reportar al RNDC…) sigue igual.
3. **Los correos que ya existen se mantienen.** El push los complementa, no los reemplaza.
4. **El contenido es corto y sin datos sensibles.** El detalle se ve al abrir la app.

---

## 2. Arquitectura

```
 Evento de negocio (bus BACKLOGISTIC_EVENTS)
        │
        ▼
 backlogistic de la empresa ── guarda la notificación (campana) + la encola para push
        │  worker (cada 15 s) con reintentos
        │  X-Client-Key: PUSH_PANEL_KEY
        ▼
 ConfigPanel  POST /api/tenant/push/send ── única dueña de la credencial de Firebase
        │  FCM HTTP v1
        ▼
 Firebase Cloud Messaging ──► Android · iOS (vía APNs) · navegadores (web push)
```

### Por qué el envío pasa por el panel

- Hay **una sola app en las tiendas**, así que hay **un solo proyecto de Firebase** atado a su
  `appId`. Su credencial (una cuenta de servicio de Google) puede enviar push a *todos* los
  usuarios de *todas* las empresas.
- Si esa credencial viviera en cada backend, una instalación comprometida podría enviar push a
  los usuarios de otras empresas. En el panel queda en un solo lugar, cifrada.
- El panel ya recibe llamadas de los backends con `X-Client-Key` (soporte,
  `ConfigPanel/docs/support-tenant-api.md`) y ya tiene cron. Se reutiliza ese patrón.
- El panel **no guarda** tokens ni contenido. Reenvía y responde qué tokens quedaron inválidos.
  Los tokens y los avisos viven en el backend de cada empresa.

### Proyecto de Firebase

- Un proyecto **"Longistik"**, con tres apps registradas: Android, iOS y Web.
- Se usa la **API HTTP v1** de FCM (la API "legacy" la apagó Google en 2024). El panel firma un
  JWT con la cuenta de servicio (RS256, `openssl_sign` en PHP, sin SDK) para obtener el token
  OAuth2, y lo guarda en caché unos 55 minutos.
- iOS: se sube a Firebase la **llave APNs** (`.p8`) de la cuenta de Apple Developer.
- Web: una **llave VAPID** del proyecto, pública, va en la configuración de la web.

---

## 3. Prerrequisitos (fase 0)

| # | Qué | Quién |
|---|---|---|
| 1 | Definir el `appId` final (hoy `io.ionic.starter`), p. ej. `com.longistik.app`. **No se puede cambiar después**: Firebase y las tiendas quedan atados a él | Producto |
| 2 | Agregar las plataformas Android e iOS a la app (`npx cap add`) | App |
| 3 | Cuentas: Google Play Console (US$ 25, una vez) y Apple Developer (US$ 99 al año) | Producto |
| 4 | Crear el proyecto de Firebase y registrar las 3 apps. `google-services.json` y `GoogleService-Info.plist` van en la app; la configuración web va en la web | App / Web |
| 5 | Llave APNs (`.p8`) subida a Firebase | App |
| 6 | Cuenta de servicio de Firebase con el rol *Firebase Cloud Messaging API Admin*; su JSON se carga **solo** en el panel | Panel |
| 7 | Política de privacidad publicada (la exigen las tiendas). Ver también `seguimiento-viaje.md` | Producto |

Costo de FCM: **gratis**.

---

## 4. Panel (ConfigPanel)

### 4.1 Llave por cliente

- Llave nueva `sk_push_…` por cliente, generada en la ficha del cliente → **Notificaciones** →
  *Generar llave*. Se muestra una sola vez y se guarda como hash, igual que las de soporte.
- En el backend del cliente: `PUSH_PANEL_URL` y `PUSH_PANEL_KEY`. Sin llave, el backend no
  envía push, pero la campana funciona igual.
- Revocar la llave corta el push de esa empresa de inmediato.

### 4.2 `POST /api/tenant/push/send`

Cabecera `X-Client-Key: sk_push_…`. El cliente se deduce de la llave.

```json
{
  "mensajes": [
    {
      "ref": "n-98123",
      "tokens": ["fcm-token-1", "fcm-token-2"],
      "titulo": "Sobreanticipo aprobado",
      "cuerpo": "MT000812: aprobado por $300.000",
      "canal": "operacion",
      "prioridad": "normal",
      "ttlSegundos": 86400,
      "agrupar": "sobreanticipo-7",
      "data": { "notificacionId": "98123", "tipo": "sobreanticipo.decidido", "link": "{\"tipo\":\"manifiesto\",\"id\":812,\"seccion\":\"sobreanticipos\"}", "empresa": "finaltest", "userId": "34" }
    }
  ]
}
```

- Máximo 100 mensajes por llamada y 500 tokens por mensaje.
- `canal`: `operacion` | `seguimiento` | `alertas` (ver §7.3). `prioridad`: `normal` | `alta`.
  `alta` solo para alertas de seguridad y pedidos de ubicación.
- `agrupar`: avisos con el mismo valor se reemplazan en el teléfono en vez de acumularse.
- `data`: solo valores string (exigencia de FCM).

Respuesta `200`:

```json
{
  "resultados": [
    { "ref": "n-98123", "enviados": 1, "invalidos": ["fcm-token-2"], "errores": 0 }
  ]
}
```

- `invalidos`: tokens que FCM reportó como `UNREGISTERED` o `INVALID_ARGUMENT`. El backend los
  borra.
- Errores: `401` llave inválida, `400` cuerpo inválido, `429` límite superado (por defecto 600
  mensajes por minuto por cliente), `503` FCM no disponible (el backend reintenta).
- El panel registra **solo conteos** por cliente y día (enviados, inválidos, errores) para
  soporte y facturación. No guarda tokens ni textos.

---

## 5. Backend de cada empresa (`backlogistic`)

### 5.1 Tablas

**`dispositivo`**: un registro por app instalada o navegador.

| Campo | Notas |
|---|---|
| `id`, `userId` | |
| `token` | Token FCM, **único**. Si llega uno ya registrado con otro usuario (teléfono compartido), se reasigna al nuevo |
| `plataforma` | `android` \| `ios` \| `web` |
| `appVersion`, `descripcion` | Versión de la app o navegador ("Chrome en Windows"), para que el usuario reconozca el dispositivo |
| `creadoEn`, `ultimoUso` | `ultimoUso` se actualiza en cada registro |

Los tokens sin uso en 60 días se borran. Al desactivar un usuario se borran sus dispositivos.

**`notificacion`**: la campana.

| Campo | Notas |
|---|---|
| `id`, `userId` | |
| `tipo` | Código del evento (§6), p. ej. `sobreanticipo.decidido` |
| `titulo`, `mensaje` | Máx. 65 y 240 caracteres |
| `link` | JSON `{ tipo, id, seccion? }` (§7.4) o `null` |
| `prioridad` | `normal` \| `alta` |
| `creadaEn`, `leidaEn` | |
| `pushEstado` | `pendiente` \| `enviada` \| `sin_dispositivos` \| `error` \| `no_aplica` |
| `pushIntentos`, `pushSiguienteIntento`, `pushError` | Reintentos: 30 s, 2 min, 10 min, 1 h; después `error` |

Retención: 90 días.

### 5.2 Envío

- Un servicio `NotificacionesService.notificar(userIds, aviso)` guarda una fila por usuario con
  `pushEstado = pendiente`. Lo llaman los *listeners* del bus de eventos, igual que
  `SobreanticipoNotificacionListener` llama hoy al correo. Nunca lanza errores al flujo que lo
  llamó.
- Un *worker* dentro del proceso (`setInterval` cada 15 s, mismo patrón que
  `ExportacionContableService`):
  1. Toma las pendientes vencidas.
  2. Las agrupa por usuario y les adjunta los tokens.
  3. Llama al panel.
  4. Marca `enviada` o reintenta, y borra los tokens inválidos.
- Un aviso cuyo `ttl` venció no se envía por push (queda en la campana).
- Si el usuario no tiene dispositivos, queda `sin_dispositivos`.

### 5.3 API de la app (`/mobile`, convenciones de `mobile-api.md`)

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/mobile/dispositivos` | `{ token, plataforma, appVersion, descripcion }`. Alta o actualización (idempotente). `204` |
| `DELETE` | `/mobile/dispositivos/{token}` | Al cerrar sesión. `204`; también si ya no existía |
| `GET` | `/mobile/notificaciones?soloNoLeidas=&page=&pageSize=` | `{ items, page, pageSize, total }` con `{ id, tipo, titulo, mensaje, link, prioridad, creadaEn, leida }`, más recientes primero |
| `POST` | `/mobile/notificaciones/{id}/leida` | `204`. Solo las propias (`404` si no) |
| `POST` | `/mobile/notificaciones/leidas` | Marca todas. `204` |

`GET /mobile/home/summary` ya trae `notificacionesSinLeer`: pasa a contar las de esta tabla.

### 5.4 API de la web

Los mismos cinco endpoints bajo la sesión web (`/notificaciones`, `/notificaciones/dispositivos`),
con las convenciones del resto del backend web.

---

## 6. Catálogo de avisos (v1)

Destinatarios "por permiso" = usuarios activos cuyo rol tiene ese permiso, igual que hoy se
eligen los aprobadores de sobreanticipos. Quien originó la acción no se notifica a sí mismo.

| `tipo` | Cuándo | Para quién | Push | Evento en el bus |
|---|---|---|---|---|
| `sobreanticipo.solicitado` | Llega una solicitud | Aprobadores (`canEdit` en *Solicitudes de sobreanticipo*) | Sí | ✅ ya se emite |
| `sobreanticipo.decidido` | Aprobada o rechazada | Quien la pidió | Sí | ✅ ya se emite |
| `sobreanticipo.pagado` | Tesorería la paga | Quien la pidió | Sí | ➕ nuevo |
| `rndc.rechazo` | El RNDC rechaza una remesa, manifiesto o cumplido | Quien lo envió; si fue automático, usuarios con `rndc.enviar` | Sí | ➕ nuevo |
| `manifiesto.asignado` | Se expide un manifiesto para un vehículo | Usuarios con asignación vigente a ese vehículo (`mobile-vehicle-assignment-api.md`) | Sí | ➕ emitir `chargeOrder.creado` (reservado) |
| `remesa.entregada` | Un conductor registra una entrega desde la app | Usuarios con `manifiestos.ver_todos` (opcional, configurable) | No (solo campana) | ➕ emitir `track.entregada` (reservado) |
| `seguimiento.*` | Ver `seguimiento-viaje.md` | | | |

El texto de cada aviso se define en una sola función por `tipo` en el backend, para que app y
web muestren lo mismo.

**Preferencias (v2):** el usuario podrá silenciar el push de algunos tipos (la campana siempre se
guarda). En v1 todo está activo. Las alertas de seguridad (`seguimiento.auxilio`) no se pueden
silenciar.

---

## 7. App móvil

### 7.1 Plugin

`@capacitor-firebase/messaging`, que entrega el **token FCM** también en iOS. El oficial
`@capacitor/push-notifications` entrega en iOS el token de APNs, y el backend tendría que hablar
con dos servicios.

### 7.2 Permiso y registro

- **No pedir el permiso al abrir la app.** Después del primer inicio de sesión, mostrar una
  tarjeta en Inicio, *"Activa las notificaciones para saber cuándo aprueban tus sobreanticipos o
  te asignan un viaje"*, con el botón **Activar**. Ese botón dispara el diálogo del sistema
  (Android 13+ también lo exige: `POST_NOTIFICATIONS`).
- Si el usuario lo niega, la tarjeta se puede cerrar y no vuelve a aparecer en 30 días. En la
  cuenta queda "Notificaciones: desactivadas" con un enlace a los ajustes del sistema.
- Con la sesión iniciada y el permiso dado: `POST /mobile/dispositivos` al abrir la app y cada
  vez que el plugin informe un token nuevo.
- **Cerrar sesión** (incluido cambiar de empresa o una sesión cerrada por el backend):
  1. `DELETE /mobile/dispositivos/{token}` mientras el token de sesión sigue siendo válido.
  2. Borrar el token FCM local.
  3. Limpiar la sesión.

  Si el `DELETE` falla, se cierra la sesión igual (el token queda huérfano y se limpia por
  inactividad).

### 7.3 Canales de Android

| Canal | Importancia | Uso |
|---|---|---|
| `operacion` | Normal | Sobreanticipos, manifiestos, RNDC |
| `seguimiento` | Alta | Pedidos de ubicación del seguimiento de viaje |
| `alertas` | Alta, con sonido | Auxilio y alertas de seguridad |

### 7.4 Al tocar una notificación

`link` → ruta de la app:

| `link.tipo` | Ruta |
|---|---|
| `manifiesto` | `/manifiestos/{id}` (con `seccion` → `?seccion=…`) |
| `remesa` | `/remesas/{id}` |
| `seguimiento` | `/manifiestos/{id}?seccion=seguimiento` |
| sin `link` | Lista de notificaciones |

- Si `data.empresa` o `data.userId` no coinciden con la sesión actual, se abre Inicio y no se
  navega (era de otra sesión).
- La navegación respeta el guard: sin sesión, primero Login y después la pantalla.
- Se marca como leída al abrirla.

### 7.5 Con la app abierta

No se muestra la notificación del sistema. Se muestra un toast con el título y un botón **Ver**,
y se actualiza el punto de la campana.

### 7.6 Pantalla "Notificaciones"

Se abre desde la campana de Inicio (hoy dice "Disponible próximamente"):

- Lista paginada con las no leídas resaltadas.
- *Pull to refresh* y "Marcar todas como leídas".
- Sin señal, muestra la última lista guardada, como las demás listas.

---

## 8. Web (`longistik-frontend`, Next)

- `firebase/messaging` se carga **solo** cuando el usuario activa los avisos (carga diferida,
  para no hacer más pesada la web).
- Service worker `public/firebase-messaging-sw.js`. Cada empresa tiene su dominio, así que cada
  dominio registra el suyo; la configuración de Firebase es la misma para todas.
- **Campana** en la barra superior:
  - contador de no leídas, actualizado cada 60 s mientras la pestaña está visible;
  - menú con las últimas 10 y "Ver todas".
- **Permiso:** el menú de la campana muestra *"Activar avisos en este navegador"*. No se pide al
  cargar la página: los navegadores castigan esas peticiones.
- Con la pestaña abierta, el aviso llega por `onMessage`: snackbar con **Ver**, y la lista se
  refresca.
- Soporte: Chrome, Edge, Firefox y Safari de Mac. En iPhone y iPad, Safari solo recibe web push
  si la web se instaló como app (iOS 16.4+): mostrar el aviso correspondiente.
- Al cerrar sesión: `DELETE` del token del navegador.

---

## 9. Seguridad y privacidad

- La credencial de Firebase solo existe en el panel, cifrada. Las llaves `sk_push_` se guardan
  como hash y se pueden revocar.
- Sin datos personales en el texto del push: ni documentos, ni teléfonos, ni direcciones. Los
  valores en pesos se permiten en los avisos al propio solicitante.
- `data.empresa` y `data.userId` evitan abrir avisos de otra sesión en un teléfono compartido.
- Un usuario desactivado deja de recibir push: se borran sus dispositivos y sus pendientes pasan
  a `no_aplica`.

---

## 10. Criterios de aceptación

1. Un aviso se ve en la campana aunque el usuario nunca haya dado permiso de notificaciones.
2. Con el permiso, un sobreanticipo aprobado en la web llega como push al celular del conductor
   en menos de 1 minuto, en Android y en iOS, con la app cerrada.
3. Al tocarlo se abre el manifiesto en la sección de sobreanticipos y el aviso queda leído.
4. Con la app abierta llega como toast, sin notificación del sistema.
5. Tras cerrar sesión, el teléfono no recibe más push de ese usuario.
6. Un aprobador con la web abierta (y avisos activados) recibe la solicitud como push del
   navegador, y la campana se actualiza.
7. Si FCM o el panel no responden, la aprobación funciona igual y el push se envía al
   recuperarse (dentro de los reintentos).
8. Un token desinstalado se borra del backend tras el primer envío fallido.
9. Revocar la llave `sk_push_` de una empresa corta su push y no afecta a las demás.

---

## 11. Plan por fases

| Fase | Contenido |
|---|---|
| **F0** | Prerrequisitos (§3) |
| **F1** | Backend: tablas, campana, endpoints `/mobile` y web, listeners de los 2 eventos que ya existen. App: pantalla de notificaciones. Web: campana. Sin push todavía: ya da valor |
| **F2** | Panel: llave `sk_push_`, `/api/tenant/push/send`, FCM v1. Backend: worker de envío. App: permiso, registro y apertura desde la notificación |
| **F3** | Web push en la web |
| **F4** | Eventos nuevos (§6 ➕) y seguimiento de viaje |

---

## 12. Por decidir

1. **`appId` definitivo** (§3.1).
2. **`remesa.entregada`**: ¿se notifica a los despachadores o es demasiado ruido? Propuesta:
   solo campana, sin push.
3. **Límite por cliente** en el panel (propuesta: 600 mensajes por minuto).
