/**
 * Job diario de notificaciones de corte.
 * Calcula, por contrato activo, los días hasta la fecha de corte; si coincide con
 * un umbral configurado (config global del admin + override del arrendador), crea
 * una notificación (dedupe) y la envía por email (Mailpit en local).
 *
 * Uso (Node, no Bun):
 *   node --env-file=.env --experimental-strip-types apps/scraper/src/notify.ts [--fecha YYYY-MM-DD] [--dry]
 *     --fecha  simula "hoy" (para probar umbrales)
 *     --dry    calcula e inserta pendientes pero NO envía
 */
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import {
  configEfectiva,
  umbralAviso,
  canalesActivos,
  proximoCorte,
  type NotifConfig,
} from '@arrienda/shared'
import { config } from './config.ts'

const fechaArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
const hoy = fechaArg ? new Date(`${fechaArg}T12:00:00Z`) : new Date()
const DRY = process.argv.includes('--dry')

const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
})

function rowToConfig(r: {
  dias_antes_corte: number[]
  canal_email: boolean
  canal_whatsapp: boolean
  activo: boolean
}): NotifConfig {
  return {
    diasAntesCorte: r.dias_antes_corte,
    canalEmail: r.canal_email,
    canalWhatsapp: r.canal_whatsapp,
    activo: r.activo,
  }
}

// 1. Config global (admin) + overrides por arrendador.
const { data: globalRow, error: eg } = await db
  .from('notificacion_config')
  .select('*')
  .eq('scope', 'global')
  .single()
if (eg || !globalRow) throw new Error(`Sin config global: ${eg?.message}`)
const global = rowToConfig(globalRow)

const { data: overrides } = await db.from('notificacion_config').select('*').eq('scope', 'arrendador')
const overrideByArr = new Map((overrides ?? []).map((o) => [o.arrendador_id as string, rowToConfig(o)]))

// 2. Contratos activos.
const { data: contratos, error: ec } = await db
  .from('contratos')
  .select('id, dia_corte, arrendatario_id, propiedades(arrendador_id)')
  .eq('activo', true)
if (ec) throw new Error(`contratos: ${ec.message}`)

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
})

let avisos = 0
let enviados = 0
for (const c of (contratos ?? []) as Array<{
  id: string
  dia_corte: number
  arrendatario_id: string
  propiedades: { arrendador_id: string } | { arrendador_id: string }[] | null
}>) {
  const prop = Array.isArray(c.propiedades) ? c.propiedades[0] : c.propiedades
  const cfg = configEfectiva(global, prop ? overrideByArr.get(prop.arrendador_id) : undefined)
  if (!cfg.activo) continue

  const n = umbralAviso(c.dia_corte, hoy, cfg.diasAntesCorte)
  if (n === null) continue

  const corte = proximoCorte(c.dia_corte, hoy)
  const periodo = `${corte.getUTCFullYear()}-${String(corte.getUTCMonth() + 1).padStart(2, '0')}-01`
  const corteStr = corte.toISOString().slice(0, 10)

  // Destinatario: email del arrendatario.
  const { data: u } = await db.auth.admin.getUserById(c.arrendatario_id)
  const email = u?.user?.email
  if (!email) continue

  for (const canal of canalesActivos(cfg)) {
    if (canal !== 'email') continue // WhatsApp: fase posterior
    const mensaje = `Tu factura de arriendo vence el ${corteStr}. Faltan ${n} día(s) para el corte.`

    // Inserta pendiente (unique evita duplicados del mismo umbral/periodo/canal).
    const { data: notif, error: ei } = await db
      .from('notificaciones')
      .insert({
        contrato_id: c.id,
        tipo: 'corte_proximo',
        canal: 'email',
        destinatario: email,
        dias_antes: n,
        periodo,
        mensaje,
        estado: 'pendiente',
      })
      .select('id')
      .single()
    if (ei || !notif) continue // ya existía (dedupe) u otro error
    avisos++
  }
}

// Despacho: envía TODAS las notificaciones pendientes por email (idempotente).
if (!DRY) {
  const { data: pendientes } = await db
    .from('notificaciones')
    .select('id, destinatario, mensaje, dias_antes')
    .eq('estado', 'pendiente')
    .eq('canal', 'email')
  for (const p of (pendientes ?? []) as Array<{
    id: string
    destinatario: string
    mensaje: string | null
    dias_antes: number | null
  }>) {
    try {
      await transporter.sendMail({
        from: config.emailFrom,
        to: p.destinatario,
        subject: `ARRIENDA+ · Tu corte es en ${p.dias_antes ?? '?'} día(s)`,
        text: p.mensaje ?? 'Tienes una factura próxima a vencer.',
      })
      await db
        .from('notificaciones')
        .update({ estado: 'enviada', enviada_at: new Date().toISOString() })
        .eq('id', p.id)
      enviados++
    } catch (err) {
      await db.from('notificaciones').update({ estado: 'fallida' }).eq('id', p.id)
      console.error(`[notify] fallo a ${p.destinatario}:`, err instanceof Error ? err.message : err)
    }
  }
}

console.log(`[notify] hoy=${hoy.toISOString().slice(0, 10)} · avisos nuevos=${avisos} · enviados=${enviados}${DRY ? ' (dry)' : ''}`)
process.exit(0)
