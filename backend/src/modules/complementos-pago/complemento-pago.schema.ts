import { z } from "zod";

// No hay schema de creacion: un ComplementoPago nace SOLO desde
// cuentas-por-cobrar/cxc.service.registrarCobro, nunca por POST directo (ver
// docs/superpowers/specs/2026-09-04-facturacion-contable-design.md seccion 4).
// Aqui solo vive lo que un usuario si controla: mandarlo a timbrado y
// timbrarlo (simulado), mismo patron que Factura.

export const timbrarComplementoSchema = z.object({
  cfdiUuid: z.string().min(1, "El UUID del CFDI es obligatorio"),
});

// Mismo criterio que Factura: motivoCancelacion es clave del catalogo SAT
// c_MotivoCancelacion; folioSustitucionUuid solo obligatorio para el motivo 01.
export const cancelarComplementoSchema = z.object({
  motivoCancelacion: z.string().trim().min(1, "El motivo de cancelacion es obligatorio"),
  folioSustitucionUuid: z.string().trim().optional(),
});

export type TimbrarComplementoInput = z.infer<typeof timbrarComplementoSchema>;
export type CancelarComplementoInput = z.infer<typeof cancelarComplementoSchema>;
