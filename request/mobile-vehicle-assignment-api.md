# Asignación de vehículos a usuarios y permisos en la app móvil

Hoy, todo usuario que entra a la app ve los datos de **toda la empresa**: manifiestos, remesas y cifras de Inicio. Este documento define cómo limitar lo que ve y hace cada usuario:

- **Asignando vehículos a usuarios**: el usuario ve los manifiestos de sus vehículos.
- **Dando permisos por rol**: el rol decide si el usuario ve todo o solo lo asignado, y qué acciones puede hacer.

Complementa a [mobile-api.md](mobile-api.md): cambia el comportamiento de endpoints que ya existen y agrega los de administración.

**Alcance**
- Backend: tablas, permisos y filtros en todos los endpoints `/mobile`.
- Web: pantallas para asignar vehículos y configurar los permisos de cada rol.
- App móvil: se ajusta cuando esto esté listo (ver la sección "Cambios en la app").

---

## 1. Reglas de negocio

### 1.1 Permisos

El rol del usuario define sus permisos. Si la web ya tiene un sistema de permisos, se reutiliza agregando estos códigos.

| Permiso | Qué permite |
|---|---|
| `manifiestos.ver_todos` | Ver todos los manifiestos y remesas de la empresa |
| `manifiestos.ver_asignados` | Ver solo los manifiestos de los vehículos asignados (ver 1.3) |
| `manifiestos.crear` | Crear manifiestos |
| `remesas.crear` | Crear remesas |
| `remesas.cumplir` | Registrar el cumplido de remesas y manifiestos que el usuario puede ver |
| `novedades.reportar` | Reportar novedades sobre manifiestos que el usuario puede ver |
| `rndc.enviar` | Enviar remesas al RNDC ("Revisar y enviar") |
| `vehiculos.asignar` | (Web) Asignar y desasignar vehículos a usuarios |
| `app.acceso` | Iniciar sesión en la app móvil |

- Si un rol tiene `ver_todos` y `ver_asignados`, gana `ver_todos`.
- Sin ninguno de los dos, el usuario no ve manifiestos (la app muestra un estado vacío).
- Sin `app.acceso`, `POST /mobile/auth/login` responde `403` con `code: "APP_ACCESS_DENIED"`.

### 1.2 Roles iniciales (sugeridos)

Cada empresa podrá ajustarlos desde la web. Estos son los valores con que se crean.

| Rol | Permisos |
|---|---|
| Administrador | Todos |
| Despachador | `app.acceso`, `manifiestos.ver_todos`, `manifiestos.crear`, `remesas.crear`, `remesas.cumplir`, `novedades.reportar`, `rndc.enviar` |
| Conductor | `app.acceso`, `manifiestos.ver_asignados`, `remesas.cumplir`, `novedades.reportar` |
| Supervisor de flota | `app.acceso`, `manifiestos.ver_asignados`, `novedades.reportar` |

> Los usuarios que ya existen y tienen un rol de texto libre deben quedar mapeados a uno de estos roles en la migración (ver 6).

### 1.3 Cuándo un usuario con `ver_asignados` puede ver un manifiesto

Un manifiesto **M**, con vehículo **V** y fecha de expedición **F**, es visible para el usuario **U** si existe una asignación activa de U al vehículo V (`deletedAt` nulo) que cumpla **alguna** de estas condiciones:

1. **F está dentro de la vigencia de la asignación**: `desde <= F` y (`hasta` es nulo o `F <= hasta`).
2. **M está activo** (abierto y no anulado) **y la asignación está vigente hoy**. Así, si un vehículo se reasigna en medio de un viaje, el nuevo responsable ve el viaje en curso.

Consecuencias:
- Un usuario **no** ve los manifiestos que el vehículo tuvo antes de que se lo asignaran, salvo el que esté en curso.
- Cuando una asignación termina (`hasta`), el usuario sigue viendo los manifiestos expedidos durante su vigencia, como historial. Si no se quiere eso, se agrega la regla "solo asignaciones vigentes hoy" (ver Preguntas abiertas).

**Remesas visibles**: las remesas cuyo manifiesto vigente es visible. Las remesas sin manifiesto solo se ven con `ver_todos`.

