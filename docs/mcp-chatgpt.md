# Conectar el MCP a ChatGPT (túnel local open-source)

El servidor MCP corre en local en `http://localhost:3002/mcp`. Para que ChatGPT
pueda alcanzarlo, se expone un **proxy autenticado** mediante Cloudflare Tunnel
(cloudflared, open-source, licencia BSD-3-Clause). El túnel apunta al proxy, no
al servidor abierto.

## Arquitectura

```text
ChatGPT / agente externo
        │  HTTPS + Bearer token
        ▼
https://<tunnel>.trycloudflare.com/mcp
        │  cloudflared (túnel, open-source)
        ▼
127.0.0.1:3003/mcp   → proxy con autenticación Bearer + Streamable HTTP
        │  loopback
        ▼
127.0.0.1:3002/mcp   → servidor MCP real (video-skill)
```

## Estado actual

- Endpoint público: `https://begin-cole-size-caring.trycloudflare.com/mcp`
- Autenticación: **Bearer token**
- Token: ver `~/.video-skill/mcp-tunnel-token` (chmod 600)
- Sin token → `401 Unauthorized`. Con token → `200 OK`.

> La URL de quick tunnel es efímera: cambia cada vez que se reinicia
> `cloudflared`. Para una URL estable, usa un túnel nombrado con cuenta de
> Cloudflare.

## Configuración en ChatGPT

Settings → Plugins / Connectors → Create app → MCP:

- **URL**: `https://begin-cole-size-caring.trycloudflare.com/mcp`
- **Authentication**: Bearer / API key → pega el token de
  `~/.video-skill/mcp-tunnel-token`

## Herramientas expuestas

`extract`, `compile`, `validate`, `list_collections`, `run_workflow`,
`workflow_status`, `list_workflows`.

Flujo recomendado desde el agente:

1. `run_workflow({ url })` → devuelve un `id`.
2. `workflow_status({ id })` → hilo del agente, pasos y skill terminado.
3. El dashboard local `http://localhost:3002/` detecta el run y muestra el
   resultado al final.

## Levantar de nuevo

```bash
# 1. servidor MCP local (si no está corriendo)
node -e "import { start } from './packages/server/src/index.js'; start(3002);"

# 2. proxy autenticado
node scripts/mcp-external-proxy.mjs

# 3. túnel open-source
cloudflared tunnel --url http://127.0.0.1:3003 --no-autoupdate
```

El token se regenera en cada arranque del proxy y se guarda en
`~/.video-skill/mcp-tunnel-token`. Para fijar uno propio:

```bash
MCP_TUNNEL_TOKEN=<tu-token> node scripts/mcp-external-proxy.mjs
```

## Seguridad

- El túnel expone **solo** el proxy autenticado; el MCP local sigue en loopback.
- El proxy usa `timingSafeEqual` para el token y responde `401` sin él.
- No pongas secretos en el repositorio; el token vive fuera del repo.
- Quick tunnels no tienen garantía de uptime; úsalos solo para desarrollo/prueba.
