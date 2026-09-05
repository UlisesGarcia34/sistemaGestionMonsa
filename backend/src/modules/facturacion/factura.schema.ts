import { z } from "zod";

const opcionalTexto = z.string().trim().nullish();

// Alta rapida: un monto -> nace UN concepto automatico (ver
// factura.service.crearFactura). Los datos fiscales snapshot (regimen/uso
// CFDI/CP del receptor) se copian del Cliente, no se piden aqui.
export const crearFacturaSchema = z.object({
  shipmentId: z.string().uuid(),
  // PROFORMA se pide durante el seguimiento (no timbra, no genera cuenta por
  // cobrar); FINAL sigue el flujo fiscal completo.
  tipo: z.enum(["PROFORMA", "FINAL"]).default("FINAL"),
  montoSinIva: z.number().positive(),
  moneda: z.string().min(1).default("USD"),
  formaPago: z.string().trim().default("99"), // 99 = Por definir (clave SAT c_FormaPago)
  metodoPago: z.enum(["PUE", "PPD"]).default("PUE"),
  condicionesPago: z.string().trim().optional(),
  tipoCambio: z.number().positive().optional(),
});

// Solo se edita mientras la factura sigue BORRADOR: despues de "enviar a
// timbrado" la captura queda congelada, y despues del timbrado el CFDI es un
// documento fiscal emitido (corregirlo es cancelar + refacturar ante el PAC).
// montoSinIva NO se edita aqui: es la suma de los conceptos, se edita via
// PUT /api/facturas/:id/conceptos.
export const actualizarFacturaSchema = z.object({
  moneda: z.string().min(1).optional(),
  formaPago: opcionalTexto,
  metodoPago: z.enum(["PUE", "PPD"]).optional(),
  condicionesPago: opcionalTexto,
  tipoCambio: z.number().positive().nullish(),
  retencionIvaTasa: z.number().nonnegative().nullish(),
  retencionIsrTasa: z.number().nonnegative().nullish(),
});

export const timbrarSchema = z.object({
  cfdiUuid: z.string().min(1, "El UUID del CFDI es obligatorio"),
});

// Cancelacion (solo desde TIMBRADA). motivoCancelacion es la clave del
// catalogo SAT c_MotivoCancelacion (01-04, GET /api/catalogos-sat/motivo-cancelacion).
// folioSustitucionUuid es obligatorio solo para el motivo 01 -- el service lo
// valida contra SatMotivoCancelacion.requiereFolioSustitucion, no aqui.
export const cancelarFacturaSchema = z.object({
  motivoCancelacion: z.string().trim().min(1, "El motivo de cancelacion es obligatorio"),
  folioSustitucionUuid: z.string().trim().optional(),
});

// Una linea del CFDI. importe e ivaImporte se calculan en el service
// (cantidad * valorUnitario, importe * ivaTasa/100): no se confia en que el
// cliente los mande ya multiplicados.
const conceptoSchema = z.object({
  claveProdServ: z.string().trim().min(1, "La clave de producto/servicio es obligatoria"),
  claveUnidad: z.string().trim().min(1, "La clave de unidad es obligatoria"),
  unidad: z.string().trim().optional(),
  cantidad: z.number().positive().default(1),
  descripcion: z.string().trim().min(1, "La descripcion es obligatoria"),
  valorUnitario: z.number().positive(),
  objetoImpuesto: z.string().trim().default("02"),
  ivaTasa: z.number().nonnegative().default(16),
});

export const actualizarConceptosSchema = z.object({
  conceptos: z.array(conceptoSchema).min(1, "La factura debe tener al menos un concepto"),
});

export type CrearFacturaInput = z.infer<typeof crearFacturaSchema>;
export type ActualizarFacturaInput = z.infer<typeof actualizarFacturaSchema>;
export type ActualizarConceptosInput = z.infer<typeof actualizarConceptosSchema>;
export type ConceptoInput = z.infer<typeof conceptoSchema>;
export type CancelarFacturaInput = z.infer<typeof cancelarFacturaSchema>;
