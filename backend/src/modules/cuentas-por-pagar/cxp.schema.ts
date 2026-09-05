import { z } from "zod";

// Cuenta por pagar = lo que Monsa le debe a un proveedor por un embarque.
// Modela la hoja "CONTROL DE PAGOS" del Excel, pero con FK reales a
// Proveedor y Shipment en vez de folio de texto copiado a mano.
export const crearCxpSchema = z.object({
  proveedorId: z.string().uuid(),
  shipmentId: z.string().uuid().optional(),
  numeroFactura: z.string().optional(),
  monto: z.number().positive(),
  moneda: z.string().default("MXN"),
  fechaSolicitud: z.coerce.date().optional(),
  fechaLimitePago: z.coerce.date().optional(),
  esGarantia: z.boolean().default(false),
  comentarios: z.string().optional(),
});

export const registrarPagoSchema = z.object({
  fechaPagoConfirmado: z.coerce.date().optional(),
});

// Edicion de una cuenta por pagar. fechaPagoConfirmado no se edita aqui: se
// escribe solo por registrarPago, que es el evento de tesoreria.
export const actualizarCxpSchema = z.object({
  proveedorId: z.string().uuid().optional(),
  shipmentId: z.string().uuid().nullish(),
  numeroFactura: z.string().trim().nullish(),
  monto: z.number().positive().optional(),
  moneda: z.string().min(1).optional(),
  fechaSolicitud: z.coerce.date().nullish(),
  fechaLimitePago: z.coerce.date().nullish(),
  esGarantia: z.boolean().optional(),
  comentarios: z.string().trim().nullish(),
});

export type CrearCxpInput = z.infer<typeof crearCxpSchema>;
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
export type ActualizarCxpInput = z.infer<typeof actualizarCxpSchema>;
