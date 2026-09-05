import { z } from "zod";

export const modalidadTarifaEnum = z.enum([
  "FCL",
  "LCL",
  "AEREO",
  "TERRESTRE",
  "FTL",
  "LTL",
  "SEGURO",
]);

// Contrato (fija por vigencia), spot (puntual) o basket (escalonada por
// producto/volumen). Clasifica el origen del precio; no cambia como se cotiza.
export const tipoTarifaEnum = z.enum(["CONTRATO", "SPOT", "BASKET"]);

// Alta de una tarifa de compra (buy rate). A diferencia de
// POST /api/proveedores/:id/tarifas, aqui el proveedor viaja en el body: el
// modulo Pricing es una vista transversal de todas las tarifas, no del
// expediente de un proveedor.
export const crearTarifaSchema = z.object({
  proveedorId: z.string().uuid(),
  origen: z.string().trim().min(1, "El origen es obligatorio"),
  destino: z.string().trim().min(1, "El destino es obligatorio"),
  modalidad: modalidadTarifaEnum,
  tipo: tipoTarifaEnum.default("CONTRATO"),
  montoCompra: z.coerce.number().positive("El monto de compra debe ser mayor a cero"),
  moneda: z.string().trim().min(1).default("USD"),
  vigenteDesde: z.coerce.date(),
  vigenteHasta: z.coerce.date().nullish(),
});

// Edicion. El proveedor no se reapunta: una tarifa pertenece a quien la cotiza.
const fecha = z
  .union([z.coerce.date(), z.literal(""), z.null()])
  .nullish()
  .transform((v) => (v === "" ? null : v));

export const actualizarTarifaSchema = z.object({
  origen: z.string().trim().min(1).optional(),
  destino: z.string().trim().min(1).optional(),
  modalidad: modalidadTarifaEnum.optional(),
  tipo: tipoTarifaEnum.optional(),
  montoCompra: z.coerce.number().positive().optional(),
  moneda: z.string().trim().min(1).optional(),
  vigenteDesde: z.coerce.date().optional(),
  vigenteHasta: fecha,
});

export type CrearTarifaInput = z.infer<typeof crearTarifaSchema>;
export type ActualizarTarifaInput = z.infer<typeof actualizarTarifaSchema>;
