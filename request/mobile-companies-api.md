# API de empresas para la app móvil

Primer paso de la app móvil de Longistik: el usuario elige la empresa para la que trabaja y la app lo lleva al login de esa empresa. Cualquier persona puede instalar la app, así que esta lista es pública.

```
App móvil ──► Panel  GET /api/public/companies      (sin sesión)
    │
    └──► Longistik de la empresa elegida (apiUrl)   login y todo lo demás
```

El panel solo dice **a dónde** ir. El login, los usuarios y los datos siguen en el Longistik de cada empresa.

## Endpoint

```
GET https://api.panel.longistik.com/api/public/companies
GET https://api.panel.longistik.com/api/public/companies?q=servi
```

- Sin autenticación. Una llave guardada dentro de la app no sería secreta, por eso no se pide.
- `q` (opcional): filtra por código o nombre; no distingue mayúsculas.
- Solo salen empresas **activas**. Las suspendidas, en aprovisionamiento o eliminadas no aparecen.
- Respuesta con `Cache-Control: public, max-age=300`: la app puede reutilizarla durante 5 minutos.

### Respuesta `200`

```json
{
  "companies": [
    {
      "code": "servicargas360",
      "name": "Servicargas 360 S.A.S.",
      "apiUrl": "https://api.servicargas360.longistik.com",
      "webUrl": "https://servicargas360.longistik.com"
    }
  ]
}
```

| Campo | Uso |
|---|---|
| `code` | Identificador fijo de la empresa. Es el que la app debe guardar para recordar la elección. |
| `name` | Nombre para mostrar (razón social; si no está cargada, el código). |
| `apiUrl` | Base del backend de esa empresa. La app hace el login y todas las llamadas contra esta URL. |
| `webUrl` | Longistik web de la empresa (enlaces de "olvidé mi contraseña", soporte, etc.). |

Si no hay empresas activas, o ninguna coincide con `q`, `companies` llega vacío. Los errores tienen la forma `{ "message": "…" }`.

## Recomendaciones para la app

1. Guardar `code` y `apiUrl` de la empresa elegida, para no pedirla en cada arranque. Ofrecer "Cambiar de empresa" en la pantalla de login.
2. En cada arranque, refrescar la lista en segundo plano. Si el `code` guardado ya no aparece (empresa suspendida), cerrar sesión y volver al selector.
3. No armar URLs a partir del `code`: usar siempre `apiUrl` tal cual llega, porque los dominios pueden cambiar.

## Pruebas manuales

```bash
curl -s https://api.panel.longistik.com/api/public/companies
curl -s "https://api.panel.longistik.com/api/public/companies?q=servi"
```
