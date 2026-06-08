# Design System — ARRIENDA+

Sistema de diseño de la app web (`apps/web`). Showcase en vivo: **`/design`**.

## Tokens
Definidos en [src/styles.css](../apps/web/src/styles.css) como variables CSS (oklch) +
mapeadas a Tailwind v4 vía `@theme inline`.

- **Color**: `--primary` (teal), `--accent`, `--secondary`, `--muted`, `--destructive`,
  `--border`, `--ring`, `--card`, `--background`, `--foreground`. Marca: `--brand`, `--brand-2`,
  `--brand-accent`. Light + dark.
- **Radio**: `--radius` (0.75rem) → `rounded-sm|md|lg|xl`.
- **Tipografía**: `--font-sans` = *Plus Jakarta Sans* (cargada en `__root`).
- **Utilidades de marca**: `brand-gradient` (fondo degradado), `text-brand-gradient` (texto degradado).

## Componentes UI ([src/components/ui](../apps/web/src/components/ui))
- **Button** — variantes: `default | secondary | outline | ghost | destructive | link`; tamaños `sm | default | lg | icon`; soporta `asChild`.
- **Card** (+ Header/Title/Description/Content/Footer).
- **Input**, **Label**, **Select** (nativo estilizado con chevron).
- **Badge** — `default | secondary | success | warning | destructive | outline` (estados de liquidación).

## Marca ([src/components/brand/logo.tsx](../apps/web/src/components/brand/logo.tsx))
- `LogoMark` (casa + "+", SVG en degradado) y `Logo` (marca + wordmark "Arrienda+").

## Layout / primitivas ([src/components/layout.tsx](../apps/web/src/components/layout.tsx))
- **PageContainer** — `max-w-5xl` + padding responsive (`px-4 sm:px-6 · py-8 sm:py-10`).
- **PageHeader** — título + subtítulo + acción (apila en móvil).
- **Section** — sección con título.
- **Field** — label + control apilados.
- **FormGrid** — grilla `1 → 2 → 3` columnas (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`).

## Responsive
- Móvil primero: grids colapsan a 1 columna (`sm:`/`md:` para 2-3).
- Nav: el nombre del usuario se oculta en móvil (`hidden sm:inline`); logo + acciones siempre visibles.
- Formularios densos (contratos) apilan en móvil.
- Contenedores con padding responsive vía `PageContainer`.
- Páginas centradas (login/signup/pago) usan `max-w-md` y funcionan en cualquier ancho.

## Uso
```tsx
import { PageContainer, PageHeader, Section, Field } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

<PageContainer className="space-y-8">
  <PageHeader title="Mi panel" subtitle="..." action={<Button>Acción</Button>} />
  <Section title="Sección">
    <Field label="Ciudad"><Select>...</Select></Field>
  </Section>
</PageContainer>
```
Convención de estilo: Prettier (sin `;`, comillas simples). Iconos: `lucide-react`.
