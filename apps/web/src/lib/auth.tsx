import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Rol } from '@arrienda/shared'
import { supabase } from './supabase/client'

interface Profile {
  id: string
  rol: Rol
  nombre: string
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  accessToken: string | null
  signIn(email: string, password: string): Promise<{ error?: string }>
  signUp(
    email: string,
    password: string,
    nombre: string,
    rol: Rol,
  ): Promise<{ error?: string }>
  signOut(): Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, rol, nombre')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null)
        setLoading(false)
      })
  }, [session])

  const value: AuthState = {
    session,
    profile,
    loading,
    accessToken: session?.access_token ?? null,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message }
    },
    async signUp(email, password, nombre, rol) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, rol } },
      })
      return { error: error?.message }
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
