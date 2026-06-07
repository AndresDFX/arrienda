import type { Page } from 'playwright'
import type { TipoServicio } from '@arrienda/shared'

/**
 * Abstraccion de PROVEEDOR de servicio publico para el motor de scraping.
 *
 * Unifica dos patrones bajo un mismo contrato, categorizados por `tipo`
 * (energia / gas / agua):
 *   - Publica:      consulta por NIC/contrato sin login (ej. Gases de Occidente).
 *   - Autenticada:  login del titular + cuenta (ej. Celsia).
 *
 * Para agregar un proveedor nuevo: crea un archivo en providers/, implementa
 * `Provider`, llama `registerProvider(...)` e impórtalo en providers/index.ts.
 */
export interface ExtractionData {
  /** Valor a pagar, en pesos enteros. */
  valorExtraido: number
  /** Codigo/referencia de pago (para Fase 2). */
  refPago?: string
  /** Fecha limite de pago (YYYY-MM-DD). */
  fechaLimite?: string
  /** Metadatos opcionales utiles para conciliacion / UI. */
  titular?: string
  direccion?: string
  /** true si no hay saldo pendiente. */
  alDia?: boolean
}

export type AuthMode = 'publica' | 'autenticada'

export interface ProviderCredentials {
  email?: string
  password?: string
}

export interface ExtractionContext {
  page: Page
  /** NIC/contrato (publica) o codigo de cuenta (autenticada). */
  identificador: string
  /** Solo para proveedores autenticados. */
  credenciales?: ProviderCredentials
  /** Periodo a liquidar (YYYY-MM-DD), opcional. */
  periodo?: string
}

export interface Provider {
  /** Clave unica en kebab-case, p.ej. 'gases-de-occidente'. */
  key: string
  /** Nombre legible (debe coincidir con comercializadoras.nombre en la BD). */
  nombre: string
  /** Categoria del servicio: 'energia' | 'gas' | 'agua'. */
  tipo: TipoServicio
  /** Modo de autenticacion del portal. */
  auth: AuthMode
  /** URL del portal. */
  portalUrl: string
  /** Ejecuta la extraccion y devuelve el valor + metadatos. */
  extract(ctx: ExtractionContext): Promise<ExtractionData>
}

// --- Registro de proveedores -------------------------------------------------
const byKey = new Map<string, Provider>()
const byNombre = new Map<string, Provider>()

export function registerProvider(provider: Provider): void {
  byKey.set(provider.key, provider)
  byNombre.set(provider.nombre.toLowerCase(), provider)
}

/** Busca por key ('celsia') o por nombre ('Celsia'). */
export function getProvider(keyOrNombre: string): Provider | undefined {
  return byKey.get(keyOrNombre) ?? byNombre.get(keyOrNombre.toLowerCase())
}

export function listProviders(): Provider[] {
  return [...byKey.values()]
}

/** Lista proveedores de una categoria (energia/gas/agua). */
export function listProvidersByTipo(tipo: TipoServicio): Provider[] {
  return listProviders().filter((p) => p.tipo === tipo)
}

/** Convierte texto monetario colombiano ("$ 17.556") a pesos enteros. */
export function parsearPesos(texto: string): number {
  const limpio = texto.replace(/[^\d]/g, '')
  if (!limpio) throw new Error(`No se pudo parsear monto: "${texto}"`)
  return parseInt(limpio, 10)
}
