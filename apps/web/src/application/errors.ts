/**
 * Errores de la capa de aplicación (independientes del framework y de la BD).
 * La presentación los traduce a la respuesta apropiada; los casos de uso y los
 * adapters los lanzan sin acoplarse a mensajes de Supabase.
 */
export class NoEncontradoError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'NoEncontradoError'
  }
}

export class NoAutorizadoError extends Error {
  constructor(mensaje = 'No autorizado') {
    super(mensaje)
    this.name = 'NoAutorizadoError'
  }
}

export class LiquidacionDuplicadaError extends Error {
  constructor(mensaje = 'Ya existe una liquidación para ese periodo') {
    super(mensaje)
    this.name = 'LiquidacionDuplicadaError'
  }
}
