# Requerimiento — Seguimiento de viaje (inicio de viaje y ubicación por solicitud)

**Estado:** fases S1 a S3 implementadas en backend y app (02/11/2026); falta la web (§8) y la
S4 es opcional. Depende de `notificaciones-push.md`. Contratos: `mobile-api.md` §P7 y
`seguimiento-viaje-api.md` (backend, incluye la API de la web).

Diferencias con esta propuesta al implementarla:
- El trazado se guarda en una tabla `rutaGeometria` por secuencia de coordenadas (no en
  `routes.geometry`) y se toma de la foto de la ruta del manifiesto (`routeSnapshot`), así una ruta
  editada después no cambia los viajes.
- El pedido se crea al enviarse (estados `enviado`, `respondido`, `sin_respuesta`, `cancelado`);
  `viajePedido.motivo` puede ser también `manual` ("Pedir ubicación ahora" desde la web).
- `GET /mobile/viajes/activo` responde `{ viaje }`. La configuración vive en `seguimientoConfig`.
- La pantalla de un toque es `/seguimiento/{manifiestoId}/compartir`; si la app está abierta cuando
  llega el pedido, la ubicación se envía sola.

**Para quién:** los equipos de backend (`backlogistic`), app móvil (`Longistik-app`) y web
(`longistik-frontend`).

---

## 1. Objetivo y principios

Ayudar a la seguridad del conductor y del viaje: que la empresa sepa por dónde va un vehículo y
si sigue la ruta esperada, **sin convertir el celular del conductor en un GPS que gasta
batería**.

1. **Solo cuando se pide.** El seguimiento funciona solo si el conductor toca **"Iniciar viaje"**
   o si la empresa se lo asigna a un manifiesto (y él lo acepta). Fuera del viaje no se toma
   ninguna ubicación.
2. **Ubicación por solicitud, no continua.** El servidor programa *pedidos de ubicación* según
   la ruta y el tiempo, y los envía por push. El GPS se enciende solo unos segundos por pedido.
   Entre pedidos no corre nada en el teléfono.
3. **Si no responde, no pasa nada.** El pedido queda "sin respuesta" en el historial, sin
   bloqueos ni sanciones. Varios seguidos generan un aviso al despachador, por la seguridad del
   conductor.
4. **Seguridad vial.** Usar el celular manejando es una infracción (Ley 769 de 2002, art. 131).
   Los textos piden responder **"cuando estés detenido de forma segura"**, y la respuesta es de
   un solo toque.
5. **Habeas data (Ley 1581 de 2012).** Consentimiento informado y registrado, finalidad
   declarada (seguridad del viaje), el conductor ve lo que comparte y puede pausar.

### Lo que esta versión no hace (a propósito)

- **No hay rastreo en segundo plano.** La ubicación se toma con la app abierta: el conductor
  toca la notificación, o ya tenía la app abierta.
- Gracias a eso basta el permiso de ubicación **"mientras se usa la app"**, el mismo que ya usa
  el cumplido. **No hace falta** el permiso de segundo plano ni la declaración y el video que
  Google Play exige para él, y la revisión de Apple es la normal.
- La respuesta automática sin tocar el teléfono queda como fase opcional (§10, fase S3).

---

## 2. Conceptos

| Concepto | Qué es |
|---|---|
| **Viaje** | El seguimiento de un manifiesto, por un conductor (usuario de la app). Como máximo uno activo por manifiesto y uno activo por conductor |
| **Ruta esperada** | Trazado por carretera de las paradas de la ruta del manifiesto, con km y tiempo por tramo |
| **Pedido de ubicación** | Momento programado en que el servidor le pide la ubicación al conductor |
| **Reporte** | Una ubicación enviada por el conductor: al iniciar, en respuesta a un pedido, por su cuenta o como auxilio |

### Estados del viaje

```
asignado ──(conductor acepta)──► activo ◄──► pausado
   │                               │
   └──(se cancela)──► cancelado    └──(cumplido · fin manual · anulación · 24 h sin reportes)──► finalizado
```

- `asignado`: la empresa lo pidió y el conductor todavía no acepta.
- Un conductor que inicia por su cuenta pasa directo a `activo`.
- `pausado`: el conductor lo pausó (con motivo opcional). No se envían pedidos. Si el viaje fue
  asignado, la pausa se notifica al despachador; no se bloquea.
