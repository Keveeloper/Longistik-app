# Requerimiento app móvil — Solicitud de sobreanticipos

**Estado del backend:** ✅ APIs listas (01/11/2026). Contrato técnico completo en
`docs/mobile-api.md` §P5. Falta construir las pantallas en la app.

**Para quién:** equipo de la app móvil de Longistik.

---

## 1. Contexto

Durante un viaje el conductor a veces necesita más dinero del anticipo que recibió: una varada,
una reparación, peajes o combustible extra. Ese dinero adicional es el **sobreanticipo**: se le
entrega al **titular del manifiesto** (el propietario del vehículo) y se reporta al Ministerio
de Transporte (RNDC) en el cumplido del manifiesto.

Hoy el conductor lo pide por teléfono o WhatsApp y nadie deja registro. Con esta función:

1. El conductor (o el despachador) **solicita** el sobreanticipo desde la app, con el motivo y,
   si tiene, una foto del soporte.
2. Un aprobador de la empresa recibe un correo, lo **aprueba** (puede ser por menos) o lo
   **rechaza** desde la web.
3. Tesorería lo **paga** desde la web. El pago queda en la liquidación del manifiesto y sale en
   el cumplido que se reporta al RNDC.
4. El conductor ve en la app el estado de su solicitud.

**La app solo solicita y cancela las propias.** Aprobar y pagar no se hacen en la app.

---

## 2. Permiso

Permiso nuevo en la matriz de roles: **`sobreanticipos.solicitar`** (módulo *App móvil:
sobreanticipos*). Llega en `GET /mobile/me` junto con los demás permisos.

Por defecto lo tienen los roles **Conductor**, el perfil de **despachador** y los
**Administradores**. El Supervisor de flota no lo tiene; cada empresa lo ajusta en la web.

