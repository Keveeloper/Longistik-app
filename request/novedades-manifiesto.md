# Requerimiento — Novedades del manifiesto

**Estado:** N1 (backend) implementado el 06/11/2026: contrato en `backlogistic/docs/novedades-api.md` y `docs/mobile-api.md` §P8. Depende de `notificaciones-push.md` (campana y push, ya
implementados). La pestaña Novedades de la app hoy muestra datos de ejemplo
(`src/data/novedades.mock.ts`); este requerimiento la reemplaza.

**Para quién:** los equipos de backend (`backlogistic`), app móvil (`Longistik-app`) y web
(`TransLogistic`).

**Decisiones tomadas:**
1. Los tipos de novedad son **fijos** y son **solo los que el RNDC acepta** (§3).
2. La suspensión del viaje y el transbordo ante el RNDC **quedan para una fase futura** (§10).
3. La novedad la **reporta el conductor** desde la app. Se gestiona y se **cierra solo desde
   la web**.

---

## 1. Qué dice el RNDC

En el RNDC **no existe un registro general de novedades del manifiesto** para la empresa de
transporte. Lo que pasa en la vía llega al RNDC solo a través de otros trámites, cada uno con
su catálogo cerrado:

| Situación | Proceso RNDC | Quién lo reporta | Catálogo |
|---|---|---|---|
| Viaje suspendido | Cumplido de manifiesto (6), `TIPOCUMPLIDOMANIFIESTO = S` | Empresa de transporte | `MOTIVOSUSPENSIONMANIFIESTO`: A Accidente, V Varada, S Siniestro. `CONSECUENCIASUSPENSION`: C conductor, V cabezote, R remolque, T total, F fin del viaje o pérdida total |
| Carga perdida | Cumplido de remesa (5), `TIPOCUMPLIDOREMESA = S` | Empresa de transporte | `MOTIVOSUSPENSIONREMESA`: A, V, S |
| Transbordo no planeado | Manifiesto nuevo (4) con `MANNROMANIFIESTOTRANSBORDO` | Empresa de transporte | La remesa es la misma; el manifiesto original lleva el descuento V |
| Faltante, deterioro o merma | Descuento en el cumplido de manifiesto | Empresa de transporte | `MOTIVOVALORDESCUENTOMANIFIESTO`: F Faltante, D Deterioro de la carga, C Merma, V Viaje incompleto por suspensión |
| Tiempos afectados por la vía | Ajuste de monitoreo (60) | Empresa de transporte | Motivo 1: operaciones afectadas por caso fortuito o fuerza mayor |
| Fallas del monitoreo (RNMM) | Proceso 46 | **Solo la empresa de GPS** | Vehículo no apareció en la cita, placa no registrada, vehículo suspendido en el GPS, equipo con fallas |
| Control en carretera | Proceso 39 | Autoridad de tránsito | — |

Fuentes: Resolución 20263040016075 de 2026 (§5.3 y §6.1), Guía de Manifiesto V7 (sept. 2026),
Manual RNDC Web Service v3.0 (variables de los procesos 5, 6 y 46) y Guía de monitoreo de flota
v6 (§10.1 y §11).

---

## 2. Objetivo

Que el conductor avise en el momento lo que le pasa al viaje o a la carga, con evidencia (fotos,
ubicación y hora), y que la empresa lo gestione desde la web. Así cada novedad queda clasificada
**con el mismo código del RNDC** que la empresa va a necesitar después en el cumplido o en el
ajuste de tiempos.

Esta versión **no envía nada al RNDC**: registra, avisa y deja la trazabilidad.

---

## 3. Tipos de novedad (catálogo fijo)

| Código | Nombre en la app | Ayuda para el conductor | Equivale en el RNDC a | ¿Remesa? |
|---|---|---|---|---|
| `accidente` | Accidente | Choque o volcamiento del vehículo | Suspensión, motivo **A** | Opcional |
| `varada` | Vehículo varado | Falla mecánica que no deja seguir | Suspensión, motivo **V** | Opcional |
| `siniestro` | Siniestro | Robo, incendio o pérdida de la carga | Suspensión, motivo **S** | Opcional |
| `faltante` | Faltante de carga | Falta mercancía respecto a lo cargado | Descuento **F** | **Obligatoria** |
| `deterioro` | Carga deteriorada | Mercancía dañada o averiada | Descuento **D** | **Obligatoria** |
| `merma` | Merma | Diferencia de peso o cantidad propia de la carga | Descuento **C** | **Obligatoria** |
| `fuerza_mayor` | Vía afectada | Cierre, derrumbe, bloqueo o clima que impide avanzar | Ajuste de tiempos, motivo **1** | Opcional |

