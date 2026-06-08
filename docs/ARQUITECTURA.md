# ARRIENDA+ — Arquitectura y decisiones técnicas

Complementa el documento de producto (`ARRIENDA+ Concepto y Arquitectura.md`) con las
decisiones de implementación de este repositorio.

## 1. El problema central: scraping vs. Cloudflare free tier

El producto depende de capturar facturas desde portales de comercializadoras
mediante **navegadores headless** (Playwright) con rotación de proxies (doc. §2.2, §5).

Cloudflare **free tier no puede ejecutar esto**:

- Workers no tienen un runtime de navegador persistente ni procesos de larga duración (límites de CPU/tiempo por request).
- *Browser Rendering* de Cloudflare existe pero es de **plan pago** y no sustituye un clúster de scraping con proxies residenciales.

Lo que **sí** corre gratis en Cloudflare: la web, la API/server functions, el cron y la orquestación.

### Decisión: arquitectura híbrida

```
                 ┌─────────────────────────────────────────┐
   Navegador  →  │  Cloudflare Workers (TanStack Start)      │
                 │  · UI por rol  · server functions (API)   │
                 │  · cron (cortes mensuales)                │
                 └───────────────┬───────────────────────────┘
                                 │ service role
                                 ▼
                 ┌─────────────────────────────────────────┐
                 │  Supabase: Postgres + Auth + Storage      │
                 │  · RLS por rol  · cola scraping_jobs       │
                 └───────────────┬───────────────────────────┘
                                 ▲ poll /api/scraper/claim
                                 │ post /api/scraper/result
                 ┌───────────────┴───────────────────────────┐
                 │  Scraper (Playwright) — Docker (Fase 1)    │
                 │  fuera de Cloudflare: local / VM barata     │
                 └─────────────────────────────────────────┘
```

El scraper **no** accede a la base directamente: habla con la API (token compartido),
que escribe con service role. Así el motor frágil queda aislado y reemplazable.

### 1.1 Hosting del scraper (decisión: GitHub Actions)

Como el cobro es **mensual**, no se justifica un servidor 24/7. El scraper se ejecuta
como **job programado de GitHub Actions** ([`.github/workflows/scraper.yml`](../.github/workflows/scraper.yml)):
despierta por `cron`, corre en modo `--once` (reclama los jobs pendientes, los procesa
y termina), dentro de los 2000 min/mes gratis. Cero infraestructura, cero tarjeta.

El mismo contenedor/código porta sin cambios a alternativas si se necesita escala:

| Opción | Cuándo conviene |
| --- | --- |
| **GitHub Actions** *(actual)* | Cortes mensuales/diarios. Cero infra. |
| **Google Cloud Run** | On-demand con más volumen; escala a cero, free tier generoso. |
| **Oracle Cloud Always Free** | Clúster **persistente** con proxies residenciales (Fase 3). Corre `docker compose`. |

El scraper soporta dos modos: `--once` (Actions/cron) y loop de polling (VM persistente).

## 2. Regla de dinero (doc. §4.3) — `packages/shared/src/liquidacion.ts`

- El arrendatario paga **canon + servicios** (la comisión NO se suma encima).
- La comisión (5% del canon) se **descuenta del canon** antes de dispersar al arrendador.
- Los servicios son **pass-through**: van íntegros a cada recaudador.
- **Invariante:** `suma(dispersión) === total que paga el arrendatario`. Se valida en código y está cubierto por tests.

Montos siempre en **pesos enteros** (sin centavos). La lógica vive en `@arrienda/shared`,
sin dependencias de framework, para ser testeable y reutilizable (web y scraper).

## 3. Modelo de datos y seguridad (RLS)

Tablas (migración `supabase/migrations/20260607000001_schema.sql`): `profiles`,
`recaudadores`, `comercializadoras`, `propiedades`, `contratos`, `servicios_publicos`,
`liquidaciones`, `liquidacion_items`, `transacciones`, `extracciones`, `scraping_jobs`.

**RLS** (`..._rls.sql`) implementa la matriz de permisos (doc. §3.4):

- El frontend usa la **anon key** + sesión del usuario → todas las consultas pasan por RLS.
- Las server functions y el scraper usan la **service role key** → bypass de RLS (operaciones de sistema).
- Helpers `is_admin()` / `current_rol()` son `SECURITY DEFINER` para evitar recursión de RLS.
- Un trigger impide que un usuario no-admin se auto-asigne rol (anti escalada de privilegios).

