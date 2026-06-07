/**
 * Registro central de proveedores de scraping, categorizados por tipo de servicio.
 * Importar un proveedor aqui lo registra (efecto de import).
 *
 * Proveedores actuales:
 *   - gas:     Gases de Occidente (publica)
 *   - energia: Celsia (autenticada)
 *   - agua:    AquaServicios (publica), Acuavalle (publica)
 */
import './gases-de-occidente.ts'
import './celsia.ts'
import './aquaservicios.ts'
import './acuavalle.ts'

export * from './types.ts'
import type { ProviderCredentials } from './types.ts'

/**
 * Resuelve credenciales de un proveedor autenticado desde variables de entorno:
 * <KEY>_EMAIL / <KEY>_PASSWORD (ej. celsia -> CELSIA_EMAIL / CELSIA_PASSWORD).
 */
export function credencialesDeProveedor(key: string): ProviderCredentials | undefined {
  const prefix = key.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]
  return email && password ? { email, password } : undefined
}