### 1.4 Reglas de la asignación

- Un vehículo puede estar asignado a **varios usuarios a la vez** (p. ej. un conductor y un supervisor).
- Un usuario puede tener **varios vehículos**.
- La misma pareja usuario–vehículo **no puede tener vigencias que se crucen**. Si se cruzan, responde `409`.
- Solo se pueden asignar vehículos **activos**, y solo a usuarios **activos** que tengan `ver_asignados`.
- Desasignar = poner `hasta`. **No se borran registros**, para conservar el historial y la auditoría. Solo se borra lógicamente (`deletedAt`) una asignación creada por error que todavía no ha empezado.
- Toda creación, modificación o fin de una asignación queda registrada con usuario y fecha (ver 2.1).

### 1.5 Acciones sobre un manifiesto

Para cumplir, reportar novedades o enviar al RNDC, el usuario necesita **el permiso de la acción** y además **poder ver** el manifiesto o la remesa según 1.3. Si le falta cualquiera de los dos, la acción se rechaza (ver 4).

---

## 2. Cambios en la base de datos

### 2.1 Tabla nueva `usuario_vehiculo`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | PK | |
| `userId` | FK → `users` | |
| `vehiculoId` | FK → vehículos | |
| `desde` | fecha y hora | Obligatoria; por defecto, ahora |
| `hasta` | fecha y hora, nula | Nula = sin fecha de fin |
| `asignadoPor` | FK → `users` | Quién creó la asignación |
| `finalizadoPor` | FK → `users`, nula | Quién puso `hasta` |
| `observacion` | texto, nula | |
| `createdAt` / `updatedAt` / `deletedAt` | | `deletedAt` solo para registros creados por error |

Índices: (`userId`, `desde`, `hasta`) y (`vehiculoId`, `desde`, `hasta`).

### 2.2 Permisos

- Tabla `permisos` (`codigo`, `descripcion`) con los códigos de 1.1.
- Tabla `rol_permisos` (`rolId`, `permisoCodigo`).
- Seed con los roles de 1.2.

### 2.3 Manifiesto

- Confirmar que el manifiesto guarda su **`vehiculoId`**. El filtro depende de esto.
- Agregar **`conductorId`**, guardado al expedir el manifiesto. Hoy el conductor se calcula a partir del vehículo, así que un cambio de conductor reescribe los manifiestos anteriores. El RNDC ya exige el conductor en el manifiesto, así que el dato existe al expedirlo.
- Agregar **`createdBy`** en manifiestos y remesas, para la auditoría y para un futuro "creados por mí".

---

## 3. Endpoints

### 3.1 Web: administración de asignaciones (permiso `vehiculos.asignar`)

