# ARRIENDA+

Plataforma de gestión y recaudo de arriendos con servicios públicos en **Colombia**.
Tres roles · recaudo automático · comisión del 5% sobre el canon.

> Documento de producto: [`ARRIENDA+ Concepto y Arquitectura.md`](./ARRIENDA+%20Concepto%20y%20Arquitectura.md)
> Decisiones técnicas: [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md)

---

## ⚠️ Restricción clave de arquitectura

El motor de **Web Scraping** (navegadores headless + proxies, doc. §2.2 / §5) **no puede correr en Cloudflare free tier** (los Workers no tienen runtime de navegador ni procesos largos). Por eso la arquitectura es **híbrida**:

| Componente | Dónde corre | Free tier |
| --- | --- | --- |
| Web + API + lógica de negocio + cron | **Cloudflare Workers** (TanStack Start) | ✅ |
| Base de datos + Auth + Storage | **Supabase** | ✅ |
| Motor de scraping (Playwright) | **GitHub Actions** (cron, `--once`) · alt: Oracle/Cloud Run | ⚠️ fuera de CF |

La **Fase 0 (core financiero)** es 100% desplegable en Cloudflare free tier hoy. El scraper se activa en **Fase 1** como worker independiente que consume jobs vía API.

---

## Stack

- **Frontend + Server Functions:** [TanStack Start](https://tanstack.com/start) (React 19) + Vite
- **Deploy:** Cloudflare Workers (`@cloudflare/vite-plugin`)
- **DB + Auth + Storage:** Supabase (Postgres + RLS)
- **UI:** shadcn/ui (new-york) + Tailwind CSS v4
- **Datos/forms:** TanStack Query · React Hook Form · Zod
- **Scraper:** Playwright (TypeScript) en Docker
- **Runtime/monorepo:** Bun workspaces

## Estructura

```
arrienda+/
├─ apps/
│  ├─ web/        TanStack Start (frontend + server fns) → Cloudflare Workers
│  └─ scraper/    Motor Playwright (Fase 1) → Docker, NO Cloudflare
├─ packages/
│  └─ shared/     Dominio: tipos, schemas Zod, cálculo de liquidación/dispersión (+ tests)
├─ supabase/      config.toml + migrations (esquema + RLS) + seed
├─ docker-compose.yml
└─ .github/workflows/   CI + Deploy (Cloudflare + Supabase)
```

## Requisitos

- [Bun](https://bun.sh) ≥ 1.3
- [Docker](https://www.docker.com/) (para Supabase local y el scraper)
- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.9
- Cuenta gratuita de Cloudflare y de Supabase (para desplegar)

## Puesta en marcha (local)

```bash
# 1. Dependencias
bun install

# 2. Base de datos + Auth local (levanta el stack de Supabase en Docker)
bun run db:start            # imprime URLs y llaves (anon + service_role)

# 3. Configura entorno
cp .env.example .env
cp apps/web/.dev.vars.example apps/web/.dev.vars
#   Pega las URLs/llaves que imprimió `supabase start` en .env y .dev.vars

# 4. App web (host, con HMR)
bun run dev                 # http://localhost:3000

# 5. (Opcional) Servicios en Docker: Mailpit + scraper
bun run docker:up           # Mailpit UI en http://localhost:8025
```

> **Tip:** Supabase Studio queda en `http://localhost:54323`. Crea usuarios de prueba
> en Authentication y asígnales rol con: `update public.profiles set rol='admin' where id='...'`.

### Migraciones y seed

```bash
bun run db:reset            # recrea el esquema + RLS + seed (supabase/seed.sql)
bun run db:diff             # genera migración a partir de cambios locales
```

## Pruebas y calidad

```bash
bun run test                # tests del dominio (lógica de comisión/liquidación)
bun run lint
bun run --cwd packages/shared typecheck
```

## Despliegue (Cloudflare free tier + Supabase)

El pipeline [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) aplica migraciones a Supabase y despliega el Worker. Configura en GitHub:

- **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`
- **Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Deploy manual:

```bash
cd apps/web && bun run deploy        # vite build && wrangler deploy
```

## Hoja de ruta (doc. §7)

- **Fase 0 — Core financiero** *(este scaffold)*: propiedades, contratos, liquidación del canon, comisión 5%, pasarela + dispersión. Sin scraping.
- **Fase 1 — Motor de scraping:** extractores Playwright para comercializadoras de la región; liquidaciones consolidadas. Corre como job programado de **GitHub Actions** ([`scraper.yml`](.github/workflows/scraper.yml), modo `--once`). Local: `bun run --cwd apps/scraper once`.
- **Fase 2 — Pago referenciado:** pago automático a comercializadoras vía convenios de la pasarela.
- **Fase 3 — Resiliencia y escala:** proxies residenciales, CAPTCHAs, mora y conciliación.
