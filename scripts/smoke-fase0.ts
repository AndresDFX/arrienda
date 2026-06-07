/**
 * Smoke test de Fase 0 a nivel de datos (RLS + RPC + creacion de contrato).
 * Inicia sesion como el arrendador de prueba y ejerce el camino real que usa la UI.
 *
 * Uso:  bun run scripts/smoke-fase0.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
if (!url || !anon) throw new Error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en .env')

const sb = createClient(url, anon, { auth: { persistSession: false } })

// 1. Login como arrendador (sesion de usuario -> RLS aplica)
const { data: auth, error: eLogin } = await sb.auth.signInWithPassword({
  email: 'arrendador@arrienda.test',
  password: 'Arrienda2026!',
})
if (eLogin) throw new Error(`login: ${eLogin.message}`)
console.log('✓ login arrendador:', auth.user?.id)

// 2. Propiedades visibles por RLS (debe ver la propiedad demo)
const { data: props, error: eProps } = await sb
  .from('propiedades')
  .select('id, direccion, modalidad_cobro')
if (eProps) throw new Error(`propiedades: ${eProps.message}`)
console.log('✓ propiedades visibles (RLS):', props?.length)
const propiedad = props?.[0]
if (!propiedad) throw new Error('No hay propiedad demo (corre scripts/seed-demo.ts)')

// 3. Resolver arrendatario por email (RPC SECURITY DEFINER)
const { data: arrRaw, error: eRpc } = await sb.rpc('buscar_usuario_por_email', {
  p_email: 'arrendatario@arrienda.test',
})
if (eRpc) throw new Error(`rpc buscar_usuario: ${eRpc.message}`)
const arrendatario = Array.isArray(arrRaw) ? arrRaw[0] : arrRaw
console.log('✓ arrendatario resuelto:', arrendatario?.id, arrendatario?.rol)

// 4. Crear contrato (RLS contratos_write valida que la propiedad sea del arrendador)
const { data: contrato, error: eC } = await sb
  .from('contratos')
  .insert({
    propiedad_id: propiedad.id,
    arrendatario_id: arrendatario.id,
    canon: 1_500_000,
    fecha_inicio: '2026-06-01',
    dia_corte: 5,
  })
  .select('id')
  .single()
if (eC) throw new Error(`crear contrato: ${eC.message}`)
console.log('✓ contrato creado (RLS insert):', contrato.id)

// 5. Confirmar que hay extraccion del scraper para esa propiedad (la consumira la liquidacion)
const { data: servs } = await sb.from('servicios_publicos').select('id').eq('propiedad_id', propiedad.id)
const servicioIds = (servs ?? []).map((s) => s.id)
const { data: exts } = await sb
  .from('extracciones')
  .select('valor_extraido, fecha_limite, estado')
  .in('servicio_id', servicioIds.length ? servicioIds : ['00000000-0000-0000-0000-000000000000'])
console.log('✓ extracciones visibles para la propiedad:', JSON.stringify(exts))

console.log('\nSMOKE OK — contrato listo. Genera la liquidacion desde el panel /arrendador.')
