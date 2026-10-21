# APIs que necesita la app móvil de Longistik

Este documento lista lo que la app móvil necesita del backend de cada empresa (Backlogistic API), ordenado por prioridad. Sirve para planear y construir los endpoints reales.

```
App móvil ──► Panel          GET /api/public/companies          ✅ listo
    │
    └──► Backend de la empresa ({apiUrl} de la empresa elegida)   este documento
```

**Cómo leerlo**
- **Firme**: la app ya tiene la pantalla construida y usa exactamente estos datos (hoy simulados o con supuestos).
- **Propuesta**: la pantalla aún no está construida. La ruta y los campos son un punto de partida y se ajustan cuando se implemente el diseño.
- Las rutas son sugeridas. **Si la web ya tiene un endpoint equivalente, mejor reutilizarlo** y documentarlo en Swagger (`{apiUrl}/docs`). La app solo necesita saber la ruta y la forma de la respuesta.

## Resumen

| Prioridad | Endpoint | Estado actual | Tipo |
|---|---|---|---|
| P0 | `POST /public/authentication/login` | Existe; falta documentar la respuesta y corregir el 500 | Firme |
| P0 | `GET /mobile/me` | No existe | Firme |
| P0 | `POST /public/authentication/forgot-password` | Existe; falta confirmar el comportamiento | Firme |
| P1 | `GET /mobile/home/summary` | No existe (la app usa datos fijos) | Firme |
| P2 | Manifiestos: listado y detalle | No existe | Propuesta |
| P2 | Remesas: listado, detalle y pendientes RNDC | No existe | Propuesta |
| P2 | Envío al RNDC y reporte RNDC | No existe | Propuesta |
| P3 | Crear manifiesto, crear remesa, cumplir remesa | No existe | Propuesta |
| P3 | Reportar novedad (con fotos) | No existe | Propuesta |
| P3 | Catálogos para formularios | No existe | Propuesta |
| P4 | Notificaciones y push | No existe | Propuesta |

---

## Convenciones para todos los endpoints

- **Base URL**: el `apiUrl` que entrega el panel para la empresa. La app nunca arma URLs a partir del `code`.
- **Autenticación**: `Authorization: Bearer <accessToken>` en todo lo que no esté bajo `/public`.
- **JSON** en request y response. Los nombres de campo van en `camelCase`.
- **Fechas**: ISO 8601 con zona horaria (`2026-10-20T14:30:00-05:00`). Un "día" se cuenta en hora de Colombia (`America/Bogota`).
- **Dinero**: número entero en pesos (COP), sin decimales.
- **Errores**: siempre `{ "statusCode": 400, "message": "Texto que se puede mostrar al usuario" }`. Si es un error de validación, se puede agregar `errors: { campo: "mensaje" }`.

| Código | Cuándo | Qué hace la app |
|---|---|---|
| `400` | Datos inválidos | Muestra `message` |
| `401` | Token ausente, vencido o inválido; credenciales incorrectas en el login | Cierra sesión y vuelve al login |
| `403` | Usuario inactivo o sin permiso para la acción | Muestra `message` |
| `404` | El recurso no existe | Muestra "No encontrado" |
| `409` | Conflicto (p. ej. una remesa ya cumplida) | Muestra `message` |
| `5xx` | Falla del servidor | Muestra "Intenta de nuevo" |

- **Paginación** (listados): `?page=1&pageSize=20`. La respuesta es `{ "items": [...], "page": 1, "pageSize": 20, "total": 134 }`.
- **Reintentos seguros**: en móvil la señal se cae a mitad de un envío. Los `POST` que crean registros deben aceptar el header `Idempotency-Key: <uuid>`. Si llega dos veces la misma llave, se responde el mismo resultado sin crear un duplicado.
- **CORS**: el backend de la empresa ya responde `Access-Control-Allow-Origin: *`; se debe mantener así. En el teléfono la app usa HTTP nativo, pero en desarrollo y en la web sí aplica CORS.

---

## P0 · Autenticación

### `POST /public/authentication/login` — Firme (existe, con ajustes)

Request (así lo envía hoy la app):

```json
{ "email": "andres@empresa.com", "password": "••••••" }
```

Respuesta `201` que necesita la app:

