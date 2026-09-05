import { z } from "zod";

export const crearCotizacionSchema = z.object({
  clienteId: z.string().uuid(),
  vendedorId: z.string().uuid(),
  incoterm: z.string(),
  modalidad: z.enum(["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"]),
  origen: z.string(),
  destino: z.string(),
  montoVenta: z.number().positive(),
  montoCompra: z.number().positive(),
  moneda: z.string().default("USD"),
  validaHasta: z.coerce.date().optional(),
  // true = cotizacion estimada para un prospecto (no requiere cliente activo)
  esEstimado: z.boolean().default(false),
});

// Edicion de una cotizacion. El status no se escribe aqui (se mueve por
// marcarAceptada, gate 2) y el cliente tampoco se cambia: una cotizacion que
// cambia de cliente es una cotizacion nueva, no una edicion -- si se permitiera,
// el folio y el margen dejarian de corresponder al cliente al que se envio.
export const actualizarCotizacionSchema = z.object({
  vendedorId: z.string().uuid().optional(),
  incoterm: z.string().min(1).optional(),
  modalidad: z.enum(["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"]).optional(),
  origen: z.string().min(1).optional(),
  destino: z.string().min(1).optional(),
  montoVenta: z.number().positive().optional(),
  montoCompra: z.number().positive().optional(),
  moneda: z.string().min(1).optional(),
  validaHasta: z.coerce.date().nullish(),
});

export type CrearCotizacionInput = z.infer<typeof crearCotizacionSchema>;
export type ActualizarCotizacionInput = z.infer<typeof actualizarCotizacionSchema>;
