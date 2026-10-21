# API de la app móvil

Implementa P0, P1 y P2 de [request/mobile-app-api-requirements.md](../request/mobile-app-api-requirements.md), los catálogos de P3 y la fase 1 de [request/mobile-vehicle-assignment-api.md](../request/mobile-vehicle-assignment-api.md) (permisos por rol y asignación de vehículos). Código en `src/mobile/`. Todo aparece en Swagger (`{apiUrl}/docs`, etiqueta **Mobile**). La administración web de las asignaciones está en [vehicle-assignment-api.md](vehicle-assignment-api.md).

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
| `vehiculos.asignar` | `/vehicle-assignments` · crear (web) |

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
- `novedades`: `[]` por ahora.
- `rndcError`.

Responde `404` si no existe o si el usuario no lo puede ver.

### `GET /mobile/remesas`

Filtros: `estado` (`creada` | `manifiesto` | `en_ruta` | `cumplido` | `inactivo`), `estadoRndc`, `manifiestoId`, `q` (número, consecutivo RNDC, nombre o documento del cliente), `page` y `pageSize`.

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

## Pendiente

Estos puntos necesitan tablas nuevas o decisiones de negocio:

- **Crear remesa, crear manifiesto y cumplir remesa** (`POST /mobile/remesas`, `/mobile/manifiestos`, `/mobile/remesas/{id}/cumplido`). Hay que definir qué campos del formulario de la web pide la app, porque el RNDC exige muchos más que los de la propuesta: tiempos pactados, empaque, sede, etc. También falta guardar la `Idempotency-Key`, que necesita una tabla. Los permisos (`manifiestos.crear`, `remesas.crear`, `remesas.cumplir`) ya existen.
- **Novedades y subida de archivos**: no hay tabla de novedades ni catálogo de tipos de novedad (`/mobile/catalogos/tipos-novedad`). El permiso `novedades.reportar` ya existe.
- **Notificaciones y push (P4)**: hacen falta tablas de notificaciones y de dispositivos, y un proveedor de push.
- **Asignación automática al expedir** (vehículos de terceros) y **login por documento o celular**: están en las preguntas abiertas 3 y 4 de `mobile-vehicle-assignment-api.md`.
