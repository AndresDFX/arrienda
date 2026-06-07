import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setLoading(false)
      toast.error(error)
      return
    }
    const { data } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', data.user?.id ?? '')
      .single()
    setLoading(false)
    toast.success('Sesion iniciada')
    navigate({ to: `/${(prof?.rol as string) ?? 'arrendatario'}` })
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Ingresar a ARRIENDA+</CardTitle>
          <CardDescription>Usa tu correo y contrasena</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              No tienes cuenta?{' '}
              <Link to="/signup" className="text-primary">
                Registrate
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
