import type { PaymentGateway } from '@/application/ports/payment-gateway'
import { MockGateway } from './mock'
import { WompiGateway } from './wompi'

/**
 * Factory: devuelve la implementación de la pasarela según PAYMENTS_PROVIDER.
 * En Fase 0 el default es "mock". Cambiar a "wompi" cuando esté integrado.
 */
export function getPaymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENTS_PROVIDER ?? 'mock'
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000'

  if (provider === 'wompi') {
    return new WompiGateway(
      {
        privateKey: process.env.WOMPI_PRIVATE_KEY ?? '',
        eventsSecret: process.env.WOMPI_EVENTS_SECRET ?? '',
        baseUrl: process.env.WOMPI_BASE_URL ?? 'https://sandbox.wompi.co/v1',
      },
      appBaseUrl,
    )
  }
  return new MockGateway(appBaseUrl)
}
