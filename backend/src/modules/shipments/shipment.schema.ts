import { z } from "zod";

export const tipoOperacionEnum = z.enum(["IMPORTACION", "EXPORTACION", "TERRESTRE"]);
export const modalidadEnum = z.enum([
  "FCL",
  "LCL",
  "AEREO",
  "TERRESTRE",
  "FTL",
  "LTL",
  "SEGURO",
]);
export const statusShipmentEnum = z.enum([
  "NUEVO_EMBARQUE",
  "BOOKING_CONFIRMED",
  "PARA_CERRAR",
  "PARA_FACTURAR",
  "FACTURADO",
  "CANCELADO",
  "TERMINADO",
]);

const texto = z.string().trim().nullish();
// Las fechas operativas llegan del <input type="date"> como "" cuando el
// usuario las borra; coerce.date() no acepta "", asi que "" se mapea a null
// explicitamente antes de intentar parsear (mismo motivo que limpiarEntrada).
const fecha = z.preprocess((v) => v === "" ? null : v, z.coerce.date().nullish());
const decimal = z
  .union([z.number().finite().nonnegative(), z.literal(""), z.null()])
  .nullish()
  .transform((v) => (v === "" ? null : v));
const booleano = z.boolean().optional();
const estatusEmisionEnum = z.enum(["DRAFT", "FINAL"]);

export const crearShipmentSchema = z.object({
  bookingId: z.string().uuid(),
  tipoOperacion: tipoOperacionEnum,
  modalidad: modalidadEnum,
  consigneeId: z.string().uuid(),
  shipperNombre: z.string().trim().min(1, "El shipper es obligatorio"),
  customerServiceId: z.string().uuid().nullish(),
});

// Edicion operativa completa del embarque. Deliberadamente NO incluye:
//  - folio      : lo asigna el sistema al crearlo (gate 5), no se reescribe.
//  - bookingId  : el embarque es 1:1 con su booking; reapuntarlo romperia la
//                 trazabilidad de la cotizacion y del margen.
//  - status     : se mueve por cerrarShipment / crearFactura, no a mano.
export const actualizarShipmentSchema = z.object({
  version: z.number().int().nonnegative(),
  tipoOperacion: tipoOperacionEnum.optional(),
  modalidad: modalidadEnum.optional(),
  consigneeId: z.string().uuid().optional(),
  shipperNombre: z.string().trim().min(1).optional(),
  customerServiceId: z.string().uuid().nullish(),
  estatusMaterial: texto,
  incoterm: texto,
  poCliente: texto,
  vessel: texto,
  voyage: texto,
  puertoOrigen: texto,
  paisOrigen: texto,
  puertoDestino: texto,
  destinoFinal: texto,
  etd: fecha,
  eta: fecha,
  fechaArriboReal: fecha,
  fechaLiberacion: fecha,
  grossWeight: decimal,
  cbm: decimal,
  totalItems: z
    .union([z.number().int().nonnegative(), z.literal(""), z.null()])
    .nullish()
    .transform((v) => (v === "" ? null : v)),
  // Expediente fisico y seguimiento de Operaciones (revalidacion / BL endosado).
  expedienteFisico: booleano,
  fechaRevalidacionNaviera: fecha,
  blEndosadoEnviado: booleano,
  fechaBlEndosadoEnviado: fecha,
});

// Valorizacion: Ventas confirma costo y venta REALES del embarque antes de
// facturar. Es el paso previo al gate 6.
export const confirmarValorizacionSchema = z.object({
  version: z.number().int().nonnegative(),
  valorizacionVenta: z.number().finite().nonnegative().max(999999999999.99),
  valorizacionCompra: z.number().finite().nonnegative().max(999999999999.99),
});

// Tracking rapido: subconjunto de la edicion, pensado para la actualizacion
// diaria de operaciones sin abrir el formulario completo.
export const actualizarTrackingSchema = z.object({
  version: z.number().int().nonnegative(),
  estatusMaterial: texto,
  etd: fecha,
  eta: fecha,
  fechaArriboReal: fecha,
  fechaLiberacion: fecha,
}).strict();

// Documentacion del embarque (1:1 con Shipment). Es lo que habilita los
// reportes de HBL y MBL: sin estos campos capturados no hay documento que
// imprimir (ver modules/reportes).
export const actualizarDocumentoSchema = z.object({
  version: z.number().int().nonnegative(),
  mbl: texto,
  hbl: texto,
  manifiesto: texto,
  // "" (el usuario limpio el select) -> null; si no, DRAFT / FINAL.
  estatusEmisionHbl: z
    .union([estatusEmisionEnum, z.literal(""), z.null()])
    .nullish()
    .transform((v) => (v === "" ? null : v)),
  estatusEmisionMbl: z
    .union([estatusEmisionEnum, z.literal(""), z.null()])
    .nullish()
    .transform((v) => (v === "" ? null : v)),
  cartaInstruccionesUrl: texto,
});

export type CrearShipmentInput = z.infer<typeof crearShipmentSchema>;
export type ActualizarShipmentInput = z.infer<typeof actualizarShipmentSchema>;
export type ActualizarTrackingInput = z.infer<typeof actualizarTrackingSchema>;
export type ActualizarDocumentoInput = z.infer<typeof actualizarDocumentoSchema>;
export type ConfirmarValorizacionInput = z.infer<typeof confirmarValorizacionSchema>;

export const versionShipmentSchema = z.object({ version: z.number().int().nonnegative() }).strict();
export const cancelarShipmentSchema = versionShipmentSchema.extend({
  motivo: z.string().trim().min(5, "Describe el motivo de cancelacion (minimo 5 caracteres)").max(2000),
});
const fechaFiltro = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Fecha invalida").optional();
export const filtrosShipmentSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: statusShipmentEnum.optional(),
  tipoOperacion: tipoOperacionEnum.optional(),
  modalidad: modalidadEnum.optional(),
  clienteId: z.string().uuid().optional(),
  customerServiceId: z.string().uuid().optional(),
  desde: fechaFiltro,
  hasta: fechaFiltro,
}).refine((p) => !p.desde || !p.hasta || p.desde <= p.hasta, {
  message: "La fecha inicial debe ser anterior o igual a la final", path: ["hasta"],
});
export const paginaShipmentSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["creadoEn", "folio", "eta"]).default("creadoEn"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type FiltrosShipment = z.infer<typeof filtrosShipmentSchema>;
