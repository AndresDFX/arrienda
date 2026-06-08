# CLAUDE.md — Contexto del proyecto ARRIENDA+

Guía para asistentes de IA (y humanos) que trabajen en este repo. Mantener al día.
**Para continuar en otra máquina y ver el estado/pendientes:** `docs/ESTADO.md`.

## Qué es
Plataforma de gestión y recaudo de arriendos con servicios públicos para **toda Colombia**.
Tres roles (admin, arrendador, arrendatario). Modelo: **comisión 5% solo sobre el canon**;
los servicios públicos (energía/agua/gas) son **pass-through** (sin sobreprecio). La plataforma
no retiene fondos (orquestador de pagos). Documento de producto: `ARRIENDA+ Concepto y Arquitectura.md`.

## Stack y runtimes (importante)
- **Web** (`apps/web`): TanStack Start (React 19) + Vite → **Cloudflare Workers**; Supabase
  (Postgres + Auth + RLS); shadcn/ui (new-york) + Tailwind v4; TanStack Query; React Hook Form; Zod.
  - En LOCAL corre en **Docker con imagen Node** (no Bun: Vite + plugin Cloudflare usa WebSocket
    `upgrade` que Bun no implementa). Bun solo instala.
- **Scraper** (`apps/scraper`): Playwright. **No corre en Cloudflare ni en contenedor**: necesita
  **Chromium headful + IP residencial** (anti-bot). Corre en el host con **Node** (Playwright falla
  bajo Bun en Windows). Se ejecuta con `node --experimental-strip-types`.
- **Dominio** (`packages/shared`): TS puro (sin framework), testeado con Vitest.
- Monorepo **Bun workspaces**. Marca: teal/esmeralda + *Plus Jakarta Sans*; logo en `components/brand/logo.tsx`.

## Estructura
- `apps/web/src/` — **Clean Architecture** (dependencias hacia adentro; ver docs/ARQUITECTURA.md §4.1):
  - **dominio** = `@arrienda/shared` (entidades + reglas puras).
  - `application/` — casos de uso (`use-cases/generar-liquidacion`, `confirmar-pago`) + puertos
    (`ports/repositories.ts`, `ports/payment-gateway.ts`) + `errors.ts`. Sin framework ni Supabase.
  - `infrastructure/` — adapters: `supabase/` (`admin.ts` cliente service-role + `getCallerUser`;
    `repositories.ts` implementa los puertos) y `payments/` (`mock`, `wompi`, `factory`).
  - `presentation/server/` — server functions de TanStack delgadas (`liquidacion.ts`, `pagos.ts`)
    que cablean infra → caso de uso. UI también es presentación:
  - `routes/` — `__root.tsx` (providers + nav), `index.tsx` (landing), `login`/`signup`, `admin`,
    `arrendador`, `arrendatario`, `pago.simulado`, `design` (showcase del design system).
  - `components/` — `ui/` (button, card, input, label, select, badge), `layout.tsx`
    (PageContainer/PageHeader/Section/Field/FormGrid), `brand/logo.tsx`, `notif-config-form.tsx`.
  - `lib/` — `auth.tsx` (sesión/roles), `data.ts` (lectura para la UI: Supabase con RLS),
    `supabase/client.ts` (cliente navegador), `env.ts`.
- `apps/scraper/src/`
  - `providers/` — `types.ts` (interfaz `Provider` categorizada por tipo + registro), `index.ts`
    (registra todos + `credencialesDeProveedor`), `gases-de-occidente.ts`, `celsia.ts`, `acuavalle.ts`,
    `aquaservicios.ts`.
  - `index.ts` (worker de cola, modo `--once`/loop), `server.ts` (disparador HTTP: `/run`, `/providers`),
    `notify.ts` (job de notificaciones de corte → email), `queue.ts` (RPCs de cola), `config.ts`, `browser.ts`
    (contexto stealth), recon/test: `inspect.ts`, `extract.ts`, `recon-*.ts`, `test-provider.ts`, `shot.ts`.
