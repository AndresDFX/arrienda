import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/** Contenedor de página: ancho máximo + padding responsive consistente. */
export function PageContainer({ className, children, ...props }: React.ComponentProps<'main'>) {
  return (
    <main className={cn('mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10', className)} {...props}>
      {children}
    </main>
  )
}

/** Encabezado de página: título + subtítulo + acción opcional (responsive). */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/** Sección con título opcional. */
export function Section({
  title,
  children,
  className,
}: {
  title?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
      {children}
    </section>
  )
}

/** Campo de formulario: label + control, apilado. */
export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

/** Grilla de formulario responsive (1 col en móvil → 2 → 3). */
export function FormGrid({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3', className)}
      {...props}
    >
      {children}
    </div>
  )
}