Las rutas son sugeridas; se pueden adaptar a las convenciones de la web.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/vehiculos/{id}/asignaciones?vigentes=true` | Usuarios asignados al vehículo |
| `GET` | `/usuarios/{id}/vehiculos?vigentes=true` | Vehículos asignados al usuario |
| `POST` | `/asignaciones-vehiculo` | Crear una asignación |
| `PATCH` | `/asignaciones-vehiculo/{id}` | Cambiar `hasta` u `observacion` (finalizar) |
| `DELETE` | `/asignaciones-vehiculo/{id}` | Solo para registros creados por error que aún no han empezado |

`POST /asignaciones-vehiculo`

```json
{ "userId": 34, "vehiculoId": 12, "desde": "2026-10-21T00:00:00-05:00", "hasta": null, "observacion": "Conductor fijo" }
```

Responde `201`:

```json
{
  "id": 501,
  "user": { "id": 34, "nombre": "Andrés Rojas" },
  "vehiculo": { "id": 12, "placa": "ABC123" },
  "desde": "2026-10-21T00:00:00-05:00",
  "hasta": null,
  "asignadoPor": { "id": 2, "nombre": "Laura Gómez" }
}
```

Errores:
- `400`: `hasta` es anterior a `desde`.
- `404`: el usuario o el vehículo no existe.
- `409`: hay un cruce de vigencias, o el vehículo o el usuario están inactivos.
- `422`: el usuario no tiene `ver_asignados`.

**Pantallas web sugeridas**
- En el **detalle del vehículo**: una pestaña "Usuarios asignados" con el historial y los botones "Asignar" y "Finalizar".
- En el **detalle del usuario**: una pestaña "Vehículos asignados".
- En **roles**: la matriz de permisos de 1.1.

### 3.2 Móvil: `GET /mobile/me` (cambio)

Agrega `permisos`, `alcance` y los vehículos vigentes, para que la app muestre u oculte acciones:

```json
{
  "id": 34,
  "name": "Andrés",
  "lastName": "Rojas",
  "email": "andres@empresa.com",
  "role": "Conductor",
  "status": true,
  "alcance": "asignados",
  "permisos": ["app.acceso", "manifiestos.ver_asignados", "remesas.cumplir", "novedades.reportar"],
  "vehiculos": [
    { "id": 12, "placa": "ABC123", "desde": "2026-10-21T00:00:00-05:00", "hasta": null }
  ]
}
```

- `alcance` puede ser `"todos"`, `"asignados"` o `"ninguno"` (ver 1.1).
- `POST /mobile/auth/login` debe devolver estos mismos campos dentro de `user`.

### 3.3 Móvil: el alcance se aplica en todos los endpoints

**El filtro se aplica siempre en el servidor.** No basta con ocultar cosas en la app, porque cualquiera puede pedir un ID a mano.

| Endpoint | Con `alcance = "asignados"` |
|---|---|
| `GET /mobile/home/summary` | Todas las cifras se calculan solo sobre los manifiestos y remesas visibles (1.3). `remesasHoy` = remesas visibles creadas hoy |
| `GET /mobile/manifiestos` | Solo manifiestos visibles. Filtro nuevo `vehiculoId`, que debe ser uno de sus vehículos o responde `404`. El filtro `mine` deja de tener efecto |
| `GET /mobile/manifiestos/{id}` | `404` si no es visible, sin revelar que existe |
| `GET /mobile/remesas` y `/{id}` | Solo remesas visibles; `404` en el detalle si no lo es |
| `POST /mobile/rndc/enviar` | Requiere `rndc.enviar`. Una remesa no visible vuelve en `resultados` con `estadoRndc: "error"` y `mensaje: "Remesa no encontrada"` |
| `GET /mobile/rndc/reporte` | Totales y errores solo de las remesas visibles |
| `GET /mobile/catalogos/vehiculos` | Solo sus vehículos vigentes |
| `GET /mobile/catalogos/conductores`, `/clientes`, `/productos` | Requieren `manifiestos.crear` o `remesas.crear`; sin eso responden `403` con `code: "FORBIDDEN"` |
| Cumplido y novedades (cuando existan) | Requieren el permiso de la acción y que el manifiesto o la remesa sea visible |

Con `alcance = "ninguno"`, los listados responden vacíos y el resumen responde en cero. No es un error.

---

## 4. Errores: separar "usuario inactivo" de "sin permiso"

Hoy la app **cierra la sesión ante cualquier `403`**, porque [mobile-api.md](mobile-api.md) usa el `403` solo para "usuario desactivado". Con los permisos aparece un `403` nuevo ("no tienes permiso para esta acción"), que **no** debe cerrar la sesión. Por eso todos los errores `401` y `403` deben llevar un `code`:

| HTTP | `code` | Cuándo | Qué hace la app |
|---|---|---|---|
| `401` | `TOKEN_INVALID` | Token vencido o inválido, o usuario borrado | Cierra la sesión |
| `403` | `USER_INACTIVE` | Usuario desactivado | Cierra la sesión y muestra `message` |
| `403` | `APP_ACCESS_DENIED` | El rol no tiene `app.acceso` | Cierra la sesión y muestra `message` |
| `403` | `FORBIDDEN` | Falta el permiso de la acción | Muestra `message`, **sin** cerrar la sesión |
| `404` | `NOT_FOUND` | El recurso no existe **o no es visible** para el usuario | Muestra "No encontrado" |
| `409` | `CONFLICT` | Cruce de vigencias, remesa ya cumplida, etc. | Muestra `message` |

```json
{ "statusCode": 403, "code": "FORBIDDEN", "message": "No tienes permiso para enviar remesas al RNDC." }
```

---

## 5. Cambios en la app (a cargo del equipo móvil, después de esto)

- Cerrar la sesión solo con `401`, `USER_INACTIVE` y `APP_ACCESS_DENIED`.
- Mostrar u ocultar las acciones de Inicio según `permisos`:
  - "Nuevo manifiesto" requiere `manifiestos.crear`.
  - "Nueva remesa" requiere `remesas.crear`.
  - "Cumplir remesa" requiere `remesas.cumplir`.
  - "Reportar novedad" requiere `novedades.reportar`.
  - "Revisar y enviar" requiere `rndc.enviar`.
- Con `alcance = "ninguno"`, o con `"asignados"` pero sin vehículos, mostrar un estado vacío: "No tienes vehículos asignados. Pídele a tu administrador que te asigne uno."
- Lista de manifiestos con un filtro por vehículo cuando el usuario tenga más de uno.
- Refrescar `/mobile/me` al volver a la app, para que una asignación nueva aparezca sin cerrar la sesión.

---

## 6. Migración

1. Crear las tablas `permisos`, `rol_permisos` y `usuario_vehiculo`, y las columnas `conductorId` y `createdBy` del manifiesto (y `createdBy` en remesas).
2. Crear los roles de 1.2 con sus permisos.
3. Asignar un rol a cada usuario existente:
   - A los usuarios web actuales, por defecto **Despachador**, para que nadie pierda acceso.
   - Los conductores que necesiten la app se crean o cambian a **Conductor**.
4. Llenar `conductorId` en los manifiestos existentes con el conductor actual del vehículo. Es la mejor aproximación disponible, y desde ese momento cada manifiesto nuevo guarda el suyo.
5. Desplegar los filtros de 3.3 **junto con** el `code` en los errores (4) y avisar al equipo móvil antes, para no cerrar sesiones por error.

---

## 7. Casos de prueba (criterios de aceptación)

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | Conductor con ABC123 asignado desde hoy; ABC123 tiene un manifiesto de ayer ya cerrado | No lo ve |
| 2 | Igual que el caso 1, pero el manifiesto de ayer sigue activo | Lo ve (regla 1.3.2) |
| 3 | Conductor con ABC123 del 1 al 10 de octubre; manifiesto del 5 de octubre | Lo ve como historial |
| 4 | Conductor pide `GET /mobile/manifiestos/{id}` de otro vehículo | `404` |
| 5 | Conductor llama a `POST /mobile/rndc/enviar` | `403 FORBIDDEN`; la app no cierra la sesión |
| 6 | ABC123 asignado a un conductor y a un supervisor | Los dos ven sus manifiestos |
| 7 | Se crea una asignación que se cruza con otra de la misma pareja | `409` |
| 8 | Despachador | Ve todo, igual que hoy |
| 9 | Conductor sin vehículos | Listas vacías, resumen en cero, `alcance: "asignados"` y `vehiculos: []` |
| 10 | Se finaliza la asignación mientras el conductor tiene la app abierta | En la siguiente petición deja de ver los manifiestos activos de ese vehículo; mantiene el historial de su vigencia |
| 11 | Inicio de un conductor | Las cifras solo cuentan sus manifiestos y remesas visibles |
| 12 | Usuario desactivado | `403 USER_INACTIVE`; la app cierra la sesión |

---

## Preguntas abiertas

1. Al terminar una asignación, ¿el usuario conserva el historial de lo que se expidió durante su vigencia, como propone 1.3, o pierde todo acceso a ese vehículo?
2. ¿El **Supervisor de flota** puede cumplir remesas, o solo consultar?
3. **Vehículos de terceros**: si el conductor cambia en cada viaje, alguien tiene que reasignar el vehículo antes de cada despacho. ¿Lo hace el despachador al expedir el manifiesto? Una opción es crear la asignación automáticamente con el conductor del manifiesto, pero eso exige vincular usuarios con conductores (`users.personalId`).
4. **Login de conductores**: hoy es solo por correo. ¿Los conductores tienen correo, o se agrega login por documento o celular?
5. ¿La web ya tiene un sistema de permisos que se pueda reutilizar en lugar de las tablas de 2.2?
