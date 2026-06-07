/**
 * Siembra una demo para probar el pipeline del scraper end-to-end:
 *   - una propiedad del arrendador de prueba (modalidad completo)
 *   - un servicio de gas (Gases de Occidente) con un numero de contrato real
 *   - un job de scraping pendiente para el periodo dado
 *
 * Uso:  bun run scripts/seed-demo.ts [numeroContrato] [periodo]
 *       (por defecto contrato 2910516, periodo 2026-06-01)
 *
 * Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const contrato = process.argv[2] ?? '2910516'
const periodo = process.argv[3] ?? '2026-06-01'
const PORTAL = 'https://portalrecaudos.gdo.com.co/pagorecaudo.aspx'

// 1. Arrendador de prueba
const { data: arr, error: e1 } = await db
  .from('profiles')
  .select('id')
  .eq('nombre', 'Arrendador Demo')
  .limit(1)
  .single()
if (e1 || !arr) throw new Error(`No se encontro el arrendador demo: ${e1?.message}`)

// 2. Comercializadora Gases de Occidente (corrige el portal_url al de recaudos)
const { data: com, error: e2 } = await db
  .from('comercializadoras')
  .select('id')
  .eq('nombre', 'Gases de Occidente')
  .limit(1)
  .single()
if (e2 || !com) throw new Error(`No se encontro la comercializadora GdO: ${e2?.message}`)
await db.from('comercializadoras').update({ portal_url: PORTAL }).eq('id', com.id)

// 3. Propiedad
const { data: prop, error: e3 } = await db
  .from('propiedades')
  .insert({
    arrendador_id: arr.id,
    direccion: 'KR 6 SU 01 (demo)',
    ciudad: 'Cali',
    modalidad_cobro: 'completo',
  })
  .select('id')
  .single()
if (e3 || !prop) throw new Error(`No se pudo crear la propiedad: ${e3?.message}`)

// 4. Servicio de gas con el contrato real
const { data: serv, error: e4 } = await db
  .from('servicios_publicos')
  .insert({
    propiedad_id: prop.id,
    tipo: 'gas',
    comercializadora_id: com.id,
    nic_nis: contrato,
  })
  .select('id')
  .single()
if (e4 || !serv) throw new Error(`No se pudo crear el servicio: ${e4?.message}`)

// 5. Job de scraping pendiente (idempotente por (servicio_id, periodo))
const { error: e5 } = await db
  .from('scraping_jobs')
  .upsert(
    { servicio_id: serv.id, periodo, estado: 'pendiente' },
    { onConflict: 'servicio_id,periodo' },
  )
if (e5) throw new Error(`No se pudo encolar el job: ${e5.message}`)

console.log('Demo sembrada:')
console.log(`  propiedad : ${prop.id}`)
console.log(`  servicio  : ${serv.id} (gas, contrato ${contrato})`)
console.log(`  job       : pendiente, periodo ${periodo}`)
