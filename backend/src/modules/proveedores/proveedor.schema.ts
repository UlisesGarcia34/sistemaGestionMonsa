import { z } from "zod";

export const tipoProveedorEnum = z.enum([
  "NAVIERA",
  "AEROLINEA",
  "COLOADER",
  "AGENTE_ADUANAL",
  "TRANSPORTISTA",
  "ALMACEN",
  "SEGURO",
  "OTRO",
]);

export const crearProveedorSchema = z.object({
  nombre: z.string().min(2),
  tipo: tipoProveedorEnum,
  contactoNombre: z.string().optional(),
  contactoEmail: z.string().email().optional(),
  contactoTel: z.string().optional(),
});

export const crearTarifaSchema = z.object({
  origen: z.string().min(1),
  destino: z.string().min(1),
  modalidad: z.enum(["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"]),
  tipo: z.enum(["CONTRATO", "SPOT", "BASKET"]).default("CONTRATO"),
  montoCompra: z.number().positive(),
  moneda: z.string().default("USD"),
  vigenteDesde: z.coerce.date(),
  vigenteHasta: z.coerce.date().optional(),
});

// Edicion de un proveedor existente. Igual que en Cliente, el estatus no se
// escribe a mano: se mueve por activarProveedor (gate 4, exige tarifa vigente).
const opcionalTexto = z.string().trim().nullish();

export const actualizarProveedorSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio").optional(),
  tipo: tipoProveedorEnum.optional(),
  contactoNombre: opcionalTexto,
  contactoEmail: z.union([z.string().email("Correo invalido"), z.literal("")]).nullish(),
  contactoTel: opcionalTexto,
});

export type CrearProveedorInput = z.infer<typeof crearProveedorSchema>;
export type CrearTarifaInput = z.infer<typeof crearTarifaSchema>;
export type ActualizarProveedorInput = z.infer<typeof actualizarProveedorSchema>;
