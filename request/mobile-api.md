# API de la app móvil

Implementa P0, P1 y P2 de [request/mobile-app-api-requirements.md](../request/mobile-app-api-requirements.md), los catálogos de P3, las notificaciones con push (§P4, detalle en [notificaciones-api.md](notificaciones-api.md)), los sobreanticipos (§P5), el cumplido de remesas con evidencia (§P6), el seguimiento de viaje (§P7, detalle en [seguimiento-viaje-api.md](seguimiento-viaje-api.md)) y la fase 1 de [request/mobile-vehicle-assignment-api.md](../request/mobile-vehicle-assignment-api.md) (permisos por rol y asignación de vehículos). Código en `src/mobile/`. Todo aparece en Swagger (`{apiUrl}/docs`, etiqueta **Mobile**). La administración web de las asignaciones está en [vehicle-assignment-api.md](vehicle-assignment-api.md).

## Convenciones

- Todo lo que está bajo `/mobile` (salvo `POST /mobile/auth/login`) exige `Authorization: Bearer <accessToken>`.
- En cada petición se revisan en BD el usuario y los permisos de su rol. El token vive 30 días y por sí solo no se entera de que alguien fue desactivado o de que le cambiaron el rol.
- Los errores llevan el código HTTP real y el cuerpo `{ "statusCode", "code", "message", "errors"? }`. Es distinto del resto del backend, donde los errores se *retornan* con estado 201.
- Fechas en ISO 8601 con `-05:00`. "Hoy" y "mes" se cuentan en hora de Colombia.
- Dinero: entero en pesos.
- Listados: `?page=1&pageSize=20` (máximo 100), con respuesta `{ items, page, pageSize, total }`.

### Errores: cuándo cerrar la sesión

La app decide por el `code`, no solo por el estado HTTP:

| HTTP | `code` | Cuándo | Qué hace la app |
|---|---|---|---|
| `401` | `TOKEN_INVALID` | Token ausente, vencido o inválido, o usuario borrado | Cierra la sesión |
| `401` | `INVALID_CREDENTIALS` | Correo o contraseña incorrectos (solo en el login) | Muestra `message` |
| `403` | `USER_INACTIVE` | Usuario desactivado | Cierra la sesión y muestra `message` |
| `403` | `APP_ACCESS_DENIED` | El rol no tiene `app.acceso` | Cierra la sesión y muestra `message` |
| `403` | `FORBIDDEN` | Falta el permiso de la acción | Muestra `message`, **sin** cerrar la sesión |
| `400` | `BAD_REQUEST` | Datos inválidos (con `errors` por campo) | Muestra `message` |
| `404` | `NOT_FOUND` | No existe **o el usuario no lo puede ver** | Muestra "No encontrado" |
| `409` | `CONFLICT` | Conflicto | Muestra `message` |
| `409` | `SALDO_NEGATIVO` | El sobreanticipo dejaría negativo el saldo al titular (P5) | Muestra `message` (trae el disponible) |
| `409` | `SOBREANTICIPO_TOPE` | Supera el tope de sobreanticipos de la empresa (P5) | Muestra `message` (trae el disponible) |
| `409` | `CONSENTIMIENTO_REQUERIDO` | Iniciar un viaje sin haber aceptado el texto de finalidad vigente (P7) | Muestra el texto y pide aceptarlo |

### Permisos y alcance

Los permisos salen del rol del usuario, en la misma matriz de permisos de la web (pantalla de roles, grupo **App móvil**). Cada código es una celda de esa matriz:

| Código | Módulo (`route`) · acción |
|---|---|
| `app.acceso` | `/mobile` · ver |
| `manifiestos.ver_todos` | `/mobile/manifiestos-todos` · ver |
| `manifiestos.ver_asignados` | `/mobile/manifiestos-asignados` · ver |
| `manifiestos.crear` | `/mobile/manifiestos` · crear |
| `remesas.crear` | `/mobile/remesas` · crear |
| `remesas.cumplir` | `/mobile/remesas` · editar |
| `novedades.reportar` | `/mobile/novedades` · crear |
| `rndc.enviar` | `/mobile/rndc` · crear |
| `sobreanticipos.solicitar` | `/mobile/sobreanticipos` · crear (migración `01-11-2026-app-movil-sobreanticipos.sql`) |
| `vehiculos.asignar` | `/vehicle-assignments` · crear (web) |
| `seguimiento.ver` | `/seguimiento` · ver: ver los viajes y recibir sus alertas (migración `02-11-2026-notificaciones-seguimiento-viaje.sql`) |
| `seguimiento.asignar` | `/seguimiento` · crear: asignar, terminar y pedir la ubicación desde la web |
| `novedades.gestionar` | `/novedades` · editar: tomar, anotar y cerrar novedades desde la web (migración `06-11-2026-novedades-manifiesto.sql`) |

