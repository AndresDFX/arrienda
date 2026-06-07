import type { PaymentGateway } from './gateway'
import { MockGateway } from './mock'
import { WompiGateway } from './wompi'

export type { PaymentGateway, CrearRecaudoInput, RecaudoCreado, WebhookResult } from './gateway'

/**
 * Factory: devuelve la pasarela segun PAYMENTS_PROVIDER.
 * En Fase 0 el default es "mock". Cambiar a "wompi" cuando este integrado.
 */
export function getPaymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENTS_PROVIDER ?? 'mock'
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000'

  if (provider === 'wompi') {
    return new WompiGateway({
      privateKey: process.env.WOMPI_PRIVATE_KEY ?? '',
      eventsSecret: process.env.WOMPI_EVENTS_SECRET ?? '',
      baseUrl: process.env.WOMPI_BASE_URL ?? 'https://sandbox.wompi.co/v1',
    })
  }
  return new MockGateway(appBaseUrl)
}
