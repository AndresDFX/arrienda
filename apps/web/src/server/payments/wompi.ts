import type {
  CrearRecaudoInput,
  PaymentGateway,
  RecaudoCreado,
  WebhookResult,
} from './gateway'

/**
 * Adaptador Wompi (ESQUELETO — Fase 0/2).
 *
 * Documentado pero sin implementar para no bloquear el MVP. Cuando se tengan
 * llaves sandbox y se defina el convenio de dispersion (doc. seccion 2.3, 2.4),
 * completar:
 *   - crearRecaudo: crear transaccion / link de pago via API de Wompi.
 *   - verificarWebhook: validar la firma de integridad (events secret).
 *
 * Docs: https://docs.wompi.co
 */
export class WompiGateway implements PaymentGateway {
  readonly provider = 'wompi' as const

  constructor(
    private readonly config: {
      privateKey: string
      eventsSecret: string
      baseUrl: string
    },
  ) {}

  async crearRecaudo(_input: CrearRecaudoInput): Promise<RecaudoCreado> {
    throw new Error(
      `WompiGateway.crearRecaudo no implementado (base=${this.config.baseUrl}): integrar API de Wompi (Fase 0/2)`,
    )
  }

  async verificarWebhook(
    _rawBody: string,
    _headers: Record<string, string>,
  ): Promise<WebhookResult> {
    void this.config.eventsSecret // validar firma de integridad al implementar
    throw new Error('WompiGateway.verificarWebhook no implementado: validar firma de integridad')
  }
}
