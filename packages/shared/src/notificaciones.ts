/**
 * Lógica de notificaciones de corte (pura y testeable).
 * El job diario usa estas funciones para decidir a quién avisar y cuándo.
 */
import type { CanalNotificacion } from './domain.ts'

/** Fecha (UTC) del próximo corte dado el día de corte (1-28) y una fecha base. */
export function proximoCorte(diaCorte: number, hoy: Date): Date {
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()
  // Si ya pasó el día de corte de este mes, el próximo es el mes siguiente.
  return d > diaCorte ? new Date(Date.UTC(y, m + 1, diaCorte)) : new Date(Date.UTC(y, m, diaCorte))
}

/** Días calendario desde `hoy` hasta el próximo corte (0 = hoy es el corte). */
export function diasHastaCorte(diaCorte: number, hoy: Date): number {
  const corte = proximoCorte(diaCorte, hoy)
  const base = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  return Math.round((corte.getTime() - base) / 86_400_000)
}

/**
 * Devuelve el umbral coincidente (p.ej. 5) si HOY corresponde avisar según los
 * umbrales configurados, o null si no toca avisar hoy.
 */
export function umbralAviso(diaCorte: number, hoy: Date, diasAntes: number[]): number | null {
  const restantes = diasHastaCorte(diaCorte, hoy)
  return diasAntes.includes(restantes) ? restantes : null
}

export interface NotifConfig {
  diasAntesCorte: number[]
  canalEmail: boolean
  canalWhatsapp: boolean
  activo: boolean
}

/** Combina la config global (admin) con el override opcional del arrendador. */
export function configEfectiva(
  global: NotifConfig,
  override?: Partial<NotifConfig> | null,
): NotifConfig {
  if (!override) return global
  return {
    diasAntesCorte: override.diasAntesCorte ?? global.diasAntesCorte,
    canalEmail: override.canalEmail ?? global.canalEmail,
    canalWhatsapp: override.canalWhatsapp ?? global.canalWhatsapp,
    activo: override.activo ?? global.activo,
  }
}

/** Canales activos de una config efectiva. */
export function canalesActivos(cfg: NotifConfig): CanalNotificacion[] {
  const canales: CanalNotificacion[] = []
  if (cfg.canalEmail) canales.push('email')
  if (cfg.canalWhatsapp) canales.push('whatsapp')
  return canales
}
