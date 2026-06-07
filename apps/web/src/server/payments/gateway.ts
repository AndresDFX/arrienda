/**
 * Contrato de la pasarela de pagos (puerto).
 *
 * ARRIENDA+ NO retiene dinero (doc. seccion 2.3): la pasarela recauda del
 * arrendatario y dispersa a multiples destinos bajo modelo de mandato. Este
 * puerto abstrae esa operacion para poder cambiar de proveedor (mock -> Wompi)
 * sin tocar la logica de negocio.
 */
import type { MovimientoDispersion, PaymentProvider } from '@arrienda/shared'

export interface CrearRecaudoInput {
  liquidacionId: string
  /** Total a cobrar al arrendatario, en pesos enteros. */
  monto: number
  /** Referencia unica del recaudo (idempotencia). */
  referencia: string
  descripcion: string
  emailArrendatario?: string
  /** Plan de dispersion (a donde va cada peso una vez aprobado el pago). */
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
