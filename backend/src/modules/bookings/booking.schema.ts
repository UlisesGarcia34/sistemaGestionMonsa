import { z } from "zod";

// Este modulo no tenia schema Zod: el controller pasaba req.body crudo al
// service. Al agregar la edicion se completa el patron de 4 archivos del
// proyecto (CLAUDE.md seccion 4.1) para creacion y edicion por igual.
export const crearBookingSchema = z.object({
  cotizacionId: z.string().uuid(),
  proveedorId: z.string().uuid(),
  referencia: z.string().trim().optional(),
});

// La cotizacion de origen NO es editable: el booking es 1:1 con ella y
// reapuntarlo a otra cotizacion romperia la trazabilidad del margen del
// embarque. Cambiar de cotizacion = booking nuevo.
export const actualizarBookingSchema = z.object({
  proveedorId: z.string().uuid().optional(),
  referencia: z.string().trim().nullish(),
});

export type CrearBookingInput = z.infer<typeof crearBookingSchema>;
export type ActualizarBookingInput = z.infer<typeof actualizarBookingSchema>;