El **alcance** decide qué manifiestos y remesas ve el usuario:
- `todos`: el rol tiene `manifiestos.ver_todos`. Gana si también tiene `ver_asignados`.
- `asignados`: el rol tiene `manifiestos.ver_asignados`. El usuario ve solo lo de sus vehículos asignados, según las reglas de abajo.
- `ninguno`: el rol no tiene ninguno de los dos. Los listados responden vacíos y el resumen en cero; no es un error.

**Con `asignados`, un manifiesto es visible** si el usuario tiene una asignación (no borrada) a su vehículo que cumpla alguna de estas condiciones:
1. La fecha de expedición del manifiesto cae dentro de la vigencia de la asignación (`desde` ≤ expedición ≤ `hasta`, y `hasta` vacío = sin fin). Así se conserva el historial.
2. El manifiesto está activo (abierto y no anulado) y la asignación está vigente hoy. Así, el nuevo responsable de un vehículo reasignado a mitad de viaje ve el viaje en curso.

Una **remesa es visible** si su manifiesto vigente lo es. Las remesas sin manifiesto solo se ven con alcance `todos`.

El filtro se aplica siempre en el servidor. Lo que el usuario no puede ver responde `404`, como si no existiera.

**Roles iniciales** (los crea la migración `20-10-2026-app-movil-asignacion-vehiculos.sql`; cada empresa los ajusta en la matriz):

| Rol | Permisos |
|---|---|
| Administradores | Todos |
| Cualquier otro rol que ya existía | Perfil de despachador: `app.acceso`, `ver_todos`, `manifiestos.crear`, `remesas.crear`, `remesas.cumplir`, `novedades.reportar`, `rndc.enviar` |
| Conductor (nuevo) | `app.acceso`, `ver_asignados`, `remesas.cumplir`, `novedades.reportar` |
| Supervisor de flota (nuevo) | `app.acceso`, `ver_asignados`, `novedades.reportar` |

A ningún usuario se le cambió el rol: eso le habría cambiado también los permisos de la web.

La migración `01-11-2026-app-movil-sobreanticipos.sql` agregó `sobreanticipos.solicitar` a los Administradores, al Conductor y al perfil de despachador; el Supervisor de flota no lo recibe.

### Estados

**Remesa** (`Track.status` → `estado`)

| BD | App |
|---|---|
| Creada | `creada` |
| Manifiesto | `manifiesto` |
| En Ruta | `en_ruta` |
| Cumplido, Entregado | `cumplido` |
| Anulada | `inactivo` |

**Manifiesto**: anulado → `inactivo`; cerrado (`status=false`) → `cumplido`; abierto → `activo`.

**RNDC** (`estadoRndc`, igual para remesas y manifiestos):

| Estado | Condición |
|---|---|
| `reportado` | Tiene `idRndc`, o `statusWS` es numérico |
| `pendiente` | `statusWS` vacío, `PENDIENTE` o `PENDING` (aún no se intenta o está en curso) |
| `error` | Cualquier otro texto en `statusWS`, que es el rechazo del RNDC. Se devuelve en `rndcError` |

## P0 · Autenticación

### `POST /mobile/auth/login`

Body: `{ "email", "password" }`. Usa los mismos usuarios de la web. Responde `201`:

```json
{
  "accessToken": "eyJ...",
  "expiresIn": 2592000,
  "user": {
    "id": 34,
    "name": "Andrés",
    "lastName": "Rojas",
    "email": "andres@empresa.com",
    "role": "Conductor",
    "alcance": "asignados",
    "permisos": ["app.acceso", "manifiestos.ver_asignados", "remesas.cumplir", "novedades.reportar"],
    "vehiculos": [{ "id": 12, "placa": "ABC123", "desde": "2026-10-21T00:00:00-05:00", "hasta": null }]
  }
}
```

- `401 INVALID_CREDENTIALS` "Correo o contraseña incorrectos": el correo no existe o la contraseña está mal. El mensaje es el mismo en los dos casos, para no revelar qué correos existen.
- `403 USER_INACTIVE`: el usuario está inactivo. Solo se responde cuando la contraseña es correcta.
- `403 APP_ACCESS_DENIED`: el rol no tiene `app.acceso`.
- El login es **siempre por correo**, también para los conductores. El correo es obligatorio en todo usuario porque sin él no se puede recuperar la contraseña. La web lo valida al crear y al editar: responde `400` si falta o no tiene formato de correo, y `409` si ya lo usa otro usuario. Si un conductor no tiene correo, hay que crearle uno.
- La tabla `users` guarda un solo nombre: `name` es la primera palabra y `lastName` el resto.
- `role` es el nombre del rol en la web (`null` si el usuario no tiene rol).
- `vehiculos` trae las asignaciones vigentes. Solo se llena con alcance `asignados`; con `todos` o `ninguno` va vacío.