```json
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 2592000,
  "user": {
    "id": 34,
    "name": "Andrés",
    "lastName": "Rojas",
    "email": "andres@empresa.com",
    "role": "despachador"
  }
}
```

| Campo | Uso en la app |
|---|---|
| `accessToken` | Se guarda en el dispositivo y se envía como `Bearer` |
| `expiresIn` | Segundos de vida del token. Para móvil se recomienda una vida larga (p. ej. 30 días), para no pedir el login cada día |
| `user.name` + `user.lastName` | Saludo "Hola, Andrés" e iniciales del avatar |
| `user.role` | Mostrar u ocultar acciones (si hay roles distintos, p. ej. conductor y despachador) |

Ajustes pedidos:
1. **Hoy, con credenciales incorrectas, responde `500 Internal server error`.** Debe responder `401` con `{ "message": "Correo o contraseña incorrectos" }`. Con el 500 la app no puede distinguir una contraseña mala de un servidor caído.
2. Si el usuario está inactivo: `403` con `{ "message": "Tu usuario está inactivo. Contacta al administrador." }`.
3. **Documentar en Swagger la respuesta exitosa.** Hoy solo dice `201` sin cuerpo. Mientras tanto la app acepta el token como `accessToken`, `access_token` o `token`.
4. **Decidir si el login es solo por correo.** El diseño dice "Correo o usuario". Si también se acepta nombre de usuario, el campo debería llamarse `login` o `username`, o el backend debe aceptar ambos en `email`.

### `GET /mobile/me` — Firme

La app lo llama en cada arranque si hay una sesión guardada. Sirve para comprobar que el token sigue siendo válido (si no, responde `401` y la app cierra sesión) y para refrescar los datos del usuario.

```json
{
  "id": 34,
  "name": "Andrés",
  "lastName": "Rojas",
  "email": "andres@empresa.com",
  "role": "despachador",
  "status": true
}
```

> En Swagger existe `GET /public/authentication/access-token`, pero no está documentado qué hace. Si ese endpoint devuelve el usuario o renueva el token, indíquenlo y la app lo usa en vez de `/mobile/me`.

### `POST /public/authentication/forgot-password` — Firme (existe)

La app enviará `{ "email": "..." }` desde "¿Olvidaste tu contraseña?". Falta confirmar:
- Que responde **siempre `201`**, exista o no el correo, para no revelar qué correos están registrados.
- Que el enlace del correo abre la web de la empresa (`webUrl`), donde se usa `reset-password`. La app no implementará el cambio de contraseña dentro de la app.

### `POST /mobile/auth/logout` — Opcional

Invalida el token en el servidor y desvincula el token de push del dispositivo (ver P4). Si no existe, la app solo borra el token local.

---

## P1 · Inicio

### `GET /mobile/home/summary` — Firme

Reemplaza los datos fijos de la pantalla Inicio. Todos los valores son del **día actual en hora de Colombia**, salvo que se indique otro alcance.

```json
{
  "date": "2026-10-20",
  "remesasHoy": 9,
  "manifiestosDespachadosHoy": 4,
  "remesasPendientesRndc": 3,
  "rndc": { "reportadas": 149, "total": 152 },
  "manifiestosActivos": 6,
  "notificacionesSinLeer": 2
}
```

| Campo | Dónde se ve | A definir |
|---|---|---|
| `remesasHoy` | "9 remesas" (Operación de hoy) | ¿Del usuario o de toda la empresa? ¿Creadas hoy o con fecha de cargue hoy? |
| `manifiestosDespachadosHoy` | "4 manifiestos despachados · 20 de octubre" | Qué estado cuenta como "despachado" |
| `remesasPendientesRndc` | "Tienes 3 remesas pendientes por enviar al RNDC" | Remesas sin reportar o con error de reporte |
| `rndc.reportadas` / `rndc.total` | "149 de 152 remesas reportadas" y la barra de progreso | ¿Período del mes, de la semana o histórico? |
| `manifiestosActivos` | Fila "Mis manifiestos activos" (para mostrar un contador) | Qué estados cuentan como activos |
| `notificacionesSinLeer` | Punto en la campana | Si es `0`, el punto no se muestra |

---

## P2 · Consultas (pestañas Manifiestos y Remesas) — Propuesta

