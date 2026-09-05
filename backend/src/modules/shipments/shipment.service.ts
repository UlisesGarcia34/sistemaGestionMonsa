import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { SELECT_USUARIO_PUBLICO } from "@/modules/usuarios/usuario.service";
import {
  ActualizarDocumentoInput,
  ActualizarShipmentInput,
  ActualizarTrackingInput,
  ConfirmarValorizacionInput,
  CrearShipmentInput,
} from "./shipment.schema";

// Estados en los que el embarque sigue siendo un expediente vivo. Fuera de
// ellos (FACTURADO / TERMINADO / CANCELADO) el registro ya alimenta finanzas y
// no debe cambiar bajo los pies de una factura ya emitida.
const EDITABLES = ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR", "PARA_FACTURAR"];

// Relaciones que acompanan a un embarque en cualquier lectura. El customer
// service se lee con la proyeccion publica: Usuario tiene passwordHash y un
// include plano lo filtraria en la respuesta de la API.
const INCLUDE_SHIPMENT = {
  consignee: true,
  customerService: { select: SELECT_USUARIO_PUBLICO },
  documento: true,
  contenedores: true,
  booking: { include: { proveedor: true, cotizacion: true } },
  notificaciones: {
    include: { enviadoPor: { select: SELECT_USUARIO_PUBLICO } },
    orderBy: { fechaEnviada: "desc" } as const,
  },
};

