import { z } from "zod";

export const tipoConocimientoSchema = z.enum(["HBL", "MBL"]);

// Envio de un documento por correo al cliente. El destinatario llega
// prellenado desde la UI con el correo del cliente, pero es editable: en la
// practica el aviso va a una lista de trafico, no siempre al contacto de alta.
export const enviarDocumentoSchema = z.object({
  para: z.string().email("Correo del destinatario invalido"),
  copia: z.array(z.string().email("Correo en copia invalido")).max(10).optional(),
  asunto: z.string().min(1, "El asunto es obligatorio").max(200),
  cuerpo: z.string().min(1, "El cuerpo del correo es obligatorio"),
  // Adjuntar el PDF generado. Se puede desactivar para mandar solo el aviso.
  adjuntarPdf: z.boolean().default(true),
});

export type EnviarDocumentoInput = z.infer<typeof enviarDocumentoSchema>;