`POST /public/authentication/login` (el de la web) también quedó con `401`/`403` en vez de `500`. Su respuesta no cambia (`access_token`, token de 20 h). La app debe usar `/mobile/auth/login`.

### `GET /mobile/me`

Devuelve lo mismo que `user` del login, más `status: true`. La app debe llamarlo también al volver al primer plano, para que una asignación nueva aparezca sin cerrar la sesión.

### `POST /public/authentication/forgot-password`

Ya cumple lo pedido: siempre responde `201` con un mensaje genérico, exista o no el correo. El enlace del correo apunta a `${FRONTEND_URL}/reset-password?token=...`, es decir, a la web de la empresa.

### Logout

No se implementó. Los tokens no se guardan en el servidor, así que la app solo borra el token local.

## P1 · `GET /mobile/home/summary`

Las cifras se calculan solo sobre lo que el usuario puede ver (su alcance). Con alcance `ninguno`, todo va en cero.

| Campo | Cálculo |
|---|---|
| `remesasHoy` | Remesas creadas hoy, sin contar las anuladas |
| `manifiestosDespachadosHoy` | Manifiestos con fecha de despacho hoy, sin contar los anulados. Si no tienen fecha de despacho, se usa la de creación |
| `remesasPendientesRndc` | Remesas no anuladas sin ID del RNDC, pendientes o con error. Se cuentan todas, de cualquier fecha |
| `rndc.reportadas` / `rndc.total` | Remesas del **mes en curso**: reportadas sobre el total, sin contar las anuladas |
| `manifiestosActivos` | Manifiestos abiertos y no anulados |
| `notificacionesSinLeer` | Siempre `0`, porque todavía no hay módulo de notificaciones |

## P2 · Consultas

### `GET /mobile/manifiestos`

Filtros:
- `estado` (`activo` | `cumplido` | `inactivo`) y `estadoRndc`.
- `vehiculoId`: con alcance `asignados` debe ser uno de los vehículos del usuario (vigente o de su historial); si no, responde `404`.
- `q`: número, consecutivo RNDC, placa, o nombre o documento del conductor.
- `page` y `pageSize`.
- `mine` se acepta pero no tiene efecto: el alcance ya limita lo que ve el usuario.

Cada item trae los campos de la propuesta, más `vehiculoId`.
- `fechaExpedicion` es la fecha de despacho, o la de creación si no tiene.
- `conductor` es el **guardado en el manifiesto** al expedirlo. En manifiestos viejos sin ese dato, es el conductor actual del vehículo.
- `origen`/`destino` salen de la ruta.

### `GET /mobile/manifiestos/{id}`

Trae los mismos campos que el item del listado, más:
- `remesas`: arreglo con el resumen de cada remesa. Si el manifiesto está anulado, son las remesas que liberó, con `manifiestoId: null`.
- `novedades`: las del manifiesto, con el formato del item de §P8, de la más reciente a la más antigua.
- `rndcError`.

Responde `404` si no existe o si el usuario no lo puede ver.

### `GET /mobile/remesas`

Filtros: `estado` (`creada` | `manifiesto` | `en_ruta` | `cumplido` | `inactivo`, o varios separados por coma: `manifiesto,en_ruta`), `estadoRndc`, `manifiestoId`, `q` (número, consecutivo RNDC, nombre o documento del cliente), `page` y `pageSize`.

- `origen`/`destino` salen de la ciudad del remitente y del destinatario.
- `producto` es el primero de la remesa, o "X y N más" si tiene varios.
- `cantidad` y `pesoKg` suman todos los detalles.
- `manifiestoId` es el manifiesto vigente (no anulado) de la remesa.

### `GET /mobile/remesas/{id}`

Trae los mismos campos que el item del listado, más:
- `rndcError`.
- `remitente` y `destinatario`: `{ documento, nombre, direccion, telefono, municipio }`.
- `observaciones`.
- `detalles`: `[{ producto, cantidad, pesoKg, valorDeclarado }]`.
- `cumplido`: `{ estadoRndc, rndcError }`. `estadoRndc` es `null` si todavía no se ha enviado el cumplido.

Responde `404` si no existe o si el usuario no la puede ver.

### `POST /mobile/rndc/enviar` — permiso `rndc.enviar`

Body: `{ "remesaIds": [4501, 4502] }`, con máximo 50 remesas. Sin el permiso responde `403 FORBIDDEN`. Si lo tiene, responde `200` cuando termina con todas:

```json
{
  "resultados": [
    { "remesaId": 4501, "estadoRndc": "reportado", "consecutivoRndc": "987654321" },
    { "remesaId": 4502, "estadoRndc": "error", "mensaje": "Placa no registrada en el RUNT" }
  ]
}
```

