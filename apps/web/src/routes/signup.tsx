import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Rol } from '@arrienda/shared'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/brand/logo'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<Rol>('arrendador')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signUp(email, password, nombre, rol)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Cuenta creada. Ya puedes ingresar.')
    navigate({ to: '/login' })
  }

  return (
    <main className="relative flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="brand-gradient absolute -top-28 left-1/2 size-[30rem] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mx-auto mb-6 flex w-fit">
          <Logo />
        </Link>
        <Card className="w-full">
        <CardHeader>
          <CardTitle>Crea tu cuenta</CardTitle>
          <CardDescription>Registrate como arrendador o arrendatario</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rol">Rol</Label>
              <Select id="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                <option value="arrendador">Arrendador</option>
                <option value="arrendatario">Arrendatario</option>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear cuenta'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary">
                Ingresa
              </Link>
            </p>
          </form>
        </CardContent>
        </Card>
      </div>
    </main>
  )
}