Estados que la app ya tiene definidos visualmente (vienen del sistema visual). El backend debe usar estos mismos valores:
- **Estado operativo:** `creada`, `manifiesto`, `en_ruta`, `cumplido`, `activo`, `inactivo`.
- **Estado RNDC:** `reportado`, `pendiente`, `error`.

### Manifiestos

`GET /mobile/manifiestos?estado=activo&mine=true&q=ABC123&page=1&pageSize=20`

- `mine=true`: solo los del usuario (para "Mis manifiestos activos").
- `q`: búsqueda por número de manifiesto, placa o conductor.

```json
{
  "items": [
    {
      "id": 812,
      "numero": "MAN-000812",
      "consecutivoRndc": "123456789",
      "fechaExpedicion": "2026-10-20T07:10:00-05:00",
      "estado": "en_ruta",
      "estadoRndc": "reportado",
      "placa": "ABC123",
      "conductor": { "id": 7, "nombre": "Carlos Pérez" },
      "origen": { "codigoDane": "76001000", "nombre": "Cali, Valle del Cauca" },
      "destino": { "codigoDane": "11001000", "nombre": "Bogotá, D.C." },
      "remesas": 3,
      "valorFlete": 3200000
    }
  ],
  "page": 1, "pageSize": 20, "total": 6
}
```

`GET /mobile/manifiestos/{id}` devuelve lo mismo que un item del listado y además:
- `remesas`: un arreglo con el resumen de cada remesa, en lugar del contador.
- `novedades`: el listado de novedades del manifiesto.
- `rndcError`: el texto del rechazo, solo si `estadoRndc = error`.

### Remesas

`GET /mobile/remesas?estado=&estadoRndc=pendiente&manifiestoId=&q=&page=1&pageSize=20`

```json
{
  "items": [
    {
      "id": 4501,
      "numero": "REM-004501",
      "consecutivoRndc": "987654321",
      "fecha": "2026-10-20T08:00:00-05:00",
      "estado": "manifiesto",
      "estadoRndc": "pendiente",
      "manifiestoId": 812,
      "cliente": { "id": 15, "nombre": "Distribuidora XYZ S.A.S." },
      "origen": { "codigoDane": "76001000", "nombre": "Cali, Valle del Cauca" },
      "destino": { "codigoDane": "11001000", "nombre": "Bogotá, D.C." },
      "producto": "Abarrotes",
      "cantidad": 120,
      "pesoKg": 8500
    }
  ],
  "page": 1, "pageSize": 20, "total": 3
}
```

`GET /mobile/remesas/{id}`: el detalle, con `rndcError` si aplica.

### Envío y reporte RNDC

- `POST /mobile/rndc/enviar` con `{ "remesaIds": [4501, 4502] }`: lo usa el botón "Revisar y enviar". Responde el resultado de cada remesa:

```json
{
  "resultados": [
    { "remesaId": 4501, "estadoRndc": "reportado", "consecutivoRndc": "987654321" },
    { "remesaId": 4502, "estadoRndc": "error", "mensaje": "Placa no registrada en el RUNT" }
  ]
}
```

  Si el envío al RNDC es asíncrono (en cola), responder `202` y que los listados muestren `pendiente` hasta que termine.
- `GET /mobile/rndc/reporte?desde=2026-10-01&hasta=2026-10-31`: el detalle de "Reporte RNDC". Devuelve los totales por estado (`reportado`, `pendiente`, `error`) y el listado de las remesas con error.

---

## P3 · Acciones (botones rápidos de Inicio) — Propuesta

Todos estos `POST` llevan `Idempotency-Key`. Los campos exactos dependen de los diseños de cada pantalla, que aún no están construidos. Lo de abajo es el mínimo que exige el RNDC y debe validarse con quien conoce la operación.

### Nueva remesa — `POST /mobile/remesas`

```json
{
  "clienteId": 15,
  "origenDane": "76001000",
  "destinoDane": "11001000",
  "productoId": 6,
  "cantidad": 120,
  "unidad": "unidades",
  "pesoKg": 8500,
  "valorDeclarado": 45000000,
  "remitente": { "documento": "900123456", "nombre": "...", "direccion": "...", "telefono": "..." },
  "destinatario": { "documento": "800987654", "nombre": "...", "direccion": "...", "telefono": "..." },
  "observaciones": ""
}
```

