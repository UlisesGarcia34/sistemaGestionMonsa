import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import {
  ActualizarRoutingOrderInput,
  CrearRoutingOrderInput,
} from "./routing-order.schema";

const INCLUDE = {
  cotizacion: { include: { cliente: true } },
  agente: true,
};

// GATE 2 de la cascada aplicado al Routing Order: solo se piden instrucciones
// para una cotizacion ya ACEPTADA por el cliente. Antes de eso no hay embarque
// que instruir.
export async function crearRoutingOrder(data: CrearRoutingOrderInput) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: data.cotizacionId },
    include: { routingOrder: true },
  });
  if (!cotizacion) {
    throw new ReglaDeNegocioError("Cotizacion no encontrada", 404);
  }
  if (cotizacion.status !== "ACEPTADA") {
    throw new ReglaDeNegocioError(
      "No se puede solicitar el Routing Order: la cotizacion debe estar ACEPTADA"
    );
  }
  if (cotizacion.routingOrder) {
    throw new ReglaDeNegocioError("Esta cotizacion ya tiene un Routing Order");
  }
  if (data.agenteId) {
    await verificarAgente(data.agenteId);
  }

  return prisma.routingOrder.create({
    data: {
      cotizacionId: data.cotizacionId,
      shipperNombre: data.shipperNombre,
      shipperDireccion: data.shipperDireccion,
      pol: data.pol,
      pod: data.pod,
      destinoFinal: data.destinoFinal,
      tipoServicioEntrega: data.tipoServicioEntrega,
      especificaciones: data.especificaciones,
      agenteId: data.agenteId ?? null,
      status: "SOLICITADO",
    },
    include: INCLUDE,
  });
}

// Solo se edita mientras sigue SOLICITADO: una vez RECIBIDO habilita el gate 3
// (crear el booking) y cambiarle el agente o la ruta debajo del booking dejaria
// las instrucciones desalineadas con la reserva.
export async function actualizarRoutingOrder(
  id: string,
  data: ActualizarRoutingOrderInput
) {
  const ro = await prisma.routingOrder.findUnique({ where: { id } });
  if (!ro) {
    throw new ReglaDeNegocioError("Routing Order no encontrado", 404);
  }
  if (ro.status !== "SOLICITADO") {
    throw new ReglaDeNegocioError(
      "No se puede editar un Routing Order ya RECIBIDO"
    );
  }

  const limpio = limpiarEntrada(data);
  if (limpio.agenteId) {
    await verificarAgente(limpio.agenteId as string);
  }

  return prisma.routingOrder.update({
    where: { id },
    data: limpio as never,
    include: INCLUDE,
  });
}

// El cliente entrego las instrucciones. Esto es lo que abre el gate 3.
export async function marcarRecibido(id: string) {
  const ro = await prisma.routingOrder.findUnique({ where: { id } });
  if (!ro) {
    throw new ReglaDeNegocioError("Routing Order no encontrado", 404);
  }
  if (ro.status === "RECIBIDO") {
    throw new ReglaDeNegocioError("El Routing Order ya estaba marcado como RECIBIDO");
  }
  return prisma.routingOrder.update({
    where: { id },
    data: { status: "RECIBIDO", fechaRecibido: new Date() },
    include: INCLUDE,
  });
}

export async function obtenerRoutingOrder(id: string) {
  const ro = await prisma.routingOrder.findUnique({ where: { id }, include: INCLUDE });
  if (!ro) {
    throw new ReglaDeNegocioError("Routing Order no encontrado", 404);
  }
  return ro;
}

export async function listarRoutingOrders(filtros: { cotizacionId?: string; status?: string } = {}) {
  return prisma.routingOrder.findMany({
    where: {
      cotizacionId: filtros.cotizacionId,
      status: filtros.status ? (filtros.status as never) : undefined,
    },
    include: INCLUDE,
    orderBy: { creadoEn: "desc" },
  });
}

async function verificarAgente(id: string) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) {
    throw new ReglaDeNegocioError("El agente indicado no existe", 404);
  }
  return proveedor;
}