- El envío es **síncrono**: las remesas se mandan una a una y en el orden recibido.
- Usa el mismo flujo que el reenvío de la web (`TrackService.createWS`): primero registra los terceros pendientes, luego resuelve el propietario de la carga y guarda `statusWS`.
- Si una remesa ya está reportada, no se reenvía; se devuelve su consecutivo.
- Una remesa que no existe, o que el usuario no puede ver, vuelve con `estadoRndc: "error"` y `mensaje: "Remesa no encontrada"`. Una remesa anulada vuelve con su propio mensaje de error. En ninguno de los dos casos se envía.
- Si el RNDC no responde, la remesa puede quedar en `pendiente` con el mensaje del fallo.

### `GET /mobile/rndc/reporte?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

Si no se envían fechas, toma el mes en curso. Cuenta las remesas visibles creadas en el rango, sin las anuladas:

```json
{
  "desde": "2026-10-01", "hasta": "2026-10-31",
  "totales": { "reportado": 149, "pendiente": 2, "error": 1, "total": 152 },
  "errores": [ { "...item de remesa": "...", "rndcError": "..." } ]
}
```

`errores` trae como máximo 200 remesas, las más recientes primero.

## P3 · Catálogos

Todos aceptan `?q=`, no se paginan y devuelven como máximo 50 resultados.

| Endpoint | Permiso | Devuelve |
|---|---|---|
| `GET /mobile/catalogos/clientes` | `manifiestos.crear` o `remesas.crear` | `{ id, nombre, documento, municipio }`. Solo clientes activos |
| `GET /mobile/catalogos/productos` | `manifiestos.crear` o `remesas.crear` | `{ id, nombre, codigoMinisterio }`. Solo productos activos |
| `GET /mobile/catalogos/conductores` | `manifiestos.crear` o `remesas.crear` | `{ id, nombre, documento, licencia }`. Solo personal `Conductor` en estado `ACTIVO` |
| `GET /mobile/catalogos/municipios` | — | `{ id, codigoDane, nombre }` |
| `GET /mobile/catalogos/vehiculos` | — | `{ id, nombre, placa, conductor }`. Solo vehículos activos. Con alcance `asignados`, solo los del usuario con asignación vigente; con `ninguno`, lista vacía |

Sin el permiso, los catálogos que lo exigen responden `403 FORBIDDEN`.

## P4 · Notificaciones y push

Detalle (arquitectura, catálogo de avisos, envío y reintentos): [notificaciones-api.md](notificaciones-api.md).
Requerimiento: `request/notificaciones-push.md`.

La **campana** es la fuente de la verdad: cada aviso se guarda para el usuario aunque el push no
llegue. El push sale por el ConfigPanel, único con la credencial de Firebase; sin `PUSH_PANEL_URL` /
`PUSH_PANEL_KEY` en el env solo hay campana. `notificacionesSinLeer` de `GET /mobile/home/summary`
cuenta los avisos sin leer de la campana.

### `POST /mobile/dispositivos`

`{ "token": "<token FCM>", "plataforma": "android" | "ios", "appVersion": "1.0.0", "descripcion": "android 14 · Pixel 7" }`
→ `204`. Idempotente: la app lo llama al abrir con sesión y cada vez que Firebase le entrega un token
nuevo. Un token ya registrado con otro usuario (teléfono compartido) pasa al nuevo. `400` con
`errors` si el token o la plataforma no son válidos.

### `DELETE /mobile/dispositivos/{token}`

Al cerrar sesión, mientras el token de sesión sigue valiendo. `204` también si no existía.

### `GET /mobile/notificaciones?soloNoLeidas=&page=&pageSize=`

`{ items, page, pageSize, total }`, más recientes primero:

```json
{
  "id": 98123,
  "tipo": "sobreanticipo.decidido",
  "titulo": "Sobreanticipo aprobado",
  "mensaje": "MT000812: aprobado por $ 300.000 (pediste $ 350.000). Queda listo para pago.",
  "link": { "tipo": "manifiesto", "id": 812, "seccion": "sobreanticipos" },
  "prioridad": "normal",
  "creadaEn": "2026-11-02T09:00:00-05:00",
  "leida": false
}
```

`link.tipo`: `manifiesto` | `remesa` | `seguimiento` (el viaje del manifiesto `id`) | `novedad` (§P8), o `link: null`.

### `POST /mobile/notificaciones/{id}/leida` y `POST /mobile/notificaciones/leidas`

`204`. Solo las propias (`404` si no).

### El push

`notification` con título y mensaje, y `data` (todo texto): `notificacionId`, `tipo`, `userId`,
`link` (JSON) y `empresa` (código del cliente, lo agrega el panel). La app no abre un aviso cuyo
`empresa` o `userId` no coinciden con la sesión. Canales de Android: `operacion`, `seguimiento`
y `alertas`.

## P5 · Sobreanticipos

Requerimiento funcional de la app: `request/app-movil-sobreanticipos.md`.

