/**
 * Puerto de la pasarela de pagos (capa de aplicación).
 *
 * ARRIENDA+ NO retiene dinero (doc. sección 2.3): la pasarela recauda del
 * arrendatario y dispersa a múltiples destinos bajo modelo de mandato. Este
 * puerto abstrae esa operación para poder cambiar de proveedor (mock → Wompi)
 * sin tocar los casos de uso. Las implementaciones viven en infrastructure/payments.
 */
import type { MovimientoDispersion, PaymentProvider } from '@arrienda/shared'

export interface CrearRecaudoInput {
  liquidacionId: string
  /** Total a cobrar al arrendatario, en pesos enteros. */
  monto: number
  /** Referencia única del recaudo (idempotencia). */
  referencia: string
  descripcion: string
  emailArrendatario?: string
  /** Plan de dispersión (a dónde va cada peso una vez aprobado el pago). */
  dispersion: MovimientoDispersion[]
}

export interface RecaudoCreado {
  pasarelaRef: string
  /** URL a la que se redirige al arrendatario para pagar (PSE/tarjeta). */
  checkoutUrl: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
}

export interface WebhookResult {
  pasarelaRef: string
  estado: 'aprobada' | 'rechazada' | 'reversada'
  liquidacionId?: string
}

export interface PaymentGateway {
  readonly provider: PaymentProvider
  /** Crea un recaudo y devuelve el link de pago para el arrendatario. */
  crearRecaudo(input: CrearRecaudoInput): Promise<RecaudoCreado>
  /** Verifica la firma y normaliza un evento de webhook entrante. */
  verificarWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookResult>
}
