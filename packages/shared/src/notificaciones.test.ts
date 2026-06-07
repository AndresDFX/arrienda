import { describe, it, expect } from 'vitest'
import {
  proximoCorte,
  diasHastaCorte,
  umbralAviso,
  configEfectiva,
  canalesActivos,
  type NotifConfig,
} from './notificaciones.ts'

const d = (s: string) => new Date(`${s}T12:00:00Z`)

describe('proximoCorte / diasHastaCorte', () => {
  it('mismo mes si aún no pasó el corte', () => {
    expect(diasHastaCorte(10, d('2026-06-05'))).toBe(5)
  })
  it('siguiente mes si ya pasó el corte', () => {
    expect(diasHastaCorte(5, d('2026-06-10'))).toBe(25) // 5 de julio
    expect(proximoCorte(5, d('2026-06-10')).getUTCMonth()).toBe(6) // julio (0-index)
  })
  it('0 el día del corte', () => {
    expect(diasHastaCorte(7, d('2026-06-07'))).toBe(0)
  })
})

describe('umbralAviso', () => {
  it('avisa cuando faltan exactamente N días', () => {
    expect(umbralAviso(10, d('2026-06-05'), [5, 3, 1])).toBe(5) // faltan 5
    expect(umbralAviso(10, d('2026-06-09'), [5, 3, 1])).toBe(1) // faltan 1
  })
  it('no avisa si no coincide', () => {
    expect(umbralAviso(10, d('2026-06-06'), [5, 3, 1])).toBeNull() // faltan 4
  })
})

describe('configEfectiva', () => {
  const global: NotifConfig = {
    diasAntesCorte: [5, 3, 1],
    canalEmail: true,
    canalWhatsapp: false,
    activo: true,
  }
  it('usa el global si no hay override', () => {
    expect(configEfectiva(global)).toEqual(global)
  })
  it('el override del arrendador gana campo a campo', () => {
    const eff = configEfectiva(global, { diasAntesCorte: [7], canalWhatsapp: true })
    expect(eff.diasAntesCorte).toEqual([7])
    expect(eff.canalWhatsapp).toBe(true)
    expect(eff.canalEmail).toBe(true) // heredado del global
  })
  it('canalesActivos lista los canales on', () => {
    expect(canalesActivos({ ...global, canalWhatsapp: true })).toEqual(['email', 'whatsapp'])
  })
})