- El catálogo vive en el backend (`GET /mobile/catalogos/tipos-novedad`) con `codigo`,
  `nombre`, `ayuda`, `rndc` (`{ tramite, codigo }`) y `requiereRemesa`. No es editable por
  empresa.
- **No hay tipo "Otro"**: lo que no encaja en el RNDC no es una novedad del manifiesto. Las
  demoras de cargue y descargue ya quedan en los tiempos logísticos. Retenes, pinchazos o paradas
  cortas que no detienen el viaje no se reportan.

---

## 4. Estados

| Estado | Quién lo pone | Qué significa |
|---|---|---|
| `abierta` | Al reportarse | Nadie la ha tomado |
| `en_gestion` | Web | Alguien de la empresa la está atendiendo. Queda registrado quién |
| `cerrada` | Web | Atendida. **Exige una resolución** (texto) |

- Solo la web cambia el estado. El conductor no edita ni cierra.
- En la web se pueden agregar **notas** en cualquier estado abierto. Todo queda en el historial
  de la novedad.
- Una novedad cerrada no se reabre: si el problema sigue, el conductor reporta una nueva.

---

## 5. Reglas

1. Se reporta sobre un **manifiesto activo** (expedido, no cumplido ni anulado) que el usuario
   puede ver. El alcance `asignados` solo ve los manifiestos de su vehículo asignado
   (`mobile-api.md`).
2. Permiso `novedades.reportar` (ya existe; lo tienen Conductor, Supervisor de flota y el perfil
   de despachador).
3. La remesa es obligatoria en `faltante`, `deterioro` y `merma`, y debe pertenecer al
   manifiesto.
4. La descripción es obligatoria (10 a 500 caracteres). Las fotos son opcionales, hasta 5.
5. La ubicación se toma sola al reportar, si el permiso ya está dado. Sin GPS se reporta igual.
6. La hora de la novedad es la del teléfono al capturarla (`capturadaEn`), no la de llegada al
   servidor.
7. Un reporte sin señal queda en el teléfono y se envía después con su `Idempotency-Key`, igual
   que el cumplido. Nunca se duplica.

---

## 6. App móvil

### 6.1 Reportar novedad

Se abre desde tres lugares: el **"+"** de la pestaña Novedades, la acción rápida **"Reportar
novedad"** de Inicio y un botón en el **detalle del manifiesto** (que llega con el manifiesto ya
elegido).

Formulario de pantalla completa (ruta `/novedades/reportar`, en el outlet raíz, con el estilo de
"Cumplir remesa"):
1. **Manifiesto**: lista de los activos del usuario. Si tiene uno solo, viene elegido.
2. **Tipo**: los 7 del §3 como lista de opciones con su ayuda.
3. **Remesa**: solo si el tipo la pide (o si el usuario quiere indicarla).
4. **Qué pasó**: texto.
5. **Fotos**: cámara, con el mismo sello de `src/offline/evidencia.ts` (manifiesto, fecha, hora
   y coordenadas).
6. Ubicación y hora automáticas, mostradas como dato.

Al enviar: *"Novedad reportada. La empresa ya fue avisada."* Si no hay señal: *"Sin señal. La
novedad se enviará sola cuando vuelva la conexión."* (mismo patrón que `CumplirRemesa`).

### 6.2 Pestaña Novedades

Reemplaza los datos de ejemplo. Conserva el diseño actual (segmento **Abiertas / Cerradas**):
- Abiertas = `abierta` + `en_gestion`; la tarjeta muestra el tipo, el manifiesto, la ruta, hace
  cuánto y el estado ("Asignada a …" cuando está en gestión).
- Las que siguen en la cola del teléfono aparecen arriba con "Pendiente de envío".
- Alcance `asignados`: las que reportó el usuario y las de los manifiestos que puede ver (las de otro conductor del mismo vehículo, por ejemplo). Alcance `todos`: todas las de la empresa.
- Funciona sin señal con la última lista guardada (`usePagedList`).

