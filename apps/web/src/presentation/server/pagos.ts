/**
 * Presentación (delivery): server function de TanStack que expone el caso de uso
 * `confirmarPago` (Fase 0 / mock). Solo transporte + cableado de adapters.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { confirmarPago as confirmarPagoUseCase } from '@/application/use-cases/confirmar-pago'
import { createAdminClient, getCallerUser } from '@/infrastructure/supabase/admin'
import { makeSupabaseRepositories } from '@/infrastructure/supabase/repositories'

const inputSchema = z.object({
  pasarelaRef: z.string().min(3),
  accessToken: z.string().min(10),
})

export const confirmarPagoMock = createServerFn({ method: 'POST' })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await getCallerUser(data.accessToken)
    const repos = makeSupabaseRepositories(createAdminClient())
    return confirmarPagoUseCase(repos, { pasarelaRef: data.pasarelaRef, caller })
  })