- `packages/shared/src/` — `domain.ts` (enums), `money.ts`, `liquidacion.ts`, `notificaciones.ts`, `schemas.ts` (+ tests).
- `supabase/` — `config.toml` (puertos remapeados a **553xx**), `migrations/` (6), `seed.sql`.
- `.github/workflows/` — `ci.yml` (lint/test/typecheck/build) **activo**; `deploy.yml.disabled` y
  `scraper.yml.disabled` **desactivados** (no se sube a cloud aún; re-activar quitando `.disabled`).
- `scripts/` — `seed-users.ts`, `seed-demo.ts` (gas GdO), `seed-celsia.ts` (energía Celsia con
  credenciales por servicio, leídas del `.env`), `migration-status.ts`, `smoke-fase0.ts`, `run-scraper.ps1`.
- `docs/` — ESTADO, DESARROLLO-LOCAL, ARQUITECTURA, DESIGN-SYSTEM, NOTIFICACIONES, WOMPI-INTEGRACION, LIMITACIONES.

## Cómo correr (resumen; detalle en docs/DESARROLLO-LOCAL.md)
```bash
supabase start                 # DB/Auth local (Docker)
bun install
supabase migration up          # aplica migraciones
bun run scripts/seed-users.ts  # usuarios admin/arrendador/arrendatario (pass Arrienda2026!)
bun run scripts/seed-demo.ts   # propiedad + servicio gas + job
docker compose up -d           # web (Node) + Mailpit -> http://localhost:3000
node --env-file=.env --experimental-strip-types apps/scraper/src/server.ts  # disparador scraper
bun run db:status              # estado de migraciones (local o cloud via SUPABASE_DB_URL)
```
**Envs (gitignored — recrear desde los `.example` + las llaves que imprime `supabase start`):**
`.env` (raíz, scripts/scraper), `apps/web/.dev.vars` (web en host), `apps/web/.dev.vars.docker`
(web en Docker; usa `host.docker.internal:55321`). Ver `docs/ESTADO.md`.

## Estado por módulo
- **Fase 0** (auth, propiedades, contratos, liquidación canon+servicios, pago mock): ✅ funcional.
- **Scraper** (providers categorizados): GdO/gas ✅ · Celsia/energía ✅ (vía "Estado de cuenta") ·
  Acuavalle/agua ✅ · **AquaServicios/agua ⏸️ stand-by** (reCAPTCHA v2; ver LIMITACIONES.md).
- **Notificaciones**: ✅ esquema + lógica + job `notify` (email Mailpit) + UI config (admin global + arrendador override).
- **Design system + responsive**: ✅ (showcase en `/design`).
- **Wompi**: gateway implementado (Payment Links + verificación webhook) + UI cableada;
  **pendiente: llaves sandbox + webhook (Supabase Edge Function)**. Ver WOMPI-INTEGRACION.md.

## Gotchas (lecciones ganadas)
- **Playwright = Node, no Bun** (Bun+Playwright falla al lanzar en Windows). **Web Vite = Node**, no Bun.
- **Docker node_modules en volúmenes anónimos** (compose) para no pisar los del host por el bind-mount.
- **RLS**: relaciones cruzadas vía funciones `SECURITY DEFINER` (evitan recursión). Cliente=anon (RLS aplica);
  server fns/scraper=service role (bypass).
- **Anti-bot por proveedor**: reCAPTCHA invisible/Turnstile pasan headful+residencial; reCAPTCHA **v2 checkbox NO**.
- **Supabase local en puertos 553xx** (remapeados para convivir con otro proyecto Supabase). storage/analytics
  desactivados en `config.toml` (no necesarios; analytics fallaba en Windows).
- **Dinero**: enteros en pesos; lógica de comisión/dispersión SOLO en `@arrienda/shared` (invariante `suma(dispersión)===total`).
- **Estilo**: Prettier (sin `;`, comillas simples). Iconos: lucide-react.

## Git
Remoto: `git@github-personal:AndresDFX/arrienda.git` (alias SSH `github-personal`). Rama `main`.