### 6.3 Detalle (solo lectura)

Tipo, estado, manifiesto y remesa, descripción, fotos, ubicación (enlace al mapa), quién la tomó
y, si está cerrada, la resolución y quién la cerró.

### 6.4 Detalle del manifiesto

La sección "Novedades" lista las del manifiesto (hoy `novedades: []`) y tiene el botón
"Reportar novedad".

---

## 7. Backend

### 7.1 Tablas

**`novedad`**

| Campo | Notas |
|---|---|
| `id`, `manifiestoId`, `remesaId` (nullable) | |
| `tipo` | Código del §3 |
| `descripcion` | |
| `estado` | §4 |
| `latitud`, `longitud`, `precisionMetros` | Nullable |
| `capturadaEn`, `recibidaEn` | |
| `reportadaPor` (userId), `viajeId` (nullable) | `viajeId` si había un viaje con seguimiento activo |
| `gestionadaPor`, `gestionadaEn` | Al pasar a `en_gestion` |
| `cerradaPor`, `cerradaEn`, `resolucion` | |
| `origen` | `app` o `web` |
| `dispositivo` | User-Agent del teléfono |
| `idempotencyKey` | Único |

**`novedadFoto`**: `id`, `novedadId`, `ruta`, `tomadaEn`. Mismo almacenamiento que las fotos del
cumplido.

**`novedadEvento`** (historial): `id`, `novedadId`, `tipo` (`creada` \| `en_gestion` \| `nota` \|
`cerrada`), `userId`, `texto`, `creadoEn`.

### 7.2 Permisos

| Código | Uso | Por defecto |
|---|---|---|
| `novedades.reportar` | Reportar desde la app (ya existe) | Conductor, Supervisor de flota, perfil de despachador |
| `novedades.gestionar` | Ver todas en la web, tomar, anotar y cerrar | Administradores, perfil de despachador |

