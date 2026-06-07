# CLAUDE.md — Contexto del proyecto ARRIENDA+

Guía para asistentes de IA que trabajen en este repositorio.

## Qué es

Plataforma de gestión y recaudo de arriendos con servicios públicos para **toda Colombia**.
Tres roles (admin, arrendador, arrendatario), comisión del 5% **solo sobre el canon**,
servicios públicos como pass-through. Producto: `ARRIENDA+ Concepto y Arquitectura.md`.
Arquitectura: `docs/ARQUITECTURA.md`. **Cómo correr en local + usuarios + seeds: `docs/DESARROLLO-LOCAL.md`.**

## Stack

TanStack Start (React 19) + Vite → **Cloudflare Workers** · Supabase (Postgres + Auth + RLS) ·
shadcn/ui (new-york) + Tailwind v4 · TanStack Query · React Hook Form · Zod · Bun workspaces.
Scraper: Playwright (Node). Marca: teal/esmeralda + *Plus Jakarta Sans*, logo en `components/brand/logo.tsx`.

## Layout

- `apps/web` — app principal (frontend + server functions). Deploy a Cloudflare. En local
  corre en Docker con imagen **Node** (Vite + plugin Cloudflare NO funciona bajo Bun).
- `apps/scraper` — motor de scraping. **No corre en Cloudflare ni en contenedor**: necesita
  Chromium **headful + IP residencial** (anti-bot). Corre en host con Node:
  - `providers/` — abstracción `Provider` categorizada por tipo (energia/gas/agua) + registro.
    Proveedores: Gases de Occidente (gas), Celsia (energia, autenticada), Acuavalle (agua),
    AquaServicios (agua, bloqueado por reCAPTCHA v2). Ver `docs/scraper` en memoria.
  - `server.ts` = disparador HTTP (`/run`, `/providers`); `index.ts` = worker de cola (`--once`).
- `packages/shared` — dominio puro: tipos, schemas Zod, liquidación/dispersión, notificaciones (+ tests).
- `supabase/` — `config.toml`, `migrations/` (5), `seed.sql`. Migraciones: `bun run db:status`.
- `scripts/` — seed-users, seed-demo, migration-status, smoke-fase0.
- `docs/` — ARQUITECTURA, DESARROLLO-LOCAL, WOMPI-INTEGRACION, NOTIFICACIONES.

## Comandos

```bash
supabase start                              # DB/Auth local
bun install
supabase migration up                       # aplicar migraciones
bun run scripts/seed-users.ts               # usuarios admin/arrendador/arrendatario
bun run scripts/seed-demo.ts                # propiedad + servicio + job
docker compose up -d                        # web (Node) + Mailpit -> localhost:3000
node --env-file=.env --experimental-strip-types apps/scraper/src/server.ts   # disparador scraper (headful)
bun run db:status                           # migraciones aplicadas vs locales
bun run --cwd apps/scraper test-provider <key> <id>   # probar un scraper
bun run test                                # tests del dominio (packages/shared)
```

## Convenciones y "gotchas"

- **Dinero**: enteros en pesos. Lógica de comisión/dispersión SOLO en `@arrienda/shared`.
- **Invariante**: `suma(dispersión) === total` (cubierto por test).
- **RLS**: cliente usa anon key (RLS aplica); server functions/scraper usan service role (bypass).
  Relaciones cruzadas en RLS se resuelven con funciones `SECURITY DEFINER` (evitan recursión).
- **Runtimes**: la web corre con **Node** en Docker (no Bun); el scraper con **Node** (Playwright
  falla bajo Bun). Bun solo instala/ejecuta tareas que no usan Playwright/Vite-CF.
- **Docker + node_modules**: los `node_modules` del contenedor van en **volúmenes anónimos**
  (compose) para no pisar los del host por el bind-mount.
- **Env**: cliente = `VITE_*`; servidor local = `.dev.vars` (host) / `.dev.vars.docker` (contenedor,
  usa `host.docker.internal`); prod = `wrangler secret`. Expuestas vía `process.env`.
- **Scraper anti-bot**: reCAPTCHA invisible/Turnstile pasan headful+residencial; reCAPTCHA **v2
  checkbox** NO (necesita 2captcha o captura manual). Celsia: leer "Estado de cuenta" (pagos tiene captcha).
- **Enums duplicados**: `packages/shared/src/domain.ts` debe coincidir con los tipos SQL.
- **`routeTree.gen.ts`**: generado por el plugin en `vite dev`/`build` (gitignored).
- **Estilo**: Prettier (sin `;`, comillas simples). `bun run format`.
