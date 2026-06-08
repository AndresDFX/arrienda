import type {
  CrearRecaudoInput,
  PaymentGateway,
  RecaudoCreado,
  WebhookResult,
} from '@/application/ports/payment-gateway'

/** SHA-256 hex usando Web Crypto (disponible en Cloudflare Workers). */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Adaptador Wompi (sandbox/prod). Ver plan en docs/WOMPI-INTEGRACION.md.
 *
 * - crearRecaudo: crea un Payment Link (cobro al arrendatario por PSE/tarjeta).
 * - verificarWebhook: valida la firma (events secret) del evento transaction.updated.
 *
 * Requiere llaves: WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET (+ WOMPI_BASE_URL).
 * La dispersión multi-destino es Fase 2 (convenio). Montos en centavos (×100).
 */
export class WompiGateway implements PaymentGateway {
  readonly provider = 'wompi' as const

  constructor(
    private readonly config: { privateKey: string; eventsSecret: string; baseUrl: string },
    private readonly appBaseUrl: string,
  ) {}

  async crearRecaudo(input: CrearRecaudoInput): Promise<RecaudoCreado> {
    if (!this.config.privateKey) throw new Error('Falta WOMPI_PRIVATE_KEY')
    const res = await fetch(`${this.config.baseUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.privateKey}`,
      },
      body: JSON.stringify({
        name: (input.descripcion || 'Arriendo').slice(0, 30),
        description: input.descripcion,
        single_use: true,
        currency: 'COP',
        amount_in_cents: input.monto * 100,
        redirect_url: `${this.appBaseUrl}/arrendatario`,
        reference: input.referencia,
      }),
    })
    if (!res.ok) {
      throw new Error(`Wompi payment_links ${res.status}: ${await res.text()}`)
    }
    const json = (await res.json()) as { data: { id: string } }
    return {
      pasarelaRef: json.data.id,
      checkoutUrl: `https://checkout.wompi.co/l/${json.data.id}`,
      estado: 'pendiente',
    }
  }

  async verificarWebhook(rawBody: string, _headers: Record<string, string>): Promise<WebhookResult> {
    const evt = JSON.parse(rawBody) as {
      event: string
      data: { transaction: { id: string; status: string; reference: string; amount_in_cents: number } }
      signature: { properties: string[]; checksum: string }
      timestamp: number
    }
    const tx = evt.data.transaction
    const valores: Record<string, unknown> = {
      'transaction.id': tx.id,
      'transaction.status': tx.status,
      'transaction.amount_in_cents': tx.amount_in_cents,
    }
    const concat =
      evt.signature.properties.map((p) => String(valores[p] ?? '')).join('') +
      evt.timestamp +
      this.config.eventsSecret
    const calculado = await sha256Hex(concat)
    if (calculado.toLowerCase() !== (evt.signature.checksum ?? '').toLowerCase()) {
      throw new Error('Wompi: checksum de webhook inválido')
    }
    const estado: WebhookResult['estado'] =
      tx.status === 'APPROVED' ? 'aprobada' : tx.status === 'VOIDED' ? 'reversada' : 'rechazada'
    return { pasarelaRef: tx.id, estado }
  }
}
