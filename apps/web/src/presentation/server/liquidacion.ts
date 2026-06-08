/**
 * Presentación (delivery): server function de TanStack que expone el caso de uso
 * `generarLiquidacion`. Solo se encarga del transporte: valida la entrada,
 * resuelve el caller desde el token, arma los adapters de infraestructura y los
 * inyecta en el caso de uso. La lógica de negocio vive en application/.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { generarLiquidacion as generarLiquidacionUseCase } from '@/application/use-cases/generar-liquidacion'
import { createAdminClient, getCallerUser } from '@/infrastructure/supabase/admin'
import { makeSupabaseRepositories } from '@/infrastructure/supabase/repositories'
import { getPaymentGateway } from '@/infrastructure/payments/factory'

const inputSchema = z.object({
  contratoId: z.string().uuid(),
  periodo: z.string().date(),
  accessToken: z.string().min(10),
})

export const generarLiquidacion = createServerFn({ method: 'POST' })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await getCallerUser(data.accessToken)
    const repos = makeSupabaseRepositories(createAdminClient())
    return generarLiquidacionUseCase(
      {
        ...repos,
        gateway: getPaymentGateway(),
        comisionRate: process.env.COMMISSION_RATE ? Number(process.env.COMMISSION_RATE) : undefined,
      },
      { contratoId: data.contratoId, periodo: data.periodo, caller },
    )
  })