- `finalizado`: automático al aceptarse el cumplido del manifiesto o al anularlo, manual por el
  conductor ("Terminar viaje") o por el despachador, y por inactividad (24 h sin reportes ni
  respuestas).

---

## 3. Ruta esperada

- Las rutas ya tienen paradas (`routeStop`), km y minutos por tramo, y las ciudades tienen
  coordenadas DIVIPOLA (`docs/rutas-distancia-api.md`).
- El trazado se pide a **OpenRouteService** (perfil camión `driving-hgv`), la misma integración
  y llave de `route-distance.service.ts`. La respuesta de `/v2/directions` ya trae `geometry`
  (polilínea codificada): hoy se descarta y ahora se guarda.
- **Se guarda por ruta, no por viaje:** campo `routes.geometry` (+ `geometryCalculatedAt`). Una
  ruta se reutiliza en muchos manifiestos, así que la cuota gratuita de ORS (2.000 por día)
  sobra. Se recalcula cuando cambian las paradas.
- Los tramos de **SiceTac** (km oficiales) no traen trazado: para la geometría se usa ORS
  siempre. Los km y el tiempo oficiales siguen saliendo de donde salen hoy.
- **Sin trazado** (ORS caído, ruta urbana o ciudades sin coordenadas): el viaje funciona igual,
  con pedidos por tiempo, pero sin evaluar desvío. El despachador ve "Sin ruta esperada".

---

## 4. Pedidos de ubicación

### 4.1 Programación

Al activarse el viaje, el servidor programa los pedidos:

- **Cada `intervaloMin`** (por defecto **30 min**; configurable por empresa entre 15 y 120)
  desde el último reporte.
- **Más uno al llegar a cada parada**, según el tiempo estimado del tramo (`legMinutes`).
- Si el conductor reporta por su cuenta, el siguiente pedido se corre: el intervalo cuenta desde
  el **último reporte**, sea del tipo que sea. Un conductor que abre la app seguido casi no
  recibe pedidos (§6.4).
- **Horario de descanso** (opcional por empresa, p. ej. de 22:00 a 05:00): no se envían pedidos.

### 4.2 Ciclo de un pedido

```
programado ──(vence)──► enviado ──► respondido
                           └──(pasa la ventana)──► sin_respuesta
cualquiera ──(fin o pausa del viaje)──► cancelado
```

- **Ventana de respuesta:** `ventanaMin` (por defecto **20 min**). Un reporte capturado dentro
  de la ventana responde el pedido, aunque llegue después por falta de señal (cuenta
  `capturadoEn`, no la hora de llegada).
- Al enviarse: push del canal `seguimiento` con `agrupar = "seguimiento-{viajeId}"`, para que no
  se acumulen pedidos en el teléfono. Texto: **"¿Todo bien en tu viaje MT000812? Cuando estés
  detenido de forma segura, toca para compartir tu ubicación."**
- Un *worker* del backend (cada minuto, mismo patrón `setInterval` que
  `ExportacionContableService`) envía los vencidos y cierra las ventanas.

---

## 5. Evaluación de cada reporte

Con la ruta esperada, cada reporte guarda:

| Dato | Cómo |
|---|---|
| `distanciaRutaKm` | Distancia del punto a la polilínea. Se calcula en Node; MySQL tiene funciones espaciales si hace falta |
| `progresoKm` | Km recorridos sobre la ruta hasta la proyección del punto |
| `atrasoMin` | Tiempo esperado para ese progreso (por tramos, con `legMinutes`) contra el tiempo real desde el inicio. Positivo = atrasado |
| `estado` | `en_ruta` \| `desviado` (`distanciaRutaKm` > `umbralDesvioKm`, por defecto **5 km**) \| `sin_ruta` |

La precisión del GPS se tiene en cuenta: un punto con precisión peor que 1 km no marca desvío.

### Alertas al despachador

Por push y en la campana, a usuarios con `seguimiento.ver`:

| `tipo` | Cuándo | Prioridad |
|---|---|---|
| `seguimiento.auxilio` | El conductor tocó "Necesito ayuda" | **Alta**, canal `alertas`. No se puede silenciar |
| `seguimiento.desvio` | 2 reportes seguidos `desviado` | Alta |
| `seguimiento.sin_respuesta` | `pedidosSinRespuestaAlerta` (por defecto **2**) pedidos seguidos sin respuesta | Normal |
| `seguimiento.pausado` | El conductor pausó un viaje asignado | Normal |
| `seguimiento.llegada` | Reporte a menos de 2 km del destino | Solo campana |