El conductor (o el despachador) **pide** un sobreanticipo en ruta; un aprobador lo decide en la
web y tesorería lo paga desde la liquidación del manifiesto. La app **solo solicita** y cancela
las propias. Las reglas son las mismas de la web (`docs/liquidacion-manifiesto-api.md`):
manifiesto aceptado por el RNDC, sin cumplido y no anulado; el saldo al titular no puede quedar
negativo (descontando lo aprobado y sin pagar); y el tope de la empresa, si lo configuró.

Estados de una solicitud: `solicitada` (pendiente de aprobación) → `aprobada` (lista para
pago) o `rechazada` → `pagada`; `cancelada` si la cancela quien la pidió o un aprobador, o
automáticamente al cumplirse o anularse el manifiesto.

Item de solicitud:

```json
{
  "id": 7,
  "manifiestoId": 812,
  "manifiesto": "MT000812",
  "placa": "ABC123",
  "valor": 350000,
  "valorAprobado": null,
  "pagado": 0,
  "motivo": "varada",
  "motivoNombre": "Varada",
  "descripcion": "Cambio de llanta en La Línea",
  "soporteUrl": null,
  "origen": "app",
  "estado": "solicitada",
  "fechaSolicitud": "2026-10-28T08:12:00-05:00",
  "fechaDecision": null,
  "notas": null,
  "alertaTope": null
}
```

- `valorAprobado`: `null` hasta que se apruebe; puede ser menor a `valor`.
- `pagado`: solo en `GET /mobile/manifiestos/{id}/sobreanticipos`.
- `notas`: motivo del rechazo, notas del aprobador o de la cancelación.
- `alertaTope`: texto si se pidió por encima del tope de la empresa en modo aviso.

### `GET /mobile/catalogos/motivos-sobreanticipo` — permiso `sobreanticipos.solicitar`

`[{ "codigo": "varada", "nombre": "Varada", "requiereDescripcion": false }, …]`. Códigos:
`varada`, `reparacion`, `peajes`, `combustible`, `alimentacion_hospedaje`,
`cargue_descargue`, `otro` (este exige `descripcion`).

### `GET /mobile/manifiestos/{id}/sobreanticipos`

Mismo alcance que el detalle del manifiesto (`404` si no lo ve).

```json
{
  "manifiestoId": 812,
  "disponible": 1122500,
  "puedeSolicitar": true,
  "motivoNoDisponible": null,
  "items": [ { "...item de solicitud": "..." } ]
}
```

- `disponible`: lo máximo que se puede pedir por saldo (no incluye el tope de la empresa).
- `puedeSolicitar: false` con `motivoNoDisponible`: *"El manifiesto está anulado."*, *"El
  manifiesto todavía no ha sido aceptado por el RNDC."*, *"El manifiesto ya tiene el cumplido:
  no admite más sobreanticipos."* o *"No queda saldo disponible para sobreanticipos."*

### `POST /mobile/manifiestos/{id}/sobreanticipos` — permiso `sobreanticipos.solicitar`

```json
{ "valor": 350000, "motivo": "varada", "descripcion": "Cambio de llanta en La Línea", "soporte": "https://…/foto.jpg" }
```

`valor` (entero en pesos) y `motivo` son obligatorios; `descripcion`, obligatoria con
`otro`. `soporte` es una URL (la subida de archivos llega con novedades).

