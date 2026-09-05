import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { CancelarComplementoInput } from "./complemento-pago.schema";

const INCLUDE = {
  factura: { include: { shipment: { include: { consignee: true } } } },
};

export async function listarComplementosPago(facturaId?: string) {
  return prisma.complementoPago.findMany({
    where: { facturaId },
    include: INCLUDE,
    orderBy: { fechaPago: "desc" },
  });
}

export async function obtenerComplementoPago(id: string) {
  const complemento = await prisma.complementoPago.findUnique({ where: { id }, include: INCLUDE });
  if (!complemento) {
    throw new ReglaDeNegocioError("Complemento de pago no encontrado", 404);
  }
  return complemento;
}

// Mismo ciclo que Factura: BORRADOR -> PENDIENTE_TIMBRADO -> TIMBRADA.
export async function enviarATimbrado(id: string) {
  const complemento = await prisma.complementoPago.findUnique({ where: { id } });
  if (!complemento) {
    throw new ReglaDeNegocioError("Complemento de pago no encontrado", 404);
  }
  if (complemento.estatus !== "BORRADOR") {
    throw new ReglaDeNegocioError(`El complemento ya esta en estatus ${complemento.estatus}`);
  }
  return prisma.complementoPago.update({
    where: { id },
    data: { estatus: "PENDIENTE_TIMBRADO" },
    include: INCLUDE,
  });
}

// Punto de integracion futuro con el PAC; por ahora se simula, igual que
// factura.service.marcarTimbrada.
export async function marcarTimbrado(id: string, cfdiUuid: string) {
  const complemento = await prisma.complementoPago.findUnique({ where: { id } });
  if (!complemento) {
    throw new ReglaDeNegocioError("Complemento de pago no encontrado", 404);
  }
  if (complemento.estatus !== "PENDIENTE_TIMBRADO") {
    throw new ReglaDeNegocioError(
      "Antes de timbrar hay que enviarlo a timbrado (estatus PENDIENTE_TIMBRADO)"
    );
  }
  return prisma.complementoPago.update({
    where: { id },
    data: { cfdiUuid, estatus: "TIMBRADA", fechaTimbrado: new Date() },
    include: INCLUDE,
  });
}

// Cancelacion (solo desde TIMBRADA; simulada). No revierte el cobro registrado
// en la CuentaPorCobrar: eso es una decision contable, no automatica.
export async function cancelarComplemento(id: string, data: CancelarComplementoInput) {
  const complemento = await prisma.complementoPago.findUnique({ where: { id } });
  if (!complemento) {
    throw new ReglaDeNegocioError("Complemento de pago no encontrado", 404);
  }
  if (complemento.estatus !== "TIMBRADA") {
    throw new ReglaDeNegocioError(
      `Solo se puede cancelar un complemento TIMBRADA (esta en ${complemento.estatus})`
    );
  }

  const motivo = await prisma.satMotivoCancelacion.findUnique({
    where: { clave: data.motivoCancelacion },
  });
  if (!motivo) {
    throw new ReglaDeNegocioError(`Motivo de cancelacion invalido: ${data.motivoCancelacion}`);
  }
  if (motivo.requiereFolioSustitucion && !data.folioSustitucionUuid) {
    throw new ReglaDeNegocioError(
      `El motivo "${motivo.descripcion}" exige el UUID del CFDI que sustituye a este`
    );
  }

  return prisma.complementoPago.update({
    where: { id },
    data: {
      estatus: "CANCELADA",
      motivoCancelacion: data.motivoCancelacion,
      folioSustitucionUuid: data.folioSustitucionUuid,
      fechaCancelacion: new Date(),
    },
    include: INCLUDE,
  });
}
