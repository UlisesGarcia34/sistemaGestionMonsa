import { z } from "zod";

export const tipoServicioEntregaEnum = z.enum([
  "CY_PUERTO",
  "DENTRO_BL_RAIL",
  "DENTRO_BL_TRUCK",
  "FUERA_BL_CAMION",
  "RAM",
]);

// El Routing Order son las instrucciones formales que el cliente entrega
// despues de aceptar la cotizacion (gate 2) y antes de que exista el booking.
// Todos los campos de contenido son opcionales: el cliente puede entregarlas
// por partes y Customer Service completa lo que falte antes de marcarlo RECIBIDO.
const texto = z.string().trim().nullish();

export const crearRoutingOrderSchema = z.object({
  cotizacionId: z.string().uuid(),
  shipperNombre: z.string().trim().optional(),
  shipperDireccion: z.string().trim().optional(),
  pol: z.string().trim().optional(),
  pod: z.string().trim().optional(),
  destinoFinal: z.string().trim().optional(),
  tipoServicioEntrega: tipoServicioEntregaEnum.optional(),
  especificaciones: z.string().trim().optional(),
  agenteId: z.string().uuid().nullish(),
});

// La cotizacion de origen NO se reapunta: el RO es 1:1 con ella.
export const actualizarRoutingOrderSchema = z.object({
  shipperNombre: texto,
  shipperDireccion: texto,
  pol: texto,
  pod: texto,
  destinoFinal: texto,
  tipoServicioEntrega: tipoServicioEntregaEnum.nullish(),
  especificaciones: texto,
  agenteId: z.string().uuid().nullish(),
});

export type CrearRoutingOrderInput = z.infer<typeof crearRoutingOrderSchema>;
export type ActualizarRoutingOrderInput = z.infer<typeof actualizarRoutingOrderSchema>;
