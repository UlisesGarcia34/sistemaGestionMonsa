import { z } from "zod";

// Registrar un cobro (total o parcial) contra una cuenta por cobrar. Si la
// factura relacionada es FINAL + TIMBRADA + metodoPago PPD, este cobro genera
// automaticamente un ComplementoPago (ver cxc.service.registrarCobro); formaPago
// y numOperacion alimentan ese complemento.
export const registrarCobroSchema = z.object({
  monto: z.number().positive(),
  fechaCobro: z.coerce.date().optional(),
  comentarios: z.string().optional(),
  formaPago: z.string().trim().default("03"), // 03 = Transferencia electronica (clave SAT)
  numOperacion: z.string().trim().optional(),
  tipoCambio: z.number().positive().optional(),
});

// Edicion de la cuenta por cobrar. Solo se editan los terminos de cobranza:
// el monto viene de la factura (CFDI) y montoCobrado es el acumulado de los
// cobros registrados -- ninguno de los dos se reescribe a mano, o la cartera
// dejaria de cuadrar contra lo facturado.
export const actualizarCxcSchema = z.object({
  fechaVencimiento: z.coerce.date().nullish(),
  comentarios: z.string().trim().nullish(),
});

export type RegistrarCobroInput = z.infer<typeof registrarCobroSchema>;
export type ActualizarCxcInput = z.infer<typeof actualizarCxcSchema>;
