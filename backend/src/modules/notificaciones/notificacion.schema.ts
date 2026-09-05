import { z } from "zod";

export const tipoNotificacionEnum = z.enum([
  "CUTOFF_DOCUMENTAL",
  "CUTOFF_CONTENEDOR",
  "ETD",
  "ETA",
  "AVISO_ARRIBO",
  "SOLICITUD_FACTURA",
  "OTRO",
]);

// Registrar que se envio un aviso puntual al cliente. El shipment viene del
// path y el autor (enviadoPorId) del token; el cuerpo solo trae que se aviso.
export const crearNotificacionSchema = z.object({
  tipo: tipoNotificacionEnum,
  comentario: z.string().trim().optional(),
});

export type CrearNotificacionInput = z.infer<typeof crearNotificacionSchema>;
