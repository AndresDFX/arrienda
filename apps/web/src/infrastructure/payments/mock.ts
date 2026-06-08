import type {
  CrearRecaudoInput,
  PaymentGateway,
  RecaudoCreado,
  WebhookResult,
} from '@/application/ports/payment-gateway'

/**
 * Adaptador MOCK de la pasarela (Fase 0).
 *
 * No mueve dinero real: genera una referencia y una URL de checkout simulada.
 * El "pago" se confirma llamando al endpoint de webhook con un cuerpo JSON
 * { pasarelaRef, estado, liquidacionId }. Sirve para desarrollar el flujo
 * end-to-end sin credenciales de Wompi.
 */
export class MockGateway implements PaymentGateway {
  readonly provider = 'mock' as const

  constructor(private readonly appBaseUrl: string = 'http://localhost:3000') {}

  async crearRecaudo(input: CrearRecaudoInput): Promise<RecaudoCreado> {
    const pasarelaRef = `mock_${input.referencia}`
    const checkoutUrl = `${this.appBaseUrl}/pago/simulado?ref=${encodeURIComponent(
      pasarelaRef,
    )}&liq=${encodeURIComponent(input.liquidacionId)}&monto=${input.monto}`
    return { pasarelaRef, checkoutUrl, estado: 'pendiente' }
  }

  async verificarWebhook(rawBody: string): Promise<WebhookResult> {
    const body = JSON.parse(rawBody) as Partial<WebhookResult>
    if (!body.pasarelaRef || !body.estado) {
      throw new Error('Webhook mock invalido: faltan pasarelaRef o estado')
    }
    return {
      pasarelaRef: body.pasarelaRef,
      estado: body.estado,
      liquidacionId: body.liquidacionId,
    }
  }
}
