# Estado del proyecto y cómo continuar en otra máquina

Snapshot para retomar ARRIENDA+ desde cero en otro equipo. Última actualización: jun 2026.

---

## 1. Clonar el repo
```bash
git clone git@github-personal:AndresDFX/arrienda.git
# 'github-personal' es un alias SSH de ~/.ssh/config (cuenta personal). En la máquina nueva:
#  - copia tu llave SSH y agrega el Host alias, o
#  - usa HTTPS: git clone https://github.com/AndresDFX/arrienda.git
```

## 2. Requisitos
- [Bun](https://bun.sh) ≥ 1.3.14 · [Node](https://nodejs.org) ≥ 22 (el scraper/web usan Node)
- [Docker Desktop](https://www.docker.com/) · [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.9
- (Para el scraper) `bunx playwright install chromium` o `npx playwright install chromium`

## 3. Recrear los archivos de entorno (gitignored — NO están en el repo)
Hay 3 archivos de env. Cópialos de sus `.example` y complétalos con las llaves que imprime
`supabase start` (paso 4) y tus credenciales de proveedores.

```bash
cp .env.example .env
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/web/.dev.vars.docker.example apps/web/.dev.vars.docker
```

Qué va en cada uno:
- **`.env`** (raíz; lo usan scripts y el scraper, todos en el host):
  - `VITE_SUPABASE_URL` y `SUPABASE_URL` = `http://127.0.0.1:55321`
  - `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` = **Publishable key** de `supabase start`
  - `SUPABASE_SERVICE_ROLE_KEY` = **Secret key** de `supabase start`
  - `SCRAPER_HEADLESS="false"`, `SCRAPER_TRIGGER_PORT="8787"`, `VITE_SCRAPER_TRIGGER_URL="http://localhost:8787"`
  - Credenciales reales de proveedores autenticados: `CELSIA_EMAIL`, `CELSIA_PASSWORD`, `CELSIA_CUENTA`
  - (Wompi, cuando lo actives) `PAYMENTS_PROVIDER`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_BASE_URL`
- **`apps/web/.dev.vars`** (web corriendo en el host con `bun run dev`): `SUPABASE_URL=127.0.0.1:55321` +
  `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `PAYMENTS_PROVIDER`.
- **`apps/web/.dev.vars.docker`** (web en Docker; se monta sobre `.dev.vars` en el contenedor):
  igual pero `SUPABASE_URL="http://host.docker.internal:55321"` (el worker en el contenedor alcanza
  el Supabase del host por ese nombre). El navegador usa `VITE_SUPABASE_URL=127.0.0.1` (de docker-compose).

> Las llaves locales de Supabase son del entorno de pruebas (defaults compartidos). Cada `supabase start`
> imprime Publishable (`sb_publishable_...`) y Secret (`sb_secret_...`). Pégalas tal cual.

## 4. Levantar el stack
```bash
supabase start                 # imprime URLs + llaves (cópialas a los .env del paso 3)
bun install
supabase migration up          # aplica las 5 migraciones (o `supabase db reset` para recrear + seed)
bun run scripts/seed-users.ts  # usuarios de prueba
bun run scripts/seed-demo.ts   # propiedad + servicio gas (contrato 2910516) + job
docker compose up -d           # web (Node) + Mailpit
node --env-file=.env --experimental-strip-types apps/scraper/src/server.ts  # disparador scraper (deja abierto)
```
URLs: web http://localhost:3000 · Studio http://localhost:55323 · Mailpit http://localhost:8025 · scraper http://localhost:8787

## 5. Usuarios de prueba (password: `Arrienda2026!`)
| Rol | Email |
| --- | --- |
| admin | `admin@arrienda.test` |
| arrendador | `arrendador@arrienda.test` |
| arrendatario | `arrendatario@arrienda.test` |

## 6. Cómo probar
- **Scraper**: en /arrendador → "Scraper · probar proveedores" (o `bun run --cwd apps/scraper test-provider <key> <id>`):
  `gases-de-occidente 2910516` ✅ · `acuavalle 556925` ✅ · `celsia 4016940000` ✅ (usa CELSIA_* del .env) · `aquaservicios 2815001` ⏸️.
- **Fase 0**: arrendador crea contrato → "Generar liquidación" (periodo `2026-06-01`) → arrendatario "Pagar" (mock → `/pago/simulado`).
- **Notificaciones**: `node --env-file=.env --experimental-strip-types apps/scraper/src/notify.ts --fecha 2026-06-30` → correo en Mailpit.
- **Migraciones**: `bun run db:status`.
- **Design system**: http://localhost:3000/design

## 7. Estado actual
| Módulo | Estado |
| --- | --- |
| Fase 0 (auth, propiedades, contratos, liquidación, pago mock) | ✅ |
| Scraper GdO (gas) / Celsia (energía) / Acuavalle (agua) | ✅ |
| AquaServicios (agua) | ⏸️ stand-by (reCAPTCHA v2 — ver LIMITACIONES.md) |
| Notificaciones (config admin+arrendador, job diario, email) | ✅ |
| Design system + responsive | ✅ |
| Wompi gateway (Payment Links + verificación webhook) | ✅ código; ⏳ falta llaves + webhook edge function |
| CI/CD (GitHub Actions), Docker, migraciones, docs | ✅ |

## 8. Pendientes / próximos pasos
1. **Wompi**: pegar llaves sandbox en `.dev.vars.docker` (`PAYMENTS_PROVIDER=wompi` + `WOMPI_*`),
   `docker compose restart web`, probar liquidación → checkout. Implementar webhook como
   **Supabase Edge Function** (`supabase/functions/wompi-webhook`) para marcar `pagada`. Ver WOMPI-INTEGRACION.md.
2. **AquaServicios**: elegir 2captcha (pago) o contingencia manual / humano-en-loop. Ver LIMITACIONES.md.
3. **Notificaciones**: disparar también desde eventos en tiempo real (hoy se encolan y las despacha el job);
   WhatsApp (Cloud API); plantillas de correo.
4. **Fase 2**: pago referenciado a comercializadoras; dispersión multi-destino (convenio Wompi).
5. **Fase 3**: proxies residenciales + solver de captcha para escalar el scraping.

## 9. Gotchas críticos (no re-tropezar)
- Playwright y Vite-CF corren con **Node**, no Bun (en Windows fallan bajo Bun).
- `node_modules` del contenedor en **volúmenes anónimos** (docker-compose) para no romper el host.
- RLS sin recursión vía funciones `SECURITY DEFINER`.
- Supabase local en puertos **553xx**; storage/analytics desactivados en `config.toml`.
- Scraper: headful + IP residencial; el disparador HTTP corre en el host (no en Docker).
- Git remoto: `git@github-personal:AndresDFX/arrienda.git`, rama `main`.