Sin el permiso, la app **no muestra** nada de sobreanticipos (ni el botón ni la pantalla "Mis
solicitudes").

---

## 3. Pantallas

### 3.1 Detalle del manifiesto: sección "Sobreanticipos"

En el detalle del manifiesto que ya existe, agregar una sección **"Sobreanticipos"**.

- Cargar `GET /mobile/manifiestos/{id}/sobreanticipos` al abrir el detalle.
- Mostrar la lista de solicitudes del manifiesto (las de todos, no solo las propias), cada una
  con: valor, motivo, estado (chip de color), fecha y, si aplica, valor aprobado y notas.
- Botón **"Solicitar sobreanticipo"**:
  - Visible con el permiso `sobreanticipos.solicitar`.
  - Habilitado solo si `puedeSolicitar` es `true`.
  - Si `puedeSolicitar` es `false`, deshabilitado y con el texto de `motivoNoDisponible` debajo
    (ej. *"El manifiesto ya tiene el cumplido: no admite más sobreanticipos."*).
- Mostrar **"Disponible: $ 1.122.500"** (`disponible`) como ayuda.

Colores del estado (los mismos de la web):

| `estado` | Texto | Color |
|---|---|---|
| `solicitada` | Pendiente de aprobación | Azul |
| `aprobada` | Aprobada — por pagar | Ámbar |
| `rechazada` | Rechazada | Rojo |
| `pagada` | Pagada | Verde |
| `cancelada` | Cancelada | Gris |

### 3.2 Formulario "Solicitar sobreanticipo"

| Campo | Control | Obligatorio | Validación en la app |
|---|---|---|---|
| Valor | Numérico en pesos, sin decimales | ✅ | Mayor que 0. Ayuda: "Disponible: $ X" |
| Motivo | Lista de `GET /mobile/catalogos/motivos-sobreanticipo` | ✅ | — |
| Descripción | Texto (máx. 500) | Solo si el motivo tiene `requiereDescripcion: true` | Mínimo 5 caracteres en ese caso |
| Soporte | Foto | ❌ | Ver nota |

> **Soporte:** el backend recibe una URL (`soporte`). Mientras no exista la subida de archivos
> de la app (llega con *novedades*), el campo se puede omitir o usar el servicio de archivos
> que ya tenga la app.

Al enviar: `POST /mobile/manifiestos/{id}/sobreanticipos`.

- **OK (`201`)**: mostrar `mensaje` (*"…queda pendiente de aprobación."*), cerrar el formulario y
  recargar la sección. Si `alertaTope` trae texto, mostrarlo como aviso ámbar: se registró, pero
  supera el tope interno de la empresa.
- **Error**: mostrar `message` en el formulario, sin cerrarlo. Con `400` y `errors`, marcar el
  campo que falla.

| `code` | Qué mostrar |
|---|---|
| `BAD_REQUEST` | El error junto al campo (`errors`) |
| `SALDO_NEGATIVO` | `message` (dice cuánto está disponible); sugerir bajar el valor |
| `SOBREANTICIPO_TOPE` | `message` (dice cuánto está disponible por el tope) |
| `CONFLICT` | `message` y recargar el detalle (el manifiesto cambió: se cumplió o anuló) |
| `NOT_FOUND` | "No encontrado" y volver al listado |
| `FORBIDDEN` | `message`, sin cerrar la sesión |

**No reintentar automáticamente** un `POST` que falló por red sin consultar antes la lista:
la solicitud pudo haberse creado.

### 3.3 "Mis solicitudes"

Opción en el menú (o pestaña en Inicio), visible con el permiso.

- `GET /mobile/sobreanticipos?estado=&page=&pageSize=` (paginado como los demás listados).
- Filtro por estado (chips: Todas / Pendientes / Aprobadas / Pagadas / Rechazadas).
- Cada fila: manifiesto y placa, valor (y aprobado si es distinto), motivo, estado y fecha.
- Al tocar una fila, abrir el detalle del manifiesto en la sección de sobreanticipos.
- Acción **"Cancelar"** en las propias que estén `solicitada`, o `aprobada` todavía sin pagar:
  `POST /mobile/sobreanticipos/{id}/cancelar` con notas opcionales y confirmación previa. Un
  `409 CONFLICT` significa que ya cambió de estado: mostrar `message` y recargar.

### 3.4 Avisos (sin push por ahora)

El backend manda **correo** al aprobador cuando llega una solicitud, y al solicitante cuando se
aprueba o se rechaza. Todavía **no hay push** (llega con la P4 de notificaciones): la app debe
refrescar la lista al abrir la pantalla y con *pull to refresh*.

---

## 4. Reglas que la app debe conocer

Las aplica el backend; la app solo las explica al usuario.

- Solo se puede pedir en manifiestos **aceptados por el RNDC**, **sin cumplido** y **no
  anulados**.
- El valor no puede dejar negativo el saldo que se le debe al titular. Lo aprobado y todavía sin
  pagar de otras solicitudes ya cuenta.
- La empresa puede tener un **tope** de sobreanticipos (porcentaje del flete): en modo aviso se
  registra con alerta; en modo bloqueo se rechaza.
- Una solicitud **pendiente no aparta saldo**: dos solicitudes pendientes pueden sumar más que el
  disponible. La segunda puede fallar al aprobarse.
- Cuando el manifiesto se cumple, las solicitudes pendientes se **cancelan solas**.
- Quien solicita no puede aprobar su propia solicitud (eso igual es solo en la web).

---

## 5. Endpoints (resumen)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| `GET` | `/mobile/catalogos/motivos-sobreanticipo` | `sobreanticipos.solicitar` | Lista de motivos |
| `GET` | `/mobile/manifiestos/{id}/sobreanticipos` | (ver el manifiesto) | Sección del detalle |
| `POST` | `/mobile/manifiestos/{id}/sobreanticipos` | `sobreanticipos.solicitar` | Solicitar |
| `GET` | `/mobile/sobreanticipos` | `sobreanticipos.solicitar` | Mis solicitudes |
| `POST` | `/mobile/sobreanticipos/{id}/cancelar` | `sobreanticipos.solicitar` | Cancelar una propia |

Formatos, ejemplos y errores: `docs/mobile-api.md` §P5.

---

## 6. Criterios de aceptación

1. Un usuario sin `sobreanticipos.solicitar` no ve la sección, el botón ni "Mis solicitudes".
2. Un conductor ve la sección solo en los manifiestos de sus vehículos asignados. Otro
   manifiesto responde `404` y la app lo trata como "No encontrado".
3. En un manifiesto cumplido, el botón aparece deshabilitado con el motivo.
4. Solicitar 350.000 por *Varada*: aparece *Pendiente de aprobación* en la sección y en "Mis
   solicitudes", y el aprobador recibe el correo.
5. Con motivo *Otro* sin descripción, el campo Descripción muestra el error y no se envía nada.
6. Pedir más del disponible muestra el mensaje con el disponible (`SALDO_NEGATIVO`).
7. Cuando el aprobador aprueba por 300.000 en la web, al refrescar la app la solicitud está
   *Aprobada — por pagar* con valor aprobado 300.000.
8. Cancelar una pendiente propia la deja *Cancelada*. Intentar cancelar una ya decidida muestra
   el mensaje del backend.
9. Al cumplirse el manifiesto, las pendientes aparecen *Canceladas* con la nota *"Cancelada
   automáticamente: el cumplido del manifiesto fue aceptado."*
10. Montos con separador de miles y fechas en hora de Colombia en todas las pantallas.

---

## 7. Para probar contra el backend

1. Ejecutar en la base de la empresa las migraciones `01-11-2026-liquidacion-manifiesto.sql`,
   `01-11-2026-sobreanticipo-solicitudes.sql` y `01-11-2026-app-movil-sobreanticipos.sql`.
2. Un usuario con rol **Conductor** asignado a un vehículo (desde la web, *Asignación de
   vehículos*) que tenga un manifiesto expedido y sin cumplir.
3. Un segundo usuario aprobador en la web (permiso `canEdit` en *Solicitudes de sobreanticipo*)
   para aprobar o rechazar. Ver `docs/ui-liquidacion-manifiesto.md` §15.
