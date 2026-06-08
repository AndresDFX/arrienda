import { createFileRoute } from '@tanstack/react-router'
import { Logo, LogoMark } from '@/components/brand/logo'
import { PageContainer, PageHeader, Section, Field } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/design')({ component: DesignSystem })

const COLORS = [
  { name: 'brand-gradient', cls: 'brand-gradient' },
  { name: 'primary', cls: 'bg-primary' },
  { name: 'accent', cls: 'bg-accent' },
  { name: 'secondary', cls: 'bg-secondary' },
  { name: 'muted', cls: 'bg-muted' },
  { name: 'destructive', cls: 'bg-destructive' },
]

function DesignSystem() {
  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title="Design System · ARRIENDA+"
        subtitle="Tokens y componentes reutilizables de la plataforma."
        action={<Logo />}
      />

      <Section title="Marca">
        <div className="flex flex-wrap items-center gap-6">
          <LogoMark className="size-14" />
          <Logo markClassName="size-10" />
          <span className="text-brand-gradient text-3xl font-extrabold">Arrienda+</span>
        </div>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {COLORS.map((c) => (
            <div key={c.name} className="space-y-1.5">
              <div className={`${c.cls} h-16 w-full rounded-lg border`} />
              <p className="text-muted-foreground text-xs">{c.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Display 4xl / extrabold</h1>
          <h2 className="text-2xl font-bold tracking-tight">Título 2xl / bold</h2>
          <h3 className="text-lg font-semibold">Subtítulo lg / semibold</h3>
          <p className="text-base">Cuerpo base — Plus Jakarta Sans.</p>
          <p className="text-muted-foreground text-sm">Texto secundario sm / muted.</p>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap gap-3">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructivo</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges (estados)">
        <div className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="success">pagada</Badge>
          <Badge variant="warning">emitida</Badge>
          <Badge variant="destructive">vencida</Badge>
          <Badge variant="outline">outline</Badge>
        </div>
      </Section>

      <Section title="Formularios">
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Texto">
            <Input placeholder="Escribe algo..." />
          </Field>
          <Field label="Selección">
            <Select defaultValue="">
              <option value="" disabled>
                Elige una opción
              </option>
              <option value="a">Opción A</option>
              <option value="b">Opción B</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Card</CardTitle>
              <CardDescription>Contenedor base con borde y sombra suave.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline">
                Acción
              </Button>
            </CardContent>
          </Card>
        </div>
      </Section>
    </PageContainer>
  )
}
