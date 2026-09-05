import { transaccion } from '@/shared/transaccion';
import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { ActualizarCxpInput, CrearCxpInput, RegistrarPagoInput } from "./cxp.schema";

// Alta de una cuenta por pagar. El proveedor debe existir; el shipment es
// opcional (hay pagos que no cuelgan de un embarque puntual, ej. garantias
// de contenedor globales) pero si se manda, tambien se valida.
export async function crearCuentaPorPagar(data: CrearCxpInput) {
  return transaccion(async tx => {
  const proveedor = await tx.proveedor.findUnique({ where: { id: data.proveedorId } });
  if (!proveedor) {
    throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  if (data.shipmentId) {
    const shipment = await tx.shipment.findUnique({ where: { id: data.shipmentId } });
    if (!shipment) {
      throw new ReglaDeNegocioError("Embarque no encontrado", 404);
    }
    if (shipment.status === "CANCELADO") throw new ReglaDeNegocioError("No se pueden asignar cuentas por pagar a un embarque CANCELADO");
  }

  return tx.cuentaPorPagar.create({
    data: {
      proveedorId: data.proveedorId,
      shipmentId: data.shipmentId,
      numeroFactura: data.numeroFactura,
      monto: data.monto,
      moneda: data.moneda,
      fechaSolicitud: data.fechaSolicitud ?? new Date(),
      fechaLimitePago: data.fechaLimitePago,
      esGarantia: data.esGarantia,
      comentarios: data.comentarios,
    },
  });
  });
}

// Una cuenta ya pagada no se edita: el monto y la fecha limite son lo que
// justifico la salida de dinero. Corregir un pago ya confirmado es una
// operacion de tesoreria distinta, no una edicion de captura.
export async function actualizarCuentaPorPagar(id: string, data: ActualizarCxpInput) {
  return transaccion(async tx => {
  const cuenta = await tx.cuentaPorPagar.findUnique({ where: { id } });
  if (!cuenta) {
    throw new ReglaDeNegocioError("Cuenta por pagar no encontrada", 404);
  }
  if (cuenta.fechaPagoConfirmado) {
    throw new ReglaDeNegocioError(
      "No se puede editar una cuenta con el pago ya confirmado"
    );
  }

  const limpio = limpiarEntrada(data);
  if (limpio.proveedorId) {
    const proveedor = await tx.proveedor.findUnique({ where: { id: limpio.proveedorId } });
    if (!proveedor) throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  if (limpio.shipmentId) {
    const shipment = await tx.shipment.findUnique({ where: { id: limpio.shipmentId } });
    if (!shipment) throw new ReglaDeNegocioError("Embarque no encontrado", 404);
    if (shipment.status === "CANCELADO") throw new ReglaDeNegocioError("No se pueden asignar cuentas por pagar a un embarque CANCELADO");
  }

  return tx.cuentaPorPagar.update({ where: { id }, data: limpio as never });
  });
}

export async function registrarPago(id: string, data: RegistrarPagoInput) {
  const cuenta = await prisma.cuentaPorPagar.findUnique({ where: { id } });
  if (!cuenta) {
    throw new ReglaDeNegocioError("Cuenta por pagar no encontrada", 404);
  }
  if (cuenta.fechaPagoConfirmado) {
    throw new ReglaDeNegocioError("Esta cuenta ya tiene el pago confirmado");
  }
  return prisma.cuentaPorPagar.update({
    where: { id },
    data: { fechaPagoConfirmado: data.fechaPagoConfirmado ?? new Date() },
  });
}

// estado = "pendiente" | "pagada". Sin filtro devuelve todo.
export async function listarCuentasPorPagar(estado?: string, proveedorId?: string) {
  return prisma.cuentaPorPagar.findMany({
    where: {
      proveedorId: proveedorId || undefined,
      fechaPagoConfirmado:
        estado === "pendiente" ? null : estado === "pagada" ? { not: null } : undefined,
    },
    include: {
      proveedor: true,
      shipment: { select: { folio: true, consignee: { select: { razonSocial: true } } } },
    },
    orderBy: [{ fechaPagoConfirmado: "asc" }, { fechaLimitePago: "asc" }],
  });
}

// Totales para el encabezado del submodulo (pendiente por pagar y vencido).
export async function resumenCuentasPorPagar() {
  const pendientes = await prisma.cuentaPorPagar.findMany({
    where: { fechaPagoConfirmado: null },
    select: { monto: true, moneda: true, fechaLimitePago: true },
  });
  const hoy = new Date();
  let totalPendiente = 0;
  let totalVencido = 0;
  for (const c of pendientes) {
    const monto = Number(c.monto);
    totalPendiente += monto;
    if (c.fechaLimitePago && c.fechaLimitePago < hoy) totalVencido += monto;
  }
  return {
    cuentasPendientes: pendientes.length,
    totalPendiente,
    totalVencido,
  };
}
