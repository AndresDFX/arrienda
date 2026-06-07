/**
 * Crea usuarios de prueba en Supabase local (uno por rol).
 *
 * Uso:  bun run scripts/seed-users.ts
 * Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env (Bun carga .env solo).
 *
 * Nuestro modelo usa UN rol por usuario (enum + RLS). Estos tres usuarios, con
 * el mismo password, permiten probar TODOS los flujos por rol.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

const PASSWORD = 'Arrienda2026!'
const users = [
  { email: 'admin@arrienda.test', nombre: 'Admin Demo', rol: 'admin' },
  { email: 'arrendador@arrienda.test', nombre: 'Arrendador Demo', rol: 'arrendador' },
  { email: 'arrendatario@arrienda.test', nombre: 'Arrendatario Demo', rol: 'arrendatario' },
] as const

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: u.nombre, rol: u.rol },
  })
  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      console.log(`= ${u.email} ya existe`)
      continue
    }
    console.error(`x ${u.email}: ${error.message}`)
    continue
  }
  // Refuerza el rol en profiles (el trigger ya lo aplica desde user_metadata).
  if (data.user) {
    await admin.from('profiles').update({ rol: u.rol, nombre: u.nombre }).eq('id', data.user.id)
  }
  console.log(`+ ${u.email} (${u.rol})`)
}

console.log(`\nListo. Password para todos: ${PASSWORD}`)