## 4. Pasarela de pagos — patrón puerto/adaptador

- Puerto: [`application/ports/payment-gateway.ts`](../apps/web/src/application/ports/payment-gateway.ts) — `PaymentGateway` (crearRecaudo + verificarWebhook).
- Adaptadores: [`infrastructure/payments/mock.ts`](../apps/web/src/infrastructure/payments/mock.ts) (Fase 0, sin mover dinero),
  [`wompi.ts`](../apps/web/src/infrastructure/payments/wompi.ts) (Payment Links + verificación de firma),
  [`factory.ts`](../apps/web/src/infrastructure/payments/factory.ts) (selección por `PAYMENTS_PROVIDER`).

ARRIENDA+ **no retiene dinero** (doc. §2.3): la pasarela recauda y dispersa bajo mandato.

## 4.1 Clean Architecture en `apps/web`

La lógica de negocio se organiza en capas con la **dependencia apuntando hacia adentro**
(el dominio no conoce nada de fuera; el framework está en el borde):

```
  presentation/  → infrastructure/ → application/ → domain (@arrienda/shared)
  (TanStack,         (Supabase,        (casos de uso     (entidades + reglas:
   rutas React)       pasarelas)         + puertos)         dinero, liquidación)
```

| Capa | Carpeta | Responsabilidad | Depende de |
| --- | --- | --- | --- |
| **Dominio** | `packages/shared` | Entidades y reglas puras (comisión, liquidación, notificaciones). Sin framework. | nada |
| **Aplicación** | `apps/web/src/application` | Casos de uso (`generar-liquidacion`, `confirmar-pago`) + **puertos** (repos, `PaymentGateway`) + errores. | dominio |
| **Infraestructura** | `apps/web/src/infrastructure` | Adaptadores que implementan los puertos: repos Supabase, pasarelas (mock/wompi). | aplicación |
| **Presentación** | `apps/web/src/presentation`, `routes/`, `components/` | server functions (transporte) que cablean infra → caso de uso; UI React. | aplicación + infra |

**Por qué:** los casos de uso no importan Supabase ni TanStack; reciben sus dependencias
por inyección (`makeSupabaseRepositories(db)` + `getPaymentGateway()` en la presentación), así
que la regla de negocio es testeable con dobles en memoria y la BD/pasarela son reemplazables.
La lectura para la UI (`lib/data.ts`) usa Supabase con la sesión del usuario (RLS) — es el
adaptador de lectura del lado cliente.

> El **scraper** (`apps/scraper`) sigue el mismo espíritu hexagonal: el puerto `Provider`
> (`providers/types.ts`) con adaptadores por comercializadora, la cola (`queue.ts`) como
> infraestructura y el worker (`index.ts`) como orquestador.

## 5. Modelo de variables y secretos

| Tipo | Dónde | Ejemplos |
| --- | --- | --- |
| Público (cliente) | `VITE_*` (bundle) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Secreto (servidor) | `.dev.vars` local / `wrangler secret` prod | `SUPABASE_SERVICE_ROLE_KEY`, `WOMPI_*` |
| Scraper | `.env` del contenedor | `SCRAPER_API_TOKEN`, `SCRAPER_PROXY_URL` |

En el Worker, `nodejs_compat` expone las vars vía `process.env`.

## 6. Mapeo a fases (doc. §7)

- **Fase 0** *(implementado como scaffold)*: dominio + esquema + RLS + adaptador mock + UI base + CI/CD.
- **Fase 1**: extractores Playwright reales + endpoints `/api/scraper/claim` y `/result` + cron que encola jobs.
- **Fase 2**: pago referenciado a comercializadoras (códigos de recaudo) vía convenios de la pasarela.
- **Fase 3**: proxies residenciales, CAPTCHAs, mora, conciliación, contingencia manual (doc. §5.3).

## 7. Cumplimiento (doc. §8) — recordatorios para producto/legal

1. El scraping puede violar los ToS de las comercializadoras (riesgo de bloqueo de IP / cese).
2. No captación: el dinero solo se mueve bajo mandato de la pasarela.
3. Tratamiento de datos: consentimiento explícito del arrendador para actuar como robot en su nombre.
4. ARRIENDA+ es facilitador de pagos, sin responsabilidad solidaria por impago/corte.