// Mismo formato que el Excel: MGC26000001, MGC26000002... El consecutivo se
// deriva del folio maximo existente (no de count()) para tolerar huecos en la
// numeracion -- los folios reales cargados por el seed son 1,2,6,7,9.
async function siguienteFolioShipment() {
  const anio = new Date().getFullYear().toString().slice(-2);
  const prefijo = `MGC${anio}`;
  const ultimo = await prisma.shipment.findFirst({
    where: { folio: { startsWith: prefijo } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  const consecutivo = ultimo ? Number(ultimo.folio.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(6, "0")}`;
}

// GATE 5 de la cascada, el mas importante: el folio de shipment SOLO se genera
// cuando el booking ya esta CONFIRMADO. Esto es justo lo que el Excel actual
// no hacia -- reservaba el folio de golpe, mezclando reservas con embarques
// reales en la misma fila. Aqui el folio nace en el momento correcto.
export async function crearShipment(data: CrearShipmentInput) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { shipment: true },
  });
  if (!booking) {
    throw new ReglaDeNegocioError("Booking no encontrado", 404);
  }
  if (booking.status !== "CONFIRMADO") {
    throw new ReglaDeNegocioError(
      "No se puede crear el embarque: el booking debe estar CONFIRMADO"
    );
  }
  if (booking.shipment) {
    throw new ReglaDeNegocioError("Este booking ya tiene un embarque asociado");
  }

  const folio = await siguienteFolioShipment();

  return prisma.shipment.create({
    data: {
      folio,
      bookingId: data.bookingId,
      tipoOperacion: data.tipoOperacion,
      modalidad: data.modalidad,
      consigneeId: data.consigneeId,
      shipperNombre: data.shipperNombre,
      customerServiceId: data.customerServiceId ?? undefined,
      status: "NUEVO_EMBARQUE",
    },
  });
}

// Edicion operativa completa. Un embarque ya FACTURADO / TERMINADO no se
// edita: sus montos y fechas ya sostienen una factura y una cuenta por cobrar.
export async function actualizarShipment(id: string, data: ActualizarShipmentInput) {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  if (!EDITABLES.includes(shipment.status)) {
    throw new ReglaDeNegocioError(
      `No se puede editar un embarque en status ${shipment.status}. Solo se editan embarques abiertos.`
    );
  }

  const limpio = limpiarEntrada(data);
  if (limpio.consigneeId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: limpio.consigneeId } });
    if (!cliente) {
      throw new ReglaDeNegocioError("Consignee no encontrado", 404);
    }
  }

  return prisma.shipment.update({
    where: { id },
    data: limpio as never,
    include: INCLUDE_SHIPMENT,
  });
}

export async function actualizarTracking(id: string, data: ActualizarTrackingInput) {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  return prisma.shipment.update({
    where: { id },
    data: limpiarEntrada(data) as never,
  });
}

// Documentacion del embarque. Se crea la fila Documento la primera vez que se
// captura algo (relacion 1:1 opcional), asi que el mismo endpoint sirve para
// alta y edicion. Es el prerequisito de los reportes de HBL / MBL.
export async function actualizarDocumento(shipmentId: string, data: ActualizarDocumentoInput) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  const limpio = limpiarEntrada(data);
  return prisma.documento.upsert({
    where: { shipmentId },
    update: limpio,
    create: { shipmentId, ...limpio },
  });
}

// Valorizacion (paso previo al gate 6): Ventas confirma el costo y la venta
// reales del embarque. Se guardan aparte del estimado de la Cotizacion para
// poder comparar ambos al cerrar la carpeta.
export async function confirmarValorizacion(id: string, data: ConfirmarValorizacionInput) {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  if (!EDITABLES.includes(shipment.status)) {
    throw new ReglaDeNegocioError(
      `No se puede valorizar un embarque en status ${shipment.status}.`
    );
  }
  return prisma.shipment.update({
    where: { id },
    data: {
      valorizacionVenta: data.valorizacionVenta,
      valorizacionCompra: data.valorizacionCompra,
      valorizacionConfirmada: true,
      valorizacionConfirmadaEn: new Date(),
    },
    include: INCLUDE_SHIPMENT,
  });
}

// Divergencia entre el margen valorizado (real, confirmado por Ventas) y el
// margen estimado de la Cotizacion. NO es un gate: el cierre no se bloquea, la
// UI solo muestra una advertencia cuando el delta es grande (Anexo: "no
// necesariamente un bloqueo duro").
export function calcularDivergencia(s: {
  valorizacionConfirmada: boolean;
  valorizacionVenta: unknown;
  valorizacionCompra: unknown;
  booking: { cotizacion: { montoVenta: unknown; montoCompra: unknown; moneda: string } };
}) {
  const estimado =
    Number(s.booking.cotizacion.montoVenta) - Number(s.booking.cotizacion.montoCompra);
  if (!s.valorizacionConfirmada || s.valorizacionVenta == null || s.valorizacionCompra == null) {
    return { estimado, valorizado: null, delta: null, alerta: false, moneda: s.booking.cotizacion.moneda };
  }
  const valorizado = Number(s.valorizacionVenta) - Number(s.valorizacionCompra);
  const delta = valorizado - estimado;
  const alerta = Math.abs(delta) > Math.max(0.1 * Math.abs(estimado), 50);
  return { estimado, valorizado, delta, alerta, moneda: s.booking.cotizacion.moneda };
}

// GATE 7 (cierre): pasa el shipment a PARA_FACTURAR. Solo despues de esto una
// factura FINAL puede generarse (ver modulo facturacion). Devuelve tambien la
// divergencia de margen para que la UI advierta si los costos reales se
// alejaron de lo cotizado/valorizado.
export async function cerrarShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { booking: { include: { cotizacion: true } } },
  });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  const actualizado = await prisma.shipment.update({
    where: { id },
    data: { status: "PARA_FACTURAR" },
    include: INCLUDE_SHIPMENT,
  });
  return { shipment: actualizado, divergenciaMargen: calcularDivergencia(shipment) };
}

export async function listarShipments(status?: string) {
  return prisma.shipment.findMany({
    where: status ? { status: status as never } : undefined,
    include: INCLUDE_SHIPMENT,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      ...INCLUDE_SHIPMENT,
      costosDemoras: true,
      facturas: true,
    },
  });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  return shipment;
}