Al conductor:

| `tipo` | Cuándo |
|---|---|
| `seguimiento.asignado` | La empresa le asignó seguimiento: "Tu empresa activó el seguimiento del viaje MT000812. Toca para aceptarlo." |
| `seguimiento.pedido` | Cada pedido de ubicación (§4.2) |
| `seguimiento.cumplir` | Llegó a menos de 2 km del destino: "¿Ya entregaste? Cumple la remesa desde la app." |

---

## 6. App móvil

### 6.1 Consentimiento (la primera vez)

Hoja con el texto de finalidad:

- para qué se usa: seguridad del viaje y del conductor;
- qué se comparte: la ubicación solo cuando se pide o cuando él la envía, nunca en segundo plano;
- quién lo ve: la empresa;
- cuánto tiempo se guarda;
- cómo pausarlo.

Botones **Aceptar** / **Ahora no**. Se registra la aceptación con la versión del texto. Si el
texto cambia de versión, se vuelve a pedir.

### 6.2 Tarjeta "Seguimiento del viaje"

En el detalle del manifiesto, solo para conductores con el vehículo asignado y el manifiesto
activo:

| Estado | Muestra | Acciones |
|---|---|---|
| Sin viaje | "Activa el seguimiento para que tu empresa sepa que vas bien" | **Iniciar viaje** |
| `asignado` | "Tu empresa activó el seguimiento de este viaje" | **Aceptar e iniciar** · Ahora no |
| `activo` | "Viaje en curso · último reporte 10:12 · próximo pedido ~10:42" | **Compartir ubicación** · Pausar · Terminar viaje |
| `pausado` | "Seguimiento en pausa" | Reanudar · Terminar viaje |

"Iniciar viaje" pide la ubicación (permiso "mientras se usa la app") y la envía como primer
reporte.

### 6.3 Inicio

Con un viaje activo, Inicio muestra una franja **"Viaje MT000812 en curso"** con
**Compartir ubicación** y el acceso al manifiesto.

### 6.4 Reporte oportunista

Si hay un viaje activo y el último reporte tiene más de la mitad del intervalo, al abrir o
volver a la app se envía un reporte automático, sin preguntar: la app ya está en uso y el
permiso ya existe. Así muchos pedidos ni siquiera hacen falta.

### 6.5 Al tocar el pedido (push)

1. La app abre en una pantalla mínima: "Compartiendo tu ubicación…".
2. Toma la ubicación (con un tiempo máximo de 20 s; si la precisión es mala, envía la mejor que
   haya).
3. Envía y muestra "Listo, gracias" con la hora.

Es un toque en total. Sin señal, el reporte queda en la cola del teléfono y se envía al
recuperarla, con el mismo mecanismo de la cola de cumplidos (`src/offline/`), con
`Idempotency-Key`.

### 6.6 "Necesito ayuda"