### 7.3 API de la app (`/mobile`)

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/mobile/catalogos/tipos-novedad` | Catálogo del §3 |
| `POST` | `/mobile/novedades` | `multipart/form-data`: `manifiestoId`, `remesaId?`, `tipo`, `descripcion`, `latitud?`, `longitud?`, `precisionMetros?`, `capturadaEn`, `fotos[]`. Header `Idempotency-Key`. `201` con la novedad; si la llave ya existe, `200` con la misma novedad. `422` con `code` si falla una regla del §5 |
| `GET` | `/mobile/novedades?vista=abiertas\|cerradas&manifiestoId=&page=` | Listado con el alcance del usuario |
| `GET` | `/mobile/novedades/{id}` | Detalle con fotos e historial público (estado, quién la tomó, resolución) |

`GET /mobile/manifiestos/{id}` llena `novedades` con el resumen de cada una.

### 7.4 API de la web

| Uso | Detalle |
|---|---|
| Bandeja | `GET /novedades` con filtros estado, tipo, fecha, placa, manifiesto, conductor. Total de abiertas para el contador del menú |
| Detalle | `GET /novedades/:id` con fotos, ubicación e historial |
| Tomar | `POST /novedades/:id/gestionar` → `en_gestion` |
| Nota | `POST /novedades/:id/notas` `{ texto }` |
| Cerrar | `POST /novedades/:id/cerrar` `{ resolucion }` (obligatoria) |

### 7.5 Avisos (campana y push)

Se agregan al catálogo `AVISOS` de `notificaciones`:

| Tipo | Para quién | Canal | Enlace |
|---|---|---|---|
| `novedad.reportada` | Usuarios con `novedades.gestionar` | `alertas` para accidente y siniestro; `operacion` para las demás | Web: detalle de la novedad |
| `novedad.en_gestion` | Quien la reportó | `operacion` | App: `/novedades/{id}` |
| `novedad.cerrada` | Quien la reportó | `operacion` | App: `/novedades/{id}` |

En la app, `rutaDeAviso()` (`src/push/avisos.ts`) suma el enlace `{ tipo: 'novedad', id }`.

---

## 8. Web (pantallas)

- **Bandeja "Novedades"** en el menú, con el contador de abiertas: tabla con tipo, manifiesto,
  placa, conductor, hace cuánto, estado y quién la gestiona. Las de accidente y siniestro
  resaltadas.
- **Detalle**: fotos (ampliables), mapa con el punto, datos del manifiesto y la remesa, historial,
  y las acciones Tomar, Agregar nota y Cerrar (con resolución).
- **En el detalle del manifiesto**: sección con sus novedades.
- Cada novedad muestra **a qué trámite del RNDC equivale** (§3), como referencia para el cumplido
  o el ajuste de tiempos. No envía nada.

---

## 9. Criterios de aceptación

1. El conductor reporta una novedad de un manifiesto activo de su vehículo, con fotos y
   ubicación, y la ve en Abiertas.
2. Sin señal, la novedad queda en el teléfono como "Pendiente de envío", se envía al recuperar
   la conexión y no se duplica aunque se reintente.
3. `faltante`, `deterioro` y `merma` no se envían sin remesa. Ningún tipo fuera del §3 es
   aceptado por el backend.
4. No se puede reportar sobre un manifiesto cumplido o anulado (`422 MANIFIESTO_NO_ACTIVO`) ni sobre uno que el usuario no ve, como el de otro vehículo (`404`, igual que el resto de la API).
5. Quien tiene `novedades.gestionar` recibe el aviso en la campana y por push en menos de un
   minuto. Accidente y siniestro llegan por el canal `alertas`.
6. Solo la web toma, anota y cierra. Cerrar exige resolución. La app no tiene acciones de cambio
   de estado.
7. Al tomarla y al cerrarla, el conductor recibe el aviso y la ve con el nuevo estado.
8. La pestaña Novedades ya no muestra datos de ejemplo.

---

## 10. Plan por fases

| Fase | Contenido | Proyectos |
|---|---|---|
| **N1** | Catálogo, tablas, API de la app y de la web, permiso `novedades.gestionar` | Backend |
| **N2** | Formulario de reporte con cola sin señal, pestaña Novedades real, detalle y sección del manifiesto | App |
| **N3** | Bandeja, detalle con acciones y sección en el manifiesto | Web |
| **N4** | Avisos del §7.5 y enlace en la app | Backend y app |
| **Futuro** | Desde una novedad de accidente, varada o siniestro: cumplido con suspensión (catálogos A/V/S y C/V/R/T/F) y manifiesto de transbordo (`MANNROMANIFIESTOTRANSBORDO`). Desde faltante, deterioro o merma: descuento con motivo F/D/C prellenado en el cumplido. Desde vía afectada: ajuste de tiempos con motivo 1 | Backend y web |

N2 y N3 pueden ir en paralelo cuando N1 esté listo.

---

## 11. Hallazgos para revisar aparte

1. **Motivos del ajuste de monitoreo en la web.** `TransLogistic`
   (`trackFinish/components/monitoreoHelpers.ts`) numera los motivos de 0 a 5 ("fuerza mayor" =
   0). La Guía de monitoreo de flota v6 (§10.1) los numera de 1 a 6 y su ejemplo de web service
   envía `<motivoajuste>1</motivoajuste>` para fuerza mayor. Además la guía tiene 6 motivos
   ("Incumplimiento de la empresa de monitoreo" y "La empresa de monitoreo reportó un RNMM" son
   dos distintos). Confirmar con un envío real antes de corregir.
2. **Catálogos de suspensión sin validar.** El backend acepta `motivoSuspension` y
   `consecuenciaSuspension` como texto libre en el cumplido. El RNDC solo acepta A/V/S y
   C/V/R/T/F. Se valida en la fase futura, junto con el transbordo.

---

## 12. Decidido (06/11/2026, con las propuestas por defecto)

| # | Tema | Decisión |
|---|---|---|
| 1 | ¿La web también puede registrar una novedad (p. ej. si el conductor llamó)? | Sí, con el mismo catálogo, quedando como reportada por el usuario de la web |
| 2 | ¿Fotos obligatorias en accidente, siniestro y deterioro? | No, opcionales en todos (puede no ser seguro tomarlas) |
| 3 | ¿El conductor puede agregar fotos o texto a una novedad ya enviada? | No en esta versión; reporta una nueva |
| 4 | Retención de fotos | La misma de las fotos del cumplido (hoy no se borran) |
