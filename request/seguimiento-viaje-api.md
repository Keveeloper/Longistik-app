# Seguimiento de viaje

Requerimiento: `request/seguimiento-viaje.md` (copia en la app). Contrato de la app:
[mobile-api.md](mobile-api.md) §P7. Avisos y push: [notificaciones-api.md](notificaciones-api.md).
Código: `src/mobile/seguimiento/`. Migración: `02-11-2026-notificaciones-seguimiento-viaje.sql`.

## Principios

- **Solo cuando se pide.** El conductor toca "Iniciar viaje" o acepta el seguimiento que le
  asignó la empresa. Fuera del viaje no se toma ninguna ubicación.
- **Ubicación por solicitud, no continua.** El servidor programa pedidos y los envía por push; el
  teléfono no corre nada en segundo plano (no hace falta el permiso de ubicación en segundo plano).
- **Si no responde, no pasa nada**: el pedido queda `sin_respuesta`. Varios seguidos avisan al
  despachador.
- **Habeas data (Ley 1581 de 2012)**: el conductor acepta un texto de finalidad
  (`VERSION_CONSENTIMIENTO` en `seguimiento.reglas.ts`; cambiar el texto en la app = subir la
  versión) y puede pausar o terminar el seguimiento, también el asignado.

## Configuración por empresa (`seguimientoConfig`, fila `id = 1`)

| Campo | Por defecto | Rango |
|---|---|---|
| `intervaloMin` | 30 | 15–120 (minutos entre pedidos, contados desde el último reporte) |
| `ventanaMin` | 20 | 5–60, menor que el intervalo (para responder un pedido) |
| `umbralDesvioKm` | 5 | 1–50 |
| `pedidosSinRespuestaAlerta` | 2 | 1–10 |
| `descansoDesde` / `descansoHasta` | sin descanso | `HH:MM` en hora de Colombia; puede cruzar la medianoche |
| `retencionDias` | 90 | 7–730 (reportes y pedidos de viajes terminados) |

Cada viaje copia intervalo, ventana y umbral al iniciar: cambiar la configuración no altera los
viajes en curso. Env: `SEGUIMIENTO_WORKER=off` apaga el worker.

## Ruta esperada

Paradas del manifiesto (`chargeOrder.routeSnapshot`, o la ruta si no tiene foto) → coordenadas
DIVIPOLA de cada municipio → **OpenRouteService** (perfil camión, misma `ORS_API_KEY` de
[rutas-distancia-api.md](rutas-distancia-api.md)) con todas las paradas en una llamada. Se guarda
en `rutaGeometria` por hash de las coordenadas: muchos manifiestos repiten ruta y la cuota gratuita
(2.000 por día) sobra. Un cálculo fallido se reintenta a las 6 h.

Sin trazado (sin llave, ORS caído o una parada sin coordenadas) el viaje funciona igual, con
pedidos por tiempo, pero los reportes quedan `sin_ruta` (sin desvío ni atraso).

## Pedidos (SeguimientoWorker, cada minuto)

1. **Finaliza** los viajes cuyo manifiesto se cumplió (`cumplido`) o anuló (`anulado`), y los
   activos o pausados con 24 h sin reportes (`inactividad`). Un asignado sin aceptar queda
   `cancelado`.
2. **Cierra ventanas**: los pedidos `enviado` vencidos pasan a `sin_respuesta`. Al llegar a
   `pedidosSinRespuestaAlerta` seguidos, avisa una vez (`seguimiento.sin_respuesta`).
3. **Envía pedidos** a los viajes activos cuyo `proximoPedidoEn` pasó o que llegaron (por tiempo
   estimado) a una parada, salvo en horario de descanso (se corre al fin del descanso) o si ya hay
   uno esperando respuesta. Cada pedido es un push `seguimiento.pedido` que vence con la ventana.

Una vez al día borra reportes y pedidos de viajes terminados hace más de `retencionDias`.

## Reportes

Llegan en lote (`POST /mobile/viajes/reportes`), idempotentes por `idempotencyKey`, ordenados por
hora de captura. Cada uno:

- **Se evalúa contra la ruta**: distancia a la polilínea (`distanciaRutaKm`), km recorridos
  (`progresoKm`) y `atrasoMin` (minutos desde el inicio menos el tiempo esperado para ese
  progreso, repartiendo el de cada tramo por distancia). `desviado` si la distancia, descontada la
  precisión del GPS, supera el umbral; un punto con precisión peor que 1 km nunca marca desvío.
- **Responde el pedido** que estaba abierto cuando se capturó, aunque llegue tarde sin señal
  (también uno ya marcado `sin_respuesta`).
- **Actualiza el viaje** solo si es el más reciente: última posición, estado, atraso, batería, y
  el próximo pedido (intervalo desde ese reporte). Reinicia el contador de sin respuesta.
- **Alertas** (a usuarios con `seguimiento.ver`, nunca al propio conductor): `auxilio` siempre;
  `desvio` en el segundo reporte desviado seguido (una vez por episodio, se rearma al volver a la
  ruta); `llegada` a menos de 2 km del destino (solo campana), y al conductor `seguimiento.cumplir`.

Un reporte de un viaje ajeno, sin iniciar o terminado (capturado después del fin) queda
`rechazado` y la app no lo reintenta.

## API web (`/seguimiento`, `AuthGuard('jwt')` + matriz de roles)

Módulo `/seguimiento`: `canView` = ver y recibir alertas, `canCreate` = asignar, terminar y pedir
ubicación, `canEdit` = configuración. Errores con su código HTTP real.

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| `GET` | `/seguimiento/viajes?estado=en_curso\|finalizados&alertas=true&page=&pageSize=` | ver | Viajes con última posición, atraso y alertas (mismo formato de viaje que §P7) |
| `GET` | `/seguimiento/viajes/{id}` | ver | Viaje + `ruta` (`puntos [lat, lng]`, `paradas`, `tramos`), todos los `reportes` y `pedidos` |
| `GET` | `/seguimiento/manifiestos/{id}/candidatos` | asignar | Usuarios con asignación vigente al vehículo del manifiesto |
| `POST` | `/seguimiento/viajes` | asignar | `{ manifiestoId, userId? }`: crea el viaje `asignado` y avisa al conductor. Sin `userId`, el único candidato; `422` si hay varios o ninguno; `409` si el manifiesto no está activo o ya tiene seguimiento |
| `POST` | `/seguimiento/viajes/{id}/terminar` | asignar | Termina (o cancela uno asignado sin aceptar) |
| `POST` | `/seguimiento/viajes/{id}/pedir-ubicacion` | asignar | Pedido inmediato; como mucho uno cada 10 minutos (`409`) |
| `GET` / `PUT` | `/seguimiento/config` | ver / configurar | Configuración de arriba; `400` con `errors` por campo |

Para el mapa de la web: la ruta esperada en gris (`ruta.puntos`), los reportes unidos en orden y
la última posición coloreada por estado.
