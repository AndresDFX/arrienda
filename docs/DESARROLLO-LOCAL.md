# Desarrollo local — usuarios, seeds y cómo probar

ARRIENDA+ es una plataforma de arriendos + servicios públicos para **toda Colombia**.
Esta guía deja todo listo para probar en local.

## Requisitos
- [Bun](https://bun.sh) ≥ 1.3 · [Node](https://nodejs.org) ≥ 22 (el scraper corre con Node)
- [Docker](https://www.docker.com/) · [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.9

## Arranque (paso a paso)
```powershell
# 1) Base de datos + Auth (Supabase local en Docker)
supabase start

# 2) Dependencias + migraciones + datos de prueba
bun install
supabase migration up          # aplica las migraciones (o `supabase db reset` para recrear)
bun run scripts/seed-users.ts  # usuarios de prueba (ver abajo)
bun run scripts/seed-demo.ts   # propiedad + servicio de gas + job de scraping

# 3) Web (Docker, Node) + Mailpit
docker compose up -d           # http://localhost:3000

# 4) Disparador del scraper (en su propia terminal; headful, déjala abierta)
node --env-file=.env --experimental-strip-types apps/scraper/src/server.ts
```

### URLs locales
| Servicio | URL |
| --- | --- |
| Web (app) | http://localhost:3000 |
| Supabase Studio | http://localhost:55323 |
| Mailpit (correos) | http://localhost:8025 |
| Disparador scraper | http://localhost:8787 |

## Usuarios de prueba
Creados por `scripts/seed-users.ts`. **Password (todos):** `Arrienda2026!`

| Rol | Email | Para qué |
| --- | --- | --- |
| Administrador | `admin@arrienda.test` | Entidades maestras, comisiones, supervisión |
| Arrendador | `arrendador@arrienda.test` | Propiedades, contratos, generar liquidaciones, scraper |
| Arrendatario | `arrendatario@arrienda.test` | Ver liquidaciones y pagar |

> Modelo: **un rol por usuario** (enum + RLS). Estos tres cubren todos los flujos.

## Seeds
- **`scripts/seed-users.ts`** — crea los 3 usuarios vía Supabase Auth (admin API) con su rol.
- **`scripts/seed-demo.ts`** — crea una **propiedad** del arrendador (modalidad `completo`), un **servicio de gas** (Gases de Occidente, contrato `2910516`) y un **job de scraping** pendiente para el periodo `2026-06-01`. Ejecuta el scraper para poblar la extracción.
- **`supabase/seed.sql`** — catálogos base (recaudadores y comercializadoras: Celsia, Emcali, Gases de Occidente). Se aplica con `supabase db reset`.

## Proveedores de scraping (números de prueba)
El disparador (`apps/scraper/src/server.ts`, `GET /providers`, `POST /run`) y el CLI
`bun run --cwd apps/scraper test-provider <key> <id>`:

| Proveedor | Tipo | Número de prueba | Estado |
| --- | --- | --- | --- |
| `gases-de-occidente` | gas | `2910516` | ✅ extrae ($17.556) |
| `celsia` | energía | `4016940000` | ✅ extrae (requiere `CELSIA_EMAIL`/`CELSIA_PASSWORD` en `.env`) |
| `acuavalle` | agua | `556925` | ✅ extrae ($0, al día) |
| `aquaservicios` | agua | `2815001` | ⚠️ reCAPTCHA v2 (requiere solver/manual) |

## Probar el flujo en el navegador
1. http://localhost:3000 → **Ingresar** como `arrendador@arrienda.test`.
2. **Scraper · probar proveedores** → elige proveedor + número → **Lanzar scraper** (abre Chromium, muestra el valor).
3. **Contratos** → **Generar liquidación** (periodo `2026-06-01`): consolida canon + servicios extraídos → comisión 5% → dispersión.
4. Ingresar como `arrendatario@arrienda.test` → **Mis liquidaciones** → **Pagar** (mock) → estado `pagada`.

## Migraciones (local y cloud)
```powershell
bun run db:status     # muestra migraciones aplicadas vs locales (sale 1 si hay pendientes)
# Cloud: SUPABASE_DB_URL="postgresql://postgres:[pass]@db.<ref>.supabase.co:5432/postgres" bun run db:status
```
Para subir a Supabase Cloud: `supabase link --project-ref <ref>` → `supabase migration list` → `supabase db push`.

## Variables sensibles
`.env`, `apps/web/.dev.vars` y `apps/web/.dev.vars.docker` están en `.gitignore`.
Plantillas: `.env.example` y `apps/web/.dev.vars.example`.
