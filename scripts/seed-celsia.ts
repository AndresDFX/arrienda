/**
 * Siembra un servicio Celsia (energia, proveedor AUTENTICADO) con las credenciales
 * del titular para validar el flujo de credenciales-por-servicio end-to-end:
 *   propiedad -> servicio_publico (con portal_usuario/portal_password) -> scraping_job
 *
 * Las credenciales se leen de CELSIA_EMAIL / CELSIA_PASSWORD / CELSIA_CUENTA del .env
 * (nunca se imprimen). Luego corre el worker:
 *   node --env-file=.env --experimental-strip-types apps/scraper/src/index.ts --once
 *
 * Uso:  node --env-file=.env --experimental-strip-types scripts/seed-celsia.ts [periodo]
 *       (periodo por defecto 2026-06-01)
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.CELSIA_EMAIL
const password = process.env.CELSIA_PASSWORD
const cuenta = process.env.CELSIA_CUENTA
if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env')
if (!email || !password || !cuenta) throw new Error('Faltan CELSIA_EMAIL / CELSIA_PASSWORD / CELSIA_CUENTA en .env')

const db = createClient(url, key, { auth: { persistSession: false } })
const periodo = process.argv[2] ?? '2026-06-01'

// 1. Arrendador de prueba
const { data: arr, error: e1 } = await db
  .from('profiles')
  .select('id')
  .eq('nombre', 'Arrendador Demo')
  .limit(1)
  .single()
if (e1 || !arr) throw new Error(`No se encontro el arrendador demo: ${e1?.message}`)

// 2. Comercializadora Celsia
const { data: com, error: e2 } = await db
  .from('comercializadoras')
  .select('id, requiere_credenciales')
  .eq('nombre', 'Celsia')
  .limit(1)
  .single()
if (e2 || !com) throw new Error(`No se encontro la comercializadora Celsia: ${e2?.message}`)

// 3. Propiedad demo (find-or-create por direccion)
const DIRECCION = 'Demo Celsia (energia)'
let propId: string
const { data: propEx } = await db
  .from('propiedades')
  .select('id')
  .eq('arrendador_id', arr.id)
  .eq('direccion', DIRECCION)
  .limit(1)
  .maybeSingle()
if (propEx) {
  propId = propEx.id
} else {
  const { data: prop, error: e3 } = await db
    .from('propiedades')
    .insert({ arrendador_id: arr.id, direccion: DIRECCION, ciudad: 'Cali', modalidad_cobro: 'completo' })
    .select('id')
    .single()
  if (e3 || !prop) throw new Error(`No se pudo crear la propiedad: ${e3?.message}`)
  propId = prop.id
}

// 4. Servicio Celsia con credenciales (find-or-update)
let servId: string
const { data: servEx } = await db
  .from('servicios_publicos')
  .select('id')
  .eq('propiedad_id', propId)
  .eq('comercializadora_id', com.id)
  .limit(1)
  .maybeSingle()
if (servEx) {
  servId = servEx.id
  const { error } = await db
    .from('servicios_publicos')
    .update({ nic_nis: cuenta, portal_usuario: email, portal_password: password })
    .eq('id', servId)
  if (error) throw new Error(`No se pudo actualizar el servicio: ${error.message}`)
} else {
  const { data: serv, error: e4 } = await db
    .from('servicios_publicos')
    .insert({
      propiedad_id: propId,
      tipo: 'energia',
      comercializadora_id: com.id,
      nic_nis: cuenta,
      portal_usuario: email,
      portal_password: password,
    })
    .select('id')
    .single()
  if (e4 || !serv) throw new Error(`No se pudo crear el servicio: ${e4?.message}`)
  servId = serv.id
}

// 5. Job de scraping pendiente (idempotente por (servicio_id, periodo))
const { error: e5 } = await db
  .from('scraping_jobs')
  .upsert({ servicio_id: servId, periodo, estado: 'pendiente' }, { onConflict: 'servicio_id,periodo' })
if (e5) throw new Error(`No se pudo encolar el job: ${e5.message}`)

console.log('Servicio Celsia sembrado (credenciales tomadas del .env, no impresas):')
console.log(`  propiedad : ${propId}`)
console.log(`  servicio  : ${servId} (energia, cuenta ${cuenta}, requiere_credenciales=${com.requiere_credenciales})`)
console.log(`  job       : pendiente, periodo ${periodo}`)
