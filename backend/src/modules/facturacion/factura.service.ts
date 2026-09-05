import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { crearDesdeFactura } from "@/modules/cuentas-por-cobrar/cxc.service";
import {
  ActualizarConceptosInput,
  ActualizarFacturaInput,
  CancelarFacturaInput,
  CrearFacturaInput,
} from "./factura.schema";

// Consecutivo derivado del numero maximo existente (no de count()) para
// tolerar huecos -- el seed carga los numeros de factura reales del Excel
// (MGC-FACT-000002, 000003, 000005). La proforma usa su propia serie
// (MGC-PROF-) para no consumir folios de la serie fiscal.
async function siguienteNumero(prefijo: string) {
  const ultima = await prisma.factura.findFirst({
    where: { numeroFactura: { startsWith: prefijo } },
    orderBy: { numeroFactura: "desc" },
    select: { numeroFactura: true },
  });
  const consecutivo = ultima ? Number(ultima.numeroFactura.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(6, "0")}`;
}

const SEGUIMIENTO_ACTIVO = [
  "NUEVO_EMBARQUE",
  "BOOKING_CONFIRMED",
  "PARA_CERRAR",
  "PARA_FACTURAR",
];

const INCLUDE_FACTURA = {
  shipment: { include: { consignee: true } },
  cuentaPorCobrar: true,
  conceptos: true,
  complementosPago: true,
};

// Gates 6 y 7 de la cascada:
//  - gate 6 (ambos tipos): el embarque debe tener la valorizacion confirmada
//    por Ventas (costo y venta reales).
//  - gate 7 (solo FINAL): el embarque debe estar cerrado (PARA_FACTURAR). Una
//    PROFORMA se pide durante el seguimiento, asi que solo exige que el
//    embarque este vivo.
//
// La factura SIEMPRE nace en BORRADOR (docs/superpowers/specs/2026-09-04-
// facturacion-contable-design.md seccion 3): no timbra, no genera cuenta por
// cobrar ni mueve el status del embarque todavia -- eso pasa hasta
// marcarTimbrada. Nace con UN concepto automatico calcado del monto capturado;
// el contador lo puede editar mientras siga BORRADOR.
export async function crearFactura(data: CrearFacturaInput) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: data.shipmentId },
    include: { facturas: true, consignee: true },
  });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }

  // Gate 6: valorizacion confirmada.
  if (!shipment.valorizacionConfirmada) {
    throw new ReglaDeNegocioError(
      "No se puede facturar: falta confirmar la valorizacion (costo y venta reales) con Ventas"
    );
  }

  if (shipment.facturas.some((f) => f.tipo === data.tipo)) {
    throw new ReglaDeNegocioError(
      `Este embarque ya tiene una factura ${data.tipo === "PROFORMA" ? "proforma" : "final"}`
    );
  }

  if (data.tipo === "PROFORMA" && !SEGUIMIENTO_ACTIVO.includes(shipment.status)) {
    throw new ReglaDeNegocioError(
      `No se puede emitir la proforma: el embarque esta en status ${shipment.status}`
    );
  }
  // FINAL: gate 7.
  if (data.tipo === "FINAL" && shipment.status !== "PARA_FACTURAR") {
    throw new ReglaDeNegocioError(
      "No se puede facturar: el embarque debe estar cerrado (PARA_FACTURAR)"
    );
  }

  const numeroFactura = await siguienteNumero(data.tipo === "PROFORMA" ? "MGC-PROF-" : "MGC-FACT-");
  const ivaImporte = data.montoSinIva * 0.16;
  const cliente = shipment.consignee;

  return prisma.factura.create({
    data: {
      shipmentId: data.shipmentId,
      tipo: data.tipo,
      numeroFactura,
      montoSinIva: data.montoSinIva,
      moneda: data.moneda,
      formaPago: data.formaPago,
      metodoPago: data.metodoPago,
      condicionesPago: data.condicionesPago,
      tipoCambio: data.tipoCambio,
      // Snapshot fiscal del receptor: si despues se edita el Cliente, este
      // CFDI no debe cambiar retroactivamente.
      regimenFiscalReceptor: cliente.regimenFiscal,
      usoCfdi: cliente.usoCfdi,
      codigoPostalReceptor: cliente.codigoPostal,
      conceptos: {
        create: {
          // Default razonable, no es asesoria fiscal: el contador lo ajusta
          // durante la revision en BORRADOR si el caso lo requiere.
          claveProdServ: "78101803", // Servicios de agenciamiento de fletes
          claveUnidad: "E48", // Unidad de servicio
          unidad: "Servicio",
          cantidad: 1,
          descripcion: `Servicio de freight forwarding - Embarque ${shipment.folio}`,
          valorUnitario: data.montoSinIva,
          importe: data.montoSinIva,
          objetoImpuesto: "02",
          ivaTasa: 16,
          ivaImporte,
        },
      },
    },
    include: INCLUDE_FACTURA,
  });
}

// Solo se edita mientras sigue BORRADOR: "enviar a timbrado" congela la
// captura, y timbrada ya es un CFDI emitido. montoSinIva no se edita aqui: es
// la suma de los conceptos (ver actualizarConceptos).
export async function actualizarFactura(id: string, data: ActualizarFacturaInput) {
  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.estatus !== "BORRADOR") {
    throw new ReglaDeNegocioError(
      `No se puede editar: la factura esta en estatus ${factura.estatus}. Solo BORRADOR es editable.`
    );
  }
  return prisma.factura.update({ where: { id }, data, include: INCLUDE_FACTURA });
}

// Reemplaza las lineas del CFDI y recalcula montoSinIva. El importe y el IVA
// de cada linea se calculan aqui (cantidad * valorUnitario, importe *
// ivaTasa/100): no se confia en un total que el cliente ya haya multiplicado.
export async function actualizarConceptos(facturaId: string, data: ActualizarConceptosInput) {
  const factura = await prisma.factura.findUnique({ where: { id: facturaId } });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.estatus !== "BORRADOR") {
    throw new ReglaDeNegocioError(
      `No se pueden editar los conceptos: la factura esta en estatus ${factura.estatus}.`
    );
  }

  const conceptos = data.conceptos.map((c) => {
    const importe = c.cantidad * c.valorUnitario;
    return {
      claveProdServ: c.claveProdServ,
      claveUnidad: c.claveUnidad,
      unidad: c.unidad,
      cantidad: c.cantidad,
      descripcion: c.descripcion,
      valorUnitario: c.valorUnitario,
      importe,
      objetoImpuesto: c.objetoImpuesto,
      ivaTasa: c.ivaTasa,
      ivaImporte: importe * (c.ivaTasa / 100),
    };
  });
  const montoSinIva = conceptos.reduce((acc, c) => acc + c.importe, 0);

  return prisma.$transaction(async (tx) => {
    await tx.conceptoFactura.deleteMany({ where: { facturaId } });
    await tx.conceptoFactura.createMany({
      data: conceptos.map((c) => ({ ...c, facturaId })),
    });
    return tx.factura.update({
      where: { id: facturaId },
      data: { montoSinIva },
      include: INCLUDE_FACTURA,
    });
  });
}

// Congela la captura antes de mandarla al PAC. Solo aplica a FINAL: una
// PROFORMA nunca timbra, se queda en BORRADOR (es una referencia para el
// cliente, no un CFDI).
export async function enviarATimbrado(id: string) {
  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.tipo !== "FINAL") {
    throw new ReglaDeNegocioError("Una proforma no se envia a timbrado");
  }
  if (factura.estatus !== "BORRADOR") {
    throw new ReglaDeNegocioError(`La factura ya esta en estatus ${factura.estatus}`);
  }
  return prisma.factura.update({
    where: { id },
    data: { estatus: "PENDIENTE_TIMBRADO" },
    include: INCLUDE_FACTURA,
  });
}

export async function obtenerFactura(id: string) {
  const factura = await prisma.factura.findUnique({ where: { id }, include: INCLUDE_FACTURA });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  return factura;
}

// Totales para el encabezado del submodulo Facturacion dentro de Finanzas.
// El monto facturado real solo cuenta las FINAL ya timbradas: una proforma no
// es ingreso, y una FINAL en borrador/pendiente todavia no es un CFDI emitido.
export async function resumenFacturacion() {
  const facturas = await prisma.factura.findMany({
    select: { montoSinIva: true, moneda: true, estatus: true, tipo: true },
  });
  const finales = facturas.filter((f) => f.tipo === "FINAL");
  const timbradas = finales.filter((f) => f.estatus === "TIMBRADA");
  const canceladas = finales.filter((f) => f.estatus === "CANCELADA").length;
  const total = timbradas.reduce((acc, f) => acc + Number(f.montoSinIva), 0);
  return {
    facturas: facturas.length,
    proformas: facturas.length - finales.length,
    montoFacturado: total,
    pendientesTimbrado: finales.length - timbradas.length - canceladas,
    canceladas,
  };
}

// GATE 6/7 consumado: aqui, y solo aqui, nace la Cuenta por Cobrar y el
// Shipment pasa a FACTURADO. Antes de esto la factura era una captura en
// revision (BORRADOR/PENDIENTE_TIMBRADO), no un CFDI real -- generar cartera
// antes seria facturar algo que el contador todavia podia corregir.
// Punto de integracion futuro con el PAC (Facturama / Solucion Factible /
// Finkok); por ahora se simula.
export async function marcarTimbrada(id: string, cfdiUuid: string) {
  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.tipo === "PROFORMA") {
    throw new ReglaDeNegocioError("Una proforma no se timbra ante el PAC");
  }
  if (factura.estatus !== "PENDIENTE_TIMBRADO") {
    throw new ReglaDeNegocioError(
      "Antes de timbrar hay que enviar la factura a timbrado (estatus PENDIENTE_TIMBRADO)"
    );
  }

  const timbrada = await prisma.factura.update({
    where: { id },
    data: { cfdiUuid, estatus: "TIMBRADA", fechaTimbrado: new Date() },
    include: INCLUDE_FACTURA,
  });

  await prisma.shipment.update({
    where: { id: factura.shipmentId },
    data: { status: "FACTURADO" },
  });

  // Al timbrarse nace tambien su cuenta por cobrar (ver
  // modules/cuentas-por-cobrar). Cobranza es un proceso aparte del CFDI.
  await crearDesdeFactura(id);

  return timbrada;
}

// Cancelacion de CFDI (solo desde TIMBRADA; simulada, igual que el timbrado).
// No toca la CuentaPorCobrar ni el status del Shipment: el impacto contable de
// cancelar una factura ya emitida (que puede tener cobros parciales, requerir
// una nota de credito, etc.) es una decision que le toca al contador, no una
// que el sistema deba resolver solo. La UI muestra un aviso para que revise
// la cartera a mano.
export async function cancelarFactura(id: string, data: CancelarFacturaInput) {
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: { complementosPago: true },
  });
  if (!factura) {
    throw new ReglaDeNegocioError("Factura no encontrada", 404);
  }
  if (factura.estatus !== "TIMBRADA") {
    throw new ReglaDeNegocioError(
      `Solo se puede cancelar una factura TIMBRADA (esta en ${factura.estatus})`
    );
  }

  const motivo = await prisma.satMotivoCancelacion.findUnique({
    where: { clave: data.motivoCancelacion },
  });
  if (!motivo) {
    throw new ReglaDeNegocioError(
      `Motivo de cancelacion invalido: ${data.motivoCancelacion}`
    );
  }
  if (motivo.requiereFolioSustitucion && !data.folioSustitucionUuid) {
    throw new ReglaDeNegocioError(
      `El motivo "${motivo.descripcion}" exige el UUID del CFDI que sustituye a este`
    );
  }

  // No se puede dejar un REP de pagos apuntando a una factura cancelada: sus
  // complementos activos se cancelan primero, o esta factura no se cancela.
  const complementoActivo = factura.complementosPago.find((c) => c.estatus !== "CANCELADA");
  if (complementoActivo) {
    throw new ReglaDeNegocioError(
      `No se puede cancelar: el complemento de pago ${complementoActivo.folio} sigue activo. Cancelalo primero.`
    );
  }

  return prisma.factura.update({
    where: { id },
    data: {
      estatus: "CANCELADA",
      motivoCancelacion: data.motivoCancelacion,
      folioSustitucionUuid: data.folioSustitucionUuid,
      fechaCancelacion: new Date(),
    },
    include: INCLUDE_FACTURA,
  });
}

export async function listarFacturas() {
  return prisma.factura.findMany({
    include: INCLUDE_FACTURA,
    orderBy: { creadoEn: "desc" },
  });
}
