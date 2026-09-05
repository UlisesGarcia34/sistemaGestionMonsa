import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { ActualizarCxcInput, RegistrarCobroInput } from "./cxc.schema";

// Consecutivo del folio del complemento de pago, mismo criterio que las demas
// series del sistema (deriva del maximo existente, tolera huecos).
async function siguienteFolioComplemento() {
  const prefijo = "MGC-PAGO-";
  const ultimo = await prisma.complementoPago.findFirst({
    where: { folio: { startsWith: prefijo } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  const consecutivo = ultimo ? Number(ultimo.folio.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(6, "0")}`;
}

// Se llama desde factura.service.marcarTimbrada: la cuenta por cobrar nace
// junto con el CFDI timbrado, no antes (una factura en BORRADOR/PENDIENTE_
// TIMBRADO todavia no es un CFDI real). La fecha de vencimiento sale de los
// dias de credito del cliente (si no tiene, queda null y se trata como "de
// contado").
export async function crearDesdeFactura(facturaId: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cuentaPorCobrar: true,
      shipment: { include: { consignee: true } },
    },
  });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.cuentaPorCobrar) {
    return factura.cuentaPorCobrar;
  }

  const cliente = factura.shipment.consignee;
  const fechaEmision = new Date();
  let fechaVencimiento: Date | null = null;
  if (cliente.diasCredito && cliente.diasCredito > 0) {
    fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + cliente.diasCredito);
  }

  return prisma.cuentaPorCobrar.create({
    data: {
      facturaId: factura.id,
      clienteId: cliente.id,
      monto: factura.montoSinIva,
      moneda: factura.moneda,
      fechaEmision,
      fechaVencimiento,
    },
  });
}

// Registra un cobro (total o parcial). Si la factura relacionada es FINAL +
// TIMBRADA + metodoPago PPD, este cobro genera automaticamente un
// ComplementoPago en BORRADOR -- nunca a mano, para que jamas se desincronice
// de un cobro real (docs/superpowers/specs/2026-09-04-facturacion-contable-
// design.md seccion 4). Un cobro contra una factura PUE no genera complemento:
// ya esta saldada en el CFDI original.
export async function registrarCobro(id: string, data: RegistrarCobroInput) {
  const cuenta = await prisma.cuentaPorCobrar.findUnique({
    where: { id },
    include: { factura: true },
  });
  if (!cuenta) {
    throw new ReglaDeNegocioError("Cuenta por cobrar no encontrada", 404);
  }
  if (cuenta.estatusCobro === "COBRADA") {
    throw new ReglaDeNegocioError("Esta cuenta ya esta cobrada por completo");
  }

  const saldoAnterior = Number(cuenta.monto) - Number(cuenta.montoCobrado);
  const cobradoNuevo = Number(cuenta.montoCobrado) + data.monto;
  const total = Number(cuenta.monto);
  if (cobradoNuevo > total + 0.01) {
    throw new ReglaDeNegocioError(
      `El cobro excede el saldo pendiente (${(total - Number(cuenta.montoCobrado)).toFixed(2)} ${cuenta.moneda})`
    );
  }

  const liquidada = cobradoNuevo >= total - 0.01;
  const actualizada = await prisma.cuentaPorCobrar.update({
    where: { id },
    data: {
      montoCobrado: cobradoNuevo,
      estatusCobro: liquidada ? "COBRADA" : "PARCIAL",
      fechaCobro: liquidada ? data.fechaCobro ?? new Date() : cuenta.fechaCobro,
      comentarios: data.comentarios ?? cuenta.comentarios,
    },
  });

  if (cuenta.factura.tipo === "FINAL" && cuenta.factura.estatus === "TIMBRADA" && cuenta.factura.metodoPago === "PPD") {
    await prisma.complementoPago.create({
      data: {
        facturaId: cuenta.factura.id,
        folio: await siguienteFolioComplemento(),
        fechaPago: data.fechaCobro ?? new Date(),
        monto: data.monto,
        moneda: cuenta.moneda,
        tipoCambio: data.tipoCambio,
        formaPago: data.formaPago,
        numOperacion: data.numOperacion,
        saldoAnterior,
        saldoInsoluto: total - cobradoNuevo,
      },
    });
  }

  return actualizada;
}

export async function actualizarCuentaPorCobrar(id: string, data: ActualizarCxcInput) {
  const cuenta = await prisma.cuentaPorCobrar.findUnique({ where: { id } });
  if (!cuenta) {
    throw new ReglaDeNegocioError("Cuenta por cobrar no encontrada", 404);
  }
  if (cuenta.estatusCobro === "COBRADA") {
    throw new ReglaDeNegocioError("No se puede editar una cuenta ya cobrada");
  }
  return prisma.cuentaPorCobrar.update({ where: { id }, data: limpiarEntrada(data) as never });
}

// El estatus VENCIDA no se persiste (no hay cron en el MVP): se deriva al leer
// comparando fechaVencimiento con hoy para cualquier cuenta no cobrada.
function conVencimiento<T extends { estatusCobro: string; fechaVencimiento: Date | null }>(
  cuenta: T
) {
  const vencida =
    cuenta.estatusCobro !== "COBRADA" &&
    !!cuenta.fechaVencimiento &&
    cuenta.fechaVencimiento < new Date();
  return { ...cuenta, vencida, estatusCobro: vencida ? "VENCIDA" : cuenta.estatusCobro };
}

export async function listarCuentasPorCobrar(estado?: string, clienteId?: string) {
  const cuentas = await prisma.cuentaPorCobrar.findMany({
    where: { clienteId: clienteId || undefined },
    include: {
      cliente: { select: { razonSocial: true } },
      factura: {
        select: {
          numeroFactura: true,
          shipment: { select: { folio: true } },
        },
      },
    },
    orderBy: [{ estatusCobro: "asc" }, { fechaVencimiento: "asc" }],
  });
  const conEstado = cuentas.map(conVencimiento);
  if (estado === "pendiente") {
    return conEstado.filter((c) => c.estatusCobro !== "COBRADA");
  }
  if (estado === "cobrada") {
    return conEstado.filter((c) => c.estatusCobro === "COBRADA");
  }
  if (estado === "vencida") {
    return conEstado.filter((c) => c.vencida);
  }
  return conEstado;
}

export async function resumenCuentasPorCobrar() {
  const cuentas = await prisma.cuentaPorCobrar.findMany({
    select: { monto: true, montoCobrado: true, estatusCobro: true, fechaVencimiento: true },
  });
  const hoy = new Date();
  let totalPorCobrar = 0;
  let totalVencido = 0;
  let cuentasAbiertas = 0;
  for (const c of cuentas) {
    if (c.estatusCobro === "COBRADA") continue;
    const saldo = Number(c.monto) - Number(c.montoCobrado);
    totalPorCobrar += saldo;
    cuentasAbiertas += 1;
    if (c.fechaVencimiento && c.fechaVencimiento < hoy) totalVencido += saldo;
  }
  return { cuentasAbiertas, totalPorCobrar, totalVencido };
}