En la tarjeta y en la franja de Inicio, con confirmación ("¿Enviar alerta de auxilio a tu
empresa?"):

- Envía la ubicación como reporte `auxilio` y alerta de inmediato al despachador.
- La misma pantalla muestra **"Llamar al 123"**: la alerta **no reemplaza** la línea de
  emergencias, y el texto lo dice.

### 6.7 Batería

- Un pedido cada 30 min equivale a encender el GPS unos segundos por hora y a una petición
  pequeña. El consumo es despreciable frente a una llamada.
- No hay servicios en segundo plano, ni notificación fija, ni actividad mientras el teléfono
  está guardado.

---

## 7. Backend

### 7.1 Tablas

**`viaje`**

| Campo | Notas |
|---|---|
| `id`, `manifiestoId`, `userId` (conductor), `vehiculoId` | |
| `estado` | §2 |
| `origen` | `conductor` \| `asignado` |
| `asignadoPor`, `asignadoEn` | Si lo asignó la empresa |
| `iniciadoEn`, `finalizadoEn`, `motivoFin` | `cumplido` \| `anulado` \| `conductor` \| `despachador` \| `inactividad` |
| `intervaloMin`, `ventanaMin`, `umbralDesvioKm` | Copiados de la configuración al iniciar |
| `consentimientoId` | |
| `ultimoReporteEn`, `ultimoEstado` | Para listar rápido en la web |

**`viajePedido`**: `id`, `viajeId`, `programadoPara`, `enviadoEn`, `estado` (§4.2),
`reporteId`, `motivo` (`intervalo` \| `parada`).

**`viajeReporte`**

| Campo | Notas |
|---|---|
| `id`, `viajeId`, `pedidoId` (nullable) | |
| `tipo` | `inicio` \| `pedido` \| `voluntario` \| `oportunista` \| `auxilio` \| `fin` |
| `latitud`, `longitud`, `precisionMetros`, `velocidadKmh`, `rumbo` | Velocidad y rumbo si el GPS los da |
| `bateria` | 0–100, si el teléfono la informa |
| `capturadoEn`, `recibidoEn` | |
| `idempotencyKey` | Único |
| `distanciaRutaKm`, `progresoKm`, `atrasoMin`, `estado` | §5 |

**`seguimientoConsentimiento`**: `id`, `userId`, `version`, `aceptadoEn`, `dispositivo`.
Permanente.

**`routes`**: + `geometry` (texto, polilínea codificada) y `geometryCalculatedAt`.

**Configuración por empresa** (`company_config` o tabla propia): `intervaloMin`, `ventanaMin`,
`umbralDesvioKm`, `pedidosSinRespuestaAlerta`, `descansoDesde`, `descansoHasta`,
`retencionDias` (por defecto 90).

Volumen: con pedidos cada 30 min son unos 20 a 40 reportes por viaje al día. Es poco.

### 7.2 Permisos (matriz de roles)

| Código | Uso | Por defecto |
|---|---|---|
| `seguimiento.ver` | Ver viajes y recibir alertas (web y app) | Administradores, perfil de despachador |
| `seguimiento.asignar` | Asignar o cancelar seguimiento a un manifiesto (web) | Administradores, perfil de despachador |

El conductor no necesita permiso nuevo: puede iniciar el seguimiento de los manifiestos activos
de su vehículo asignado (alcance `asignados`, reglas de `mobile-api.md`). Un usuario con
alcance `todos` no inicia viajes.

### 7.3 API de la app (`/mobile`)

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/mobile/viajes/activo` | El viaje `activo`, `pausado` o `asignado` del usuario, o `null`. Para la franja de Inicio |
| `GET` | `/mobile/manifiestos/{id}/viaje` | Estado para la tarjeta: viaje o `null`, `puedeIniciar`, `motivoNoDisponible`, `consentimientoVigente`, `proximoPedido`, últimos 5 reportes |
| `POST` | `/mobile/seguimiento/consentimiento` | `{ version }` |
| `POST` | `/mobile/manifiestos/{id}/viaje/iniciar` | `{ reporte }` (la ubicación de inicio). Crea el viaje o acepta el asignado. `409` si ya hay otro activo del conductor o del manifiesto, o si falta el consentimiento |
| `POST` | `/mobile/viajes/{id}/pausar` | `{ motivo? }` |
| `POST` | `/mobile/viajes/{id}/reanudar` | |
| `POST` | `/mobile/viajes/{id}/terminar` | `{ reporte? }` |
| `POST` | `/mobile/viajes/reportes` | Lote `[{ viajeId, pedidoId?, tipo, latitud, longitud, precisionMetros, velocidadKmh?, rumbo?, bateria?, capturadoEn, idempotencyKey }]`. Idempotente por `idempotencyKey`. Responde por ítem `aceptado` \| `duplicado` \| `rechazado` (viaje ajeno o finalizado) |

`auxilio` va por el mismo endpoint de reportes y dispara la alerta al recibirse.

### 7.4 API de la web

| Uso | Detalle |
|---|---|
| Viajes en curso | Lista con manifiesto, placa, conductor, último reporte (hora, estado, atraso), pedidos sin respuesta y alertas abiertas. Filtros: estado y "con alertas" |
| Detalle de un viaje | Ruta esperada (polilínea), reportes, pedidos con su estado y línea de tiempo |
| Asignar seguimiento | Desde el manifiesto (`seguimiento.asignar`). Notifica al conductor (`seguimiento.asignado`) |
| Cancelar o terminar | Desde el viaje |
| Pedir ubicación ahora | Envía un pedido inmediato (máximo uno cada 10 min) |
| Configuración | §7.1, en la configuración de la empresa |

---

## 8. Web (pantallas)

- **"Viajes en curso"**: tabla con los datos de §7.4 y un mapa con la última posición de cada
  viaje, coloreada por estado (en ruta, desviado, sin respuesta, auxilio).
- **Detalle de un viaje**:
  - mapa con la ruta esperada (línea gris), los reportes unidos en orden (línea de color), cada
    reporte como punto con su hora y los pedidos sin respuesta marcados en la línea de tiempo;
  - panel lateral con conductor, teléfono, batería del último reporte y alertas.
- **Mapa:** Leaflet (gratis). Los mosaicos públicos de OpenStreetMap no permiten uso comercial
  intensivo, así que conviene un proveedor con plan gratuito (MapTiler o Stadia Maps), o el
  mapa base de Google o Mapbox si ya se paga alguno.
- En el detalle del manifiesto: botón **"Asignar seguimiento"** y estado del viaje.

---

## 9. Criterios de aceptación

1. Un conductor sin viaje activo no envía ninguna ubicación, y la app no la toma.
2. "Iniciar viaje" pide el consentimiento la primera vez, envía la ubicación y deja el viaje
   `activo` con el siguiente pedido a 30 min.
3. Con la app cerrada, el pedido llega como push. Al tocarlo, la ubicación se envía en un toque
   y el pedido queda `respondido`.
4. Sin señal, el reporte se guarda en el teléfono, se envía al recuperar la señal y responde el
   pedido si se capturó dentro de la ventana.
5. Un pedido no respondido queda `sin_respuesta`. Con 2 seguidos, el despachador recibe la
   alerta y el conductor no ve ningún bloqueo.
6. Dos reportes a más de 5 km de la ruta generan la alerta `desvio`. Un punto con mala precisión
   no la genera.
7. "Necesito ayuda" alerta al despachador en menos de 1 minuto, con la ubicación, y la app
   ofrece llamar al 123.
8. Al aceptarse el cumplido del manifiesto, el viaje se finaliza solo y no llegan más pedidos.
9. Pausar detiene los pedidos. En un viaje asignado, el despachador recibe el aviso.
10. Abrir la app con un viaje activo envía un reporte oportunista y corre el siguiente pedido.
11. La web muestra los viajes en curso con su última posición, y el detalle con la ruta
    esperada contra la recorrida.
12. Ninguna pantalla de la app pide el permiso de ubicación "siempre" ni de segundo plano.

---

## 10. Plan por fases

| Fase | Contenido | Depende de |
|---|---|---|
| **S1** | Viaje, consentimiento, reportes (inicio, voluntario, oportunista, auxilio) y cola sin señal en la app. Web: viajes en curso y detalle con los puntos en el mapa. Sin pedidos por push: ya sirve para "Compartir ubicación" y auxilio | F1 de push (campana, para las alertas) |
| **S2** | Pedidos programados por push, ventana, `sin_respuesta` y alertas | F2 de push |
| **S3** | Ruta esperada (geometría ORS), evaluación de desvío y atraso, alertas `desvio` y `llegada`, y la ruta en el mapa de la web | S1 |
| **S4** (opcional) | **Solo Android:** responder el pedido sin tocar el teléfono. Mensaje de datos de alta prioridad, más un componente nativo que toma la ubicación y la envía. Exige el permiso de ubicación en segundo plano y la declaración en Google Play. **En iOS no es confiable** (Apple limita los push silenciosos), así que allá se mantiene el toque. Solo si el piloto muestra que el toque no basta | S2 |

---

## 11. Por decidir

| # | Tema | Propuesta por defecto |
|---|---|---|
| 1 | Intervalo de pedidos y ventana | 30 min y 20 min, configurables por empresa |
| 2 | Umbral de desvío y pedidos seguidos sin respuesta para alertar | 5 km y 2 |
| 3 | ¿El conductor puede pausar un viaje asignado? | Sí, con aviso al despachador (por habeas data no se le puede obligar) |
| 4 | Horario de descanso sin pedidos | Desactivado por defecto |
| 5 | Retención de reportes | 90 días (el consentimiento se guarda siempre) |
| 6 | Proveedor de mosaicos del mapa web | MapTiler o Stadia, plan gratuito |
| 7 | ¿Se integra el GPS satelital del vehículo, si la empresa tiene uno con API? | Fuera de alcance. Si existe, sus posiciones podrían entrar como reportes `satelital` en el mismo viaje |
