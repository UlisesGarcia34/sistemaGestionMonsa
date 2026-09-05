import { z } from "zod";

export const crearClienteSchema = z.object({
  razonSocial: z.string().min(2, "La razon social es obligatoria"),
  alias: z.string().optional(),
  rfc: z.string().optional(),
  contactoNombre: z.string().optional(),
  contactoEmail: z.string().email().optional(),
  contactoTel: z.string().optional(),
});

export const activarClienteSchema = z.object({
  rfc: z.string().min(10, "RFC invalido"),
  limiteCredito: z.number().nonnegative(),
  diasCredito: z.number().int().nonnegative(),
});

// Edicion de un cliente ya existente. El estatus NO es editable aqui: se mueve
// solo por el flujo de activacion (gate 1), nunca escribiendolo a mano.
// Los campos opcionales aceptan "" y null para poder vaciar un dato desde la UI.
const opcionalTexto = z.string().trim().nullish();

export const actualizarClienteSchema = z.object({
  razonSocial: z.string().min(2, "La razon social es obligatoria").optional(),
  alias: opcionalTexto,
  rfc: opcionalTexto,
  contactoNombre: opcionalTexto,
  contactoEmail: z.union([z.string().email("Correo invalido"), z.literal("")]).nullish(),
  contactoTel: opcionalTexto,
  limiteCredito: z.number().nonnegative().nullish(),
  diasCredito: z.number().int().nonnegative().nullish(),
  // Datos fiscales del receptor para el CFDI (se copian a la Factura al
  // emitirla, ver factura.service.crearFactura).
  regimenFiscal: opcionalTexto,
  usoCfdi: opcionalTexto,
  codigoPostal: opcionalTexto,
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type ActivarClienteInput = z.infer<typeof activarClienteSchema>;
export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>;