Responde `201` con la remesa creada (igual que el detalle).

### Nuevo manifiesto — `POST /mobile/manifiestos`

```json
{
  "placa": "ABC123",
  "conductorId": 7,
  "remesaIds": [4501, 4502],
  "origenDane": "76001000",
  "destinoDane": "11001000",
  "fechaSalida": "2026-10-20T09:00:00-05:00",
  "valorFlete": 3200000,
  "anticipo": 1000000
}
```

### Cumplir remesa — `POST /mobile/remesas/{id}/cumplido`

```json
{
  "fechaEntrega": "2026-10-21T15:20:00-05:00",
  "cantidadEntregada": 120,
  "recibidoPor": { "nombre": "...", "documento": "..." },
  "observaciones": "",
  "soportes": ["upl_8f2a..."]
}
```

Si la remesa ya está cumplida, responde `409`.

### Reportar novedad — `POST /mobile/novedades`

```json
{
  "manifiestoId": 812,
  "remesaId": null,
  "tipoNovedadId": 3,
  "descripcion": "Vía cerrada por derrumbe en el km 45",
  "fechaHora": "2026-10-20T11:05:00-05:00",
  "ubicacion": { "lat": 3.9012, "lng": -76.2987 },
  "fotos": ["upl_1a2b...", "upl_3c4d..."]
}
```

`GET /mobile/novedades?manifiestoId=&page=`: listado para la pestaña Novedades.

### Subida de archivos — `POST /mobile/uploads`

`multipart/form-data` con el campo `file` (imágenes JPG o PNG de hasta 10 MB, o PDF). Responde `{ "id": "upl_8f2a...", "url": "..." }`. La app sube primero cada foto y luego envía los `id` en `soportes` o `fotos`. Así un envío con fotos no se pierde completo si la conexión falla a mitad.

### Catálogos para los formularios

Todos los catálogos aceptan `?q=` para buscar y devuelven `[{ "id", "nombre", ... }]` sin paginar si son pequeños.

| Endpoint | Para |
|---|---|
| `GET /mobile/catalogos/clientes?q=` | Remesa |
| `GET /mobile/catalogos/productos?q=` | Remesa |
| `GET /mobile/catalogos/municipios?q=` | Origen y destino, con código DANE |
| `GET /mobile/catalogos/vehiculos?q=` | Manifiesto (placa) |
| `GET /mobile/catalogos/conductores?q=` | Manifiesto |
| `GET /mobile/catalogos/tipos-novedad` | Novedad |

---

## P4 · Notificaciones — Propuesta

- `GET /mobile/notificaciones?page=`: lista con `{ id, titulo, mensaje, fecha, leida, link }`. `link` es opcional y lleva a una pantalla, p. ej. `{ "tipo": "remesa", "id": 4502 }`.
- `POST /mobile/notificaciones/{id}/leida` y `POST /mobile/notificaciones/leidas` (marcar todas).
- `POST /mobile/dispositivos` con `{ "pushToken": "...", "plataforma": "android" | "ios" }`: registra el teléfono para recibir notificaciones push (p. ej. "remesa rechazada por el RNDC"). En el logout se desregistra.

---

## Preguntas abiertas para el equipo backend

1. ¿Qué devuelve hoy el login exitoso? Basta con un ejemplo con el token recortado.
2. ¿Qué hace `GET /public/authentication/access-token`?
3. ¿El login es solo por correo, o también por nombre de usuario?
4. ¿Hay roles distintos (conductor, despachador, administrador) que cambien lo que ve cada usuario en la app?
5. Los números de Inicio, ¿son del usuario o de toda la empresa? ¿Qué período cubre el "Reporte RNDC"?
6. ¿El envío al RNDC es inmediato o pasa por una cola?
7. ¿La web ya tiene endpoints para manifiestos, remesas y novedades que se puedan reutilizar?

## Cómo probar la parte que ya existe

```bash
# Empresas activas (panel)
curl -s https://api.panel.longistik.com/api/public/companies

# Login contra el backend de la empresa (usar el apiUrl que devuelve el panel)
curl -s -X POST https://api.servicargas360.longistik.com/public/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@empresa.com","password":"••••"}'
```
