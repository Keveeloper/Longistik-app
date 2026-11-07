# Novedades del manifiesto

Requerimiento: `request/novedades-manifiesto.md` (copia en la app y en la web). Contrato de la
app: [mobile-api.md](mobile-api.md) §P8. Código: `src/mobile/novedades/`. Migración:
`06-11-2026-novedades-manifiesto.sql`.

## Principios

- **Catálogo fijo, solo lo que acepta el RNDC.** El RNDC no tiene un registro general de
  novedades: lo que pasa en la vía llega al RNDC por otros trámites. Cada tipo lleva el código de
  ese trámite (`TIPOS_NOVEDAD` en `novedades.reglas.ts`). No hay tipo "Otro".
- **El conductor reporta y la web gestiona.** La app reporta y consulta. Solo la web toma,
  anota y cierra. Una novedad cerrada no se reabre: si el problema sigue, se reporta otra.
- **Nada va al RNDC en esta versión.** El cumplido con suspensión, el transbordo, el descuento
  y el ajuste de tiempos a partir de una novedad son una fase futura.
- **Sin señal no se pierde ni se duplica.** La app encola el reporte y lo reenvía con la misma
  `Idempotency-Key`.

## Tipos

| `codigo` | `nombre` | `rndc.tramite` | `rndc.codigo` | `requiereRemesa` |
|---|---|---|---|---|
| `accidente` | Accidente | `suspension` | `A` | no |
| `varada` | Vehículo varado | `suspension` | `V` | no |
| `siniestro` | Siniestro | `suspension` | `S` | no |
| `faltante` | Faltante de carga | `descuento` | `F` | **sí** |
| `deterioro` | Carga deteriorada | `descuento` | `D` | **sí** |
| `merma` | Merma | `descuento` | `C` | **sí** |
| `fuerza_mayor` | Vía afectada | `ajuste_tiempos` | `1` | no |

Accidente y siniestro son **críticas** (`critica: true`). La web las resalta y sus avisos irán
por el canal `alertas` (fase N4).

## Estados

`abierta` (al reportarse) → `en_gestion` (alguien de la oficina la tomó) → `cerrada` (con
resolución). Se puede cerrar sin tomarla antes; en ese caso queda gestionada por quien la cerró.
Tomar una que ya tiene otra persona la reasigna a quien la toma. Todo queda en `historial`.

## Reglas del reporte

| Regla | Error |
|---|---|
| `Idempotency-Key` de 8 a 64 caracteres (`A-Z a-z 0-9 - _`). Obligatoria en la app y opcional en la web | `400` |
| Misma llave ya registrada por el mismo usuario | `200` con la misma novedad (no se duplica) |
| Misma llave de otro usuario | `409 CONFLICT` |
| `tipo` fuera del catálogo | `400`, `errors.tipo` |
| `faltante`, `deterioro` o `merma` sin `remesaId` | `400`, `errors.remesaId` |
| `descripcion` de 10 a 500 caracteres | `400`, `errors.descripcion` |
| Hasta 5 fotos JPG/PNG/WEBP de 10 MB. Son opcionales | `400`, `errors.fotos` |
| `latitud` y `longitud` opcionales. Si viene una, deben venir las dos y en rango | `400`, `errors.ubicacion` |
| `capturadaEn` (hora del teléfono): hasta 30 días atrás y 10 min adelante. Sin ella, la hora del servidor | `400`, `errors.capturadaEn` |
| Manifiesto que el usuario no ve (alcance) | `404` |
| Manifiesto cumplido o anulado | `422 MANIFIESTO_NO_ACTIVO` |
| Remesa que no está en el manifiesto | `422 REMESA_NO_PERTENECE` |

Si el conductor tiene un viaje con seguimiento activo o pausado en ese manifiesto, la novedad
guarda el `viajeId`.

## Novedad (respuesta)

Los listados devuelven el item y los detalles agregan `conductor`, `viajeId`, `fotos` e
`historial`.

```json
{
  "id": 90,
  "tipo": { "codigo": "varada", "nombre": "Vehículo varado" },
  "rndc": { "tramite": "suspension", "codigo": "V", "descripcion": "Suspensión del manifiesto, motivo V (varada)" },
  "critica": false,
  "estado": "en_gestion",
  "descripcion": "Se rompió la caja de cambios en el km 40",
  "capturadaEn": "2026-11-06T09:00:00-05:00",
  "recibidaEn": "2026-11-06T09:05:00-05:00",
  "reportadaDesde": "app",
  "manifiesto": {
    "id": 812, "numero": "MT000812", "placa": "ABC123",
    "origen": { "codigoDane": "76001000", "nombre": "Cali, Valle del Cauca" },
    "destino": { "codigoDane": "11001000", "nombre": "Bogotá, D.C." }
  },
  "remesa": null,
  "reportadaPor": { "id": 34, "nombre": "Ana Ríos" },
  "gestionadaPor": { "id": 5, "nombre": "Laura Gómez" },
  "gestionadaEn": "2026-11-06T09:20:00-05:00",
  "cerradaPor": null,
  "cerradaEn": null,
  "resolucion": null,
  "ubicacion": { "latitud": 3.4516, "longitud": -76.532, "precisionMetros": 12 },

  "conductor": { "id": 7, "nombre": "Carlos Pérez" },
  "viajeId": 55,
  "fotos": [{ "id": 1, "url": "https://…/static/novedades/….jpg", "tomadaEn": "2026-11-06T09:00:00-05:00" }],
  "historial": [
    { "tipo": "creada", "texto": null, "por": { "id": 34, "nombre": "Ana Ríos" }, "en": "2026-11-06T09:05:00-05:00" },
    { "tipo": "en_gestion", "texto": null, "por": { "id": 5, "nombre": "Laura Gómez" }, "en": "2026-11-06T09:20:00-05:00" }
  ]
}
```