`201` con el item de solicitud más `mensaje` (*"Solicitud de sobreanticipo #7 por $350.000
registrada en el manifiesto MT000812: queda pendiente de aprobación."*). Notifica por correo a
los aprobadores.

| HTTP | `code` | Cuándo |
|---|---|---|
| `400` | `BAD_REQUEST` | Valor o motivo inválidos, o falta la descripción (`errors` por campo) |
| `403` | `FORBIDDEN` | Sin `sobreanticipos.solicitar` |
| `404` | `NOT_FOUND` | El manifiesto no existe o el usuario no lo ve |
| `409` | `CONFLICT` | Manifiesto anulado, sin aceptar en el RNDC o ya cumplido |
| `409` | `SALDO_NEGATIVO` | Supera el saldo disponible (el `message` trae el disponible) |
| `409` | `SOBREANTICIPO_TOPE` | Supera el tope de la empresa en modo bloqueo |

### `GET /mobile/sobreanticipos?estado=&page=&pageSize=` — permiso `sobreanticipos.solicitar`

Las solicitudes **del usuario**, más recientes primero: `{ items, page, pageSize, total }`.
`estado`: `solicitada` | `aprobada` | `rechazada` | `pagada` | `cancelada`.

### `POST /mobile/sobreanticipos/{id}/cancelar` — permiso `sobreanticipos.solicitar`

Body opcional `{ "notas": "Ya no se necesita" }`. Solo las propias (`404` si es de otro),
`solicitada` o `aprobada` sin pagos; si no, `409 CONFLICT` con el motivo. `200` con el
item actualizado y `mensaje`.

## P6 · Cumplido de remesas y documentos en vía

Código en `src/mobile/cumplidos` y `src/mobile/documentos`. Migración
`migrations/databases/02-11-2026-app-movil-cumplido-remesas.sql` (tabla `remesaEntrega`).

El conductor registra la **entrega**: fotos, quién recibe, kg entregados y la ubicación del
teléfono. En la misma llamada, el backend reporta el **cumplido al RNDC** (proceso 5, con
`TrackService.cumplirTrack`, el mismo de la web) con los tiempos que propone el monitoreo del
manifiesto (`MonitoreoCumplidoService`, ver [monitoreo-manifiesto-api.md](monitoreo-manifiesto-api.md)),
o con los que mande la app si el usuario los ajustó. La entrega **se guarda siempre primero**: si
el RNDC falla, queda registrada y el cumplido se reintenta (desde la app o desde la web).
Las fotos dejan la remesa en `Entregado` igual que `POST /track/upload/:guideId` (foto en
`track.filename` e historial).

| `rndc.estado` de la entrega | Cuándo |
|---|---|
| `reportado` | El RNDC aceptó el cumplido |
| `error` | El RNDC lo rechazó; `mensaje` trae su respuesta (con la ventana de cargue en CRE111/141/319) |
| `pendiente` | No se envió: la remesa no está reportada en el RNDC, o no hay monitoreo coherente y la app no mandó tiempos |
| `no_aplica` | Remesa municipal (mismo municipio de cargue y descargue): se cierra con el cumplido del manifiesto (CRE015) |

### `GET /mobile/remesas/{id}/cumplido`

```json
{
  "remesaId": 4501, "numero": "RM0004501",
  "puedeCumplir": true, "motivoNoDisponible": null,
  "puedeReintentarRndc": false,
  "municipal": false, "pesoKg": 8500,
  "cumplido": { "estadoRndc": null, "rndcError": null },
  "entregas": [ "…ver la entrega abajo…" ]
}
```

`puedeCumplir` es `false` sin el permiso `remesas.cumplir`, si la remesa está anulada, si ya está
cumplida en el RNDC o si ya tiene una entrega registrada (`motivoNoDisponible` dice cuál).
`puedeReintentarRndc` es `true` si hay entrega y el RNDC todavía no aceptó el cumplido.

### `GET /mobile/remesas/{id}/cumplido/tiempos` — permiso `remesas.cumplir`

Consulta el monitoreo del RNDC (tarda unos segundos). Horas locales de Colombia sin zona (`AAAA-MM-DDTHH:MM`):

```json
{
  "tiempos": {
    "cargue":    { "llegada": "2026-10-20T07:21", "entrada": "2026-10-20T07:25", "salida": "2026-10-20T07:30" },
    "descargue": { "llegada": "2026-10-20T14:59", "entrada": "2026-10-20T15:01", "salida": "2026-10-20T15:04" }
  },
  "coherente": true,
  "fuenteCargue": "cumplidoInicial",
  "avisos": ["El cumplido inicial del RNDC (07:21–07:30) no coincide con el monitoreo del punto 1…"],
  "mensaje": null
}
```

`tiempos` es `null` (con `mensaje`) si la remesa es municipal, no tiene manifiesto, el manifiesto no
está en el RNDC o no hay monitoreo para sus puntos de control.

### `POST /mobile/remesas/{id}/cumplido` — permiso `remesas.cumplir`

`multipart/form-data` con el header **`Idempotency-Key`** (obligatorio, 8 a 64 caracteres; la app usa
un UUID por entrega). Si la misma llave llega otra vez, se responde la misma entrega sin duplicarla ni
volver al RNDC: la app reintenta los envíos que se quedaron sin señal.

| Campo | Requerido | |
|---|---|---|
| `fotos` | ✅ | 1 a 5 imágenes JPG, PNG o WEBP de hasta 10 MB. Quedan en `uploads/cumplidos` |
| `recibidoNombre` | ✅ | Quién recibe |
| `recibidoDocumento` | | |
| `cantidadEntregada` | | Kg entregados. Por defecto, el peso total de la remesa; no puede superarlo |
| `observaciones` | | Van también al cumplido RNDC |
| `latitud`, `longitud` | ✅ | Ubicación del teléfono |
| `precisionMetros` | | Radio de precisión del GPS |
| `capturadoEn` | | ISO 8601: hora del teléfono al tomar la evidencia. Hasta 30 días atrás (envío que esperó señal); por defecto, la hora de llegada |
| `dispositivo` | | Texto libre (plataforma y modelo); por defecto, el `User-Agent` |
| `tiempos` | | JSON con `cargue` y `descargue` como en `/cumplido/tiempos`. Sin él se usan los del monitoreo |

Responde `201`:

```json
{
  "entrega": {
    "id": 17,
    "capturadoEn": "2026-10-21T15:20:00-05:00", "registradoEn": "2026-10-21T15:20:04-05:00",
    "registradoPor": "Andrés Rojas",
    "recibidoPor": { "nombre": "Ana Gómez", "documento": "1144556677" },
    "cantidadEntregadaKg": 8500,
    "observaciones": null,
    "ubicacion": { "latitud": 4.6097102, "longitud": -74.0817501, "precisionMetros": 8.4 },
    "fotos": ["https://…/static/cumplidos/4b0f….jpg"],
    "dispositivo": "android 14 · Pixel 7",
    "rndc": { "estado": "reportado", "mensaje": "Cumplido de remesa enviado al RNDC. ID: 127368627", "tiemposFuente": "monitoreo" }
  },
  "cumplido": { "estadoRndc": "reportado", "rndcError": null }
}
```

Errores: `400` con `errors` por campo (`fotos`, `recibidoNombre`, `ubicacion`, `cantidadEntregada`,
`capturadoEn`, `tiempos.*`, `Idempotency-Key`); `404` si la remesa no es visible; `409` si está anulada,
ya cumplida en el RNDC o ya tiene entrega. En los errores se borran las fotos subidas.

### `POST /mobile/remesas/{id}/cumplido/rndc` — permiso `remesas.cumplir`

Reintenta el cumplido RNDC de una remesa con entrega registrada. Body opcional `{ "tiempos": {…} }`
(sin él, los del monitoreo). Actualiza el `rndc` de la última entrega y responde `200` como el `POST`.
`409` si no hay entrega o si ya está cumplida.

### `GET /mobile/manifiestos/{id}/pdf`

El mismo PDF de la web (`POST /images/pdf/manifest`, con el QR de seguridad del RNDC), pero con sesión
y alcance (`404` si el usuario no ve el manifiesto). Va en base64 para que la app lo guarde y lo muestre
sin señal; el archivo generado se borra del servidor.

```json
{
  "manifiestoId": 812, "numero": "MT000812", "generadoEn": "2026-10-21T06:10:00-05:00",
  "estado": "activo", "estadoRndc": "reportado", "qrCompleto": true,
  "valido": true, "motivoNoValido": null,
  "archivo": "MT000812.pdf", "pdfBase64": "JVBERi0xLjQK…"
}
```

`valido` es `false` si el manifiesto está anulado, no está aceptado por el RNDC o el PDF salió sin el
QR (falta algún dato del QR, p. ej. el `SEGURIDADQR`). `POST /images/pdf/manifest` ahora devuelve
también `qrCompleto` en `data`.

## P7 · Seguimiento de viaje

Detalle (reglas, evaluación contra la ruta, alertas y API de la web): [seguimiento-viaje-api.md](seguimiento-viaje-api.md).
Requerimiento: `request/seguimiento-viaje.md`.

El conductor inicia el viaje (o acepta el que le asignó la empresa); el servidor le pide la
ubicación por push cada `intervaloMin` y al llegar a cada parada, y avisa al despachador de
desvíos, pedidos sin respuesta y auxilios. **Nada corre en segundo plano en el teléfono**: si no
responde, el pedido queda `sin_respuesta`. Solo el conductor (alcance `asignados`, con el
vehículo del manifiesto asignado hoy) inicia viajes; no necesita permiso nuevo.

Viaje:

```json
{
  "id": 9, "manifiestoId": 812, "manifiesto": "MT000812", "placa": "ABC123",
  "conductor": { "id": 34, "nombre": "Andrés" },
  "estado": "activo",
  "origen": "conductor",
  "asignadoEn": null, "iniciadoEn": "2026-11-02T08:00:00-05:00", "finalizadoEn": null, "motivoFin": null, "pausaMotivo": null,
  "intervaloMin": 30, "ventanaMin": 20, "tieneRuta": true,
  "paradas": [{ "nombre": "Bogotá", "eta": "2026-11-02T16:15:00-05:00" }],
  "proximoPedido": "2026-11-02T10:42:00-05:00",
  "pedidoAbierto": { "id": 55, "venceEn": "2026-11-02T10:32:00-05:00" },
  "ultimoReporte": { "capturadoEn": "2026-11-02T10:12:00-05:00", "estado": "en_ruta", "latitud": 4.61, "longitud": -74.08, "atrasoMin": 12, "bateria": 64 },
  "alertas": { "desvio": false, "sinRespuesta": 0, "auxilio": null, "llegada": null },
  "ultimosReportes": [{ "id": 301, "tipo": "pedido", "latitud": 4.61, "longitud": -74.08, "precisionMetros": 12, "bateria": 64, "capturadoEn": "…", "recibidoEn": "…", "estado": "en_ruta", "distanciaRutaKm": 0.3, "progresoKm": 182.4, "atrasoMin": 12 }]
}
```

`estado`: `asignado` → `activo` ⇄ `pausado` → `finalizado` (`motivoFin`: cumplido, anulado,
conductor, despachador o inactividad tras 24 h sin reportes); un asignado que no se acepta termina
`cancelado`.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/mobile/viajes/activo` | `{ viaje }`: el activo o pausado del usuario; si no, el asignado más reciente; `null` si no tiene |
| `GET` | `/mobile/manifiestos/{id}/viaje` | `{ viaje, esConductor, puedeIniciar, motivoNoDisponible, consentimientoVigente, versionConsentimiento }`. Mismo alcance que el detalle (`404`) |
| `POST` | `/mobile/seguimiento/consentimiento` | `{ version, dispositivo? }`. `version` debe ser la vigente (`400` si no) |
| `POST` | `/mobile/manifiestos/{id}/viaje/iniciar` | `{ reporte }` con la ubicación de inicio (formato de reporte; `viajeId` y `tipo` se ignoran). Crea el viaje o acepta el asignado; repetirlo devuelve el que está en curso. `409 CONFLICT` si no puede (motivo en `message`, p. ej. otro viaje en curso), `409 CONSENTIMIENTO_REQUERIDO` sin consentimiento |
| `POST` | `/mobile/viajes/{id}/pausar` | `{ motivo? }`. En un viaje asignado se avisa al despachador |
| `POST` | `/mobile/viajes/{id}/reanudar` | |
| `POST` | `/mobile/viajes/{id}/terminar` | `{ reporte? }`. Uno asignado sin iniciar queda `cancelado` |
| `POST` | `/mobile/viajes/reportes` | Lote (máx. 50) de `{ viajeId, pedidoId?, tipo, latitud, longitud, precisionMetros?, velocidadKmh?, rumbo?, bateria?, capturadoEn, idempotencyKey }` → `{ resultados: [{ idempotencyKey, estado, motivo? }] }` con `estado` `aceptado`, `duplicado` o `rechazado` |

`tipo` de reporte: `inicio`, `pedido` (responde el pedido abierto), `voluntario` ("Compartir
ubicación"), `oportunista` (la app se abrió durante el viaje), `auxilio` (alerta inmediata al
despachador) y `fin`. Un reporte responde el pedido que estaba abierto cuando se **capturó**, aunque
llegue tarde sin señal; el de un viaje ya terminado se acepta si se capturó antes del fin. Un
`rechazado` no se reintenta.

## P8 · Novedades del manifiesto

Detalle (catálogo, reglas, respuesta y API de la web): [novedades-api.md](novedades-api.md).
Requerimiento: `request/novedades-manifiesto.md`.

El conductor reporta lo que le pasa al viaje o a la carga, con fotos opcionales, la ubicación y
la hora del teléfono. Solo la web toma, anota y cierra la novedad. Los 7 tipos son fijos y cada
uno dice a qué trámite del RNDC equivale. Esta versión no envía nada al RNDC.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/mobile/catalogos/tipos-novedad` | `[{ codigo, nombre, ayuda, rndc: { tramite, codigo, descripcion }, requiereRemesa }]` |
| `POST` | `/mobile/novedades` | Permiso `novedades.reportar`. `multipart/form-data` con `manifiestoId`, `remesaId?`, `tipo`, `descripcion`, `latitud?`, `longitud?`, `precisionMetros?`, `capturadaEn?` y `fotos` (0 a 5). Header `Idempotency-Key` obligatorio. Responde `201`, o `200` con la misma novedad si la llave ya existía. Con el manifiesto cumplido o anulado, `422 MANIFIESTO_NO_ACTIVO`. Con una remesa de otro manifiesto, `422 REMESA_NO_PERTENECE`. Con un manifiesto que no ve, `404` |
| `GET` | `/mobile/novedades?vista=abiertas\|cerradas&manifiestoId=&page=&pageSize=` | Página. `abiertas` = `abierta` + `en_gestion` |
| `GET` | `/mobile/novedades/{id}` | Detalle con fotos e historial, sin las notas internas de la oficina |

Con alcance `todos` se ven todas. Con `asignados`, las que reportó el usuario y las de los
manifiestos que puede ver. Para la cola sin señal, un `400` o un `422` es un rechazo definitivo y
la novedad no se reintenta.

## Pendiente

Estos puntos necesitan tablas nuevas o decisiones de negocio:

- **Crear remesa y crear manifiesto** (`POST /mobile/remesas`, `/mobile/manifiestos`). El cumplido de remesa ya está (§P6). Hay que definir qué campos del formulario de la web pide la app, porque el RNDC exige muchos más que los de la propuesta: tiempos pactados, empaque, sede, etc. También falta guardar la `Idempotency-Key`, que necesita una tabla. Los permisos (`manifiestos.crear`, `remesas.crear`) ya existen.

Decisiones tomadas (no se implementan):
- **Vehículos de terceros:** no hay asignación automática al expedir el manifiesto. Cuando cambia el conductor, se reasigna el vehículo desde la web.
- **Login de conductores:** siempre por correo, sin login por documento ni por celular. Si un conductor no tiene correo, se le crea uno.
