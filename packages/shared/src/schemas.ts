/**
 * Schemas de validacion (Zod) para entradas de la API / formularios.
 * Reutilizados por el frontend (react-hook-form), las server functions y el scraper.
 */
import { z } from 'zod'
import {
  MODALIDADES_COBRO,
  TIPOS_SERVICIO,
  ESTADOS_JOB,
  ROLES,
} from './domain.ts'

const pesosEnteros = z
  .number()
  .int('El monto debe ser un entero (pesos)')
  .nonnegative('El monto no puede ser negativo')

export const rolSchema = z.enum(ROLES)
export const modalidadCobroSchema = z.enum(MODALIDADES_COBRO)
export const tipoServicioSchema = z.enum(TIPOS_SERVICIO)
export const estadoJobSchema = z.enum(ESTADOS_JOB)

// --- Perfil de usuario ---
export const perfilInputSchema = z.object({
  nombre: z.string().min(2).max(120),
  telefono: z.string().min(7).max(20).optional(),
  cuentaBancaria: z.string().max(60).optional(),
})
export type PerfilInput = z.infer<typeof perfilInputSchema>

// --- Propiedad ---
export const propiedadInputSchema = z.object({
  direccion: z.string().min(5).max(200),
  ciudad: z.string().min(2).max(80).default('Cali'),
  modalidadCobro: modalidadCobroSchema,
})
export type PropiedadInput = z.infer<typeof propiedadInputSchema>

// --- Contrato de arriendo ---
export const contratoInputSchema = z
  .object({
    propiedadId: z.string().uuid(),
    arrendatarioId: z.string().uuid(),
    canon: pesosEnteros.min(1, 'El canon debe ser mayor a cero'),
    fechaInicio: z.string().date(),
    fechaFin: z.string().date().optional(),
    diaCorte: z.number().int().min(1).max(28),
  })
  .refine((c) => !c.fechaFin || c.fechaFin > c.fechaInicio, {
    message: 'La fecha fin debe ser posterior a la fecha de inicio',
    path: ['fechaFin'],
  })
export type ContratoInput = z.infer<typeof contratoInputSchema>

// --- Servicio publico (NIC/NIS) — Fase 1 ---
export const servicioInputSchema = z.object({
  propiedadId: z.string().uuid(),
  tipo: tipoServicioSchema,
  comercializadoraId: z.string().uuid(),
  nicNis: z.string().min(3).max(40),
})
export type ServicioInput = z.infer<typeof servicioInputSchema>

// --- Item de servicio para una liquidacion ---
export const itemServicioSchema = z.object({
  concepto: z.string().min(2).max(120),
  monto: pesosEnteros,
  recaudadorId: z.string().uuid(),
})

// --- Entrada para generar una liquidacion ---
export const liquidacionInputSchema = z.object({
  contratoId: z.string().uuid(),
  periodo: z.string().date(), // primer dia del mes liquidado, p.ej. 2026-06-01
  canon: pesosEnteros.min(1),
  modalidad: modalidadCobroSchema,
  servicios: z.array(itemServicioSchema).default([]),
  comisionRate: z.number().min(0).max(1).optional(),
})
export type LiquidacionInput = z.infer<typeof liquidacionInputSchema>

// --- Resultado que el scraper publica de vuelta a la API (Fase 1) ---
export const resultadoExtraccionSchema = z.object({
  jobId: z.string().uuid(),
  estado: estadoJobSchema,
  valorExtraido: pesosEnteros.optional(),
  refPago: z.string().max(120).optional(),
  fechaLimite: z.string().date().optional(),
  error: z.string().max(500).optional(),
})
export type ResultadoExtraccion = z.infer<typeof resultadoExtraccionSchema>
