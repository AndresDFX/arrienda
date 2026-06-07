# CLAUDE.md — Contexto del proyecto ARRIENDA+

Guía para asistentes de IA que trabajen en este repositorio.

## Qué es

Plataforma colombiana de gestión y recaudo de arriendos con servicios públicos.
Tres roles (admin, arrendador, arrendatario), comisión del 5% **solo sobre el canon**,
servicios públicos como pass-through. Producto: `ARRIENDA+ Concepto y Arquitectura.md`.
Arquitectura: `docs/ARQUITECTURA.md`.

## Stack

TanStack Start (React 19) + Vite → **Cloudflare Workers** · Supabase (Postgres + Auth + RLS) ·
shadcn/ui (new-york) + Tailwind v4 · TanStack Query · React Hook Form · Zod · Bun workspaces.
Scraper: Playwright en Docker.

## Layout

- `apps/web` — app principal (frontend + server functions). Deploy a Cloudflare.
- `apps/scraper` — motor Playwright (Fase 1). **No corre en Cloudflare**; corre como job
  programado de **GitHub Actions** ([.github/workflows/scraper.yml](.github/workflows/scraper.yml))
  en modo `--once` (drena jobs y termina). Modo loop disponible para VM persistente (Oracle).
- `packages/shared` — dominio puro: tipos, schemas Zod, cálculo de liquidación/dispersión (+ tests).
- `supabase/` — `config.toml`, `migrations/`, `seed.sql`.

## Comandos

```bash
bun install
bun run db:start          # Supabase local (Docker)
bun run dev               # web en http://localhost:3000
bun run test              # tests del dominio (packages/shared)
bun run docker:up         # Mailpit + scraper
cd apps/web && bun run deploy   # build + deploy a Cloudflare
```

## Convenciones y "gotchas"

- **Dinero**: siempre enteros en pesos (sin centavos). La lógica de comisión/dispersión
  está SOLO en `@arrienda/shared` — no la dupliques en la UI ni el scraper.
- **Invariante de liquidación**: `suma(dispersión) === total`. Hay test que lo cubre.
- **RLS**: el cliente usa anon key (pasa por RLS); las server functions usan
  `createAdminClient()` (service role, bypass). No uses service role en el cliente.
- **Enums duplicados**: los enums de `packages/shared/src/domain.ts` deben coincidir
  con los tipos SQL en `supabase/migrations`. Cambia ambos a la vez.
- **`routeTree.gen.ts`**: lo genera `@tanstack/router-plugin` en `vite dev`/`build`.
  Está en `.gitignore`; si el editor lo marca como faltante antes del primer build, es normal.
- **Env**: cliente = `VITE_*`; servidor = `.dev.vars` (local) / `wrangler secret` (prod);
  expuestas en el Worker vía `process.env` (nodejs_compat).
- **Pasarela**: patrón puerto/adaptador en `apps/web/src/server/payments`. Fase 0 = `mock`.
- **Estilo**: Prettier (sin punto y coma, comillas simples). `bun run format`.