- `ubicacion` es `null` cuando se reportó sin GPS.
- `conductor` es el del manifiesto, o el del vehículo en los manifiestos viejos.
- `historial` va en orden cronológico. En la app **no incluye las notas** (`tipo: "nota"`), que
  son internas de la oficina. En el cierre, `texto` es la resolución.

## App (`/mobile`)

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| `GET` | `/mobile/catalogos/tipos-novedad` | — | `[{ codigo, nombre, ayuda, rndc, requiereRemesa }]` |
| `POST` | `/mobile/novedades` | `novedades.reportar` | `multipart/form-data`: `manifiestoId`, `remesaId?`, `tipo`, `descripcion`, `latitud?`, `longitud?`, `precisionMetros?`, `capturadaEn?`, `fotos` (0 a 5). Header `Idempotency-Key`. `201` con el detalle, o `200` si la llave ya existía |
| `GET` | `/mobile/novedades?vista=abiertas\|cerradas&manifiestoId=&page=&pageSize=` | — | Página `{ items, page, pageSize, total }`, de la más reciente a la más antigua |
| `GET` | `/mobile/novedades/{id}` | — | Detalle sin notas. `404` si no la ve |

**Qué ve cada usuario:** con alcance `todos`, todas. Con `asignados`, las que reportó y las de
los manifiestos que puede ver. Con `ninguno`, solo las suyas. `vista=abiertas` trae `abierta` y
`en_gestion`.

`GET /mobile/manifiestos/{id}` llena `novedades` con los items de ese manifiesto.

## Web (`/novedades`, JWT de la web)

Los permisos son el módulo `/novedades` de la matriz de roles y se validan en el servidor:
`canView` deja ver, `canCreate` deja registrar y `canEdit` deja tomar, anotar y cerrar (es
`novedades.gestionar`). Sin el permiso, la respuesta es `403 FORBIDDEN`.

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| `GET` | `/novedades/tipos` | ver | Catálogo |
| `GET` | `/novedades/contador` | ver | `{ abiertas }` para el contador del menú |
| `GET` | `/novedades` | ver | Bandeja `{ items, page, pageSize, total, abiertas }`. Filtros: `estado` (uno o varios separados por coma), `vista`, `tipo`, `desde`/`hasta` (`YYYY-MM-DD`, fecha de la novedad en hora de Colombia), `placa`, `manifiesto` (número MT…), `manifiestoId`, `conductor` (quien la reportó o el conductor del manifiesto) |
| `GET` | `/novedades/{id}` | ver | Detalle con notas |
| `POST` | `/novedades` | registrar | Igual que el de la app (p. ej. el conductor llamó). La llave es opcional, la novedad queda con `reportadaDesde: "web"` y sin alcance. Responde el detalle |
| `POST` | `/novedades/{id}/gestionar` | gestionar | La toma quien llama. Pasa a `en_gestion` |
| `POST` | `/novedades/{id}/notas` | gestionar | `{ texto }` de 1 a 1000 caracteres |
| `POST` | `/novedades/{id}/cerrar` | gestionar | `{ resolucion }` de 10 a 1000 caracteres. Pasa a `cerrada` |

Las tres acciones responden el detalle actualizado. Sobre una novedad cerrada responden
`409 NOVEDAD_CERRADA`, también si otra persona la cerró al mismo tiempo.

Permisos por defecto (migración): los administradores tienen todo y el perfil despachador todo
menos borrar. El Conductor y el Supervisor de flota no tienen nada en la web: reportan desde la
app.

## Avisos (campana y push)

Detalle en [notificaciones-api.md](notificaciones-api.md) §Catálogo. Todos llevan el enlace
`{ tipo: 'novedad', id }`: la app abre `/novedades/{id}` y la web el detalle de la novedad.

| `tipo` | Cuándo | Para quién |
|---|---|---|
| `novedad.reportada` | Al reportarse. Un reintento con la misma llave no avisa otra vez | `novedades.gestionar`, salvo quien la reportó |
| `novedad.critica` | Lo mismo, si es accidente o siniestro. Canal `alertas` y prioridad alta | Los mismos |
| `novedad.en_gestion` | Al tomarla | Quien la reportó |
| `novedad.cerrada` | Al cerrarla, con la resolución | Quien la reportó |

Nadie recibe el aviso de lo que hizo él mismo. Si un aviso no se puede guardar, la acción se hace
igual.

## Pendiente

- **Futuro:** cumplido con suspensión y transbordo desde accidente, varada o siniestro; descuento
  F/D/C prellenado en el cumplido; ajuste de tiempos con motivo 1.
