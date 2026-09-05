import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { verificarProveedorActivo } from "@/modules/proveedores/proveedor.service";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { ActualizarBookingInput, CrearBookingInput } from "./booking.schema";

// Gates 2, 3 y 4 de la cascada. Para crear un booking se necesita:
//  - gate 2: la cotizacion ACEPTADA por el cliente,
//  - gate 3 (NUEVO): un Routing Order del cliente en estado RECIBIDO, salvo que
//    el cliente tenga requiereRoutingOrder = false,
//  - gate 4: el proveedor homologado y ACTIVO.
export async function crearBooking(data: CrearBookingInput) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: data.cotizacionId },
    include: { cliente: true, routingOrder: true },
  });
  if (!cotizacion) {
    throw new ReglaDeNegocioError("Cotizacion no encontrada", 404);
  }
  if (cotizacion.status !== "ACEPTADA") {
    throw new ReglaDeNegocioError(
      "No se puede crear el booking: la cotizacion debe estar ACEPTADA"
    );
  }

  // Gate 3: Routing Order recibido. requiereRoutingOrder = false lo relaja para
  // clientes con embarques simples que no entregan instrucciones formales.
  if (cotizacion.cliente.requiereRoutingOrder) {
    if (!cotizacion.routingOrder || cotizacion.routingOrder.status !== "RECIBIDO") {
      throw new ReglaDeNegocioError(
        "No se puede crear el booking: falta el Routing Order del cliente en estado RECIBIDO"
      );
    }
  }

  await verificarProveedorActivo(data.proveedorId);

  return prisma.booking.create({
    data: {
      cotizacionId: data.cotizacionId,
      proveedorId: data.proveedorId,
      referencia: data.referencia,
      status: "SOLICITADO",
    },
  });
}

export async function confirmarBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw new ReglaDeNegocioError("Booking no encontrado", 404);
  }

  return prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMADO", confirmadoEn: new Date() },
  });
}

// Un booking se edita mientras sigue SOLICITADO. Una vez CONFIRMADO ya es la
// reserva en firme con el carrier (y lo que habilita el folio de embarque):
// cambiarle el proveedor ahi dejaria el embarque colgando de una naviera que
// nunca reservo el espacio. La referencia (SO) si se sigue pudiendo corregir,
// porque el carrier suele mandarla despues de confirmar.
export async function actualizarBooking(id: string, data: ActualizarBookingInput) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw new ReglaDeNegocioError("Booking no encontrado", 404);
  }
  if (booking.status === "CANCELADO") {
    throw new ReglaDeNegocioError("No se puede editar un booking CANCELADO");
  }

  const limpio = limpiarEntrada(data);
  if (limpio.proveedorId && limpio.proveedorId !== booking.proveedorId) {
    if (booking.status !== "SOLICITADO") {
      throw new ReglaDeNegocioError(
        "No se puede cambiar el proveedor de un booking ya CONFIRMADO. Cancelalo y crea uno nuevo."
      );
    }
    await verificarProveedorActivo(limpio.proveedorId);
  }

  return prisma.booking.update({ where: { id }, data: limpio });
}

export async function obtenerBooking(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      cotizacion: { include: { cliente: true } },
      proveedor: true,
      shipment: true,
    },
  });
  if (!booking) {
    throw new ReglaDeNegocioError("Booking no encontrado", 404);
  }
  return booking;
}

export async function listarBookings(status?: string) {
  return prisma.booking.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      cotizacion: { include: { cliente: true } },
      proveedor: true,
      shipment: { select: { id: true, folio: true } },
    },
    orderBy: { creadoEn: "desc" },
  });
}
