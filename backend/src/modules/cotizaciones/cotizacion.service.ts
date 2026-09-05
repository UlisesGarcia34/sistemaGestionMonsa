import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { verificarClienteActivo } from "@/modules/clientes/cliente.service";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { SELECT_USUARIO_PUBLICO } from "@/modules/usuarios/usuario.service";
import { ActualizarCotizacionInput, CrearCotizacionInput } from "./cotizacion.schema";

// El consecutivo se deriva del folio maximo existente para el anio, no de un
// count() -- asi tolera huecos en la numeracion (ej. los folios reales del
// Excel cargados por el seed no son 1,2,3... sino 1,2,6,7,9).
async function siguienteFolioCotizacion() {
  const anio = new Date().getFullYear().toString().slice(-2);
  const prefijo = `COT${anio}`;
  const ultima = await prisma.cotizacion.findFirst({
    where: { folio: { startsWith: prefijo } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  const consecutivo = ultima ? Number(ultima.folio.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(6, "0")}`;
}

// GATE 1 de la cascada: una cotizacion "en firme" (esEstimado = false) no puede
// crearse si el cliente no esta activo. Una cotizacion "estimada" para un
// prospecto si se permite, pero queda marcada como BORRADOR y no puede
// convertirse en booking hasta que el cliente pase a ACTIVO.
export async function crearCotizacion(data: CrearCotizacionInput) {
  if (!data.esEstimado) {
    await verificarClienteActivo(data.clienteId);
  }

  const folio = await siguienteFolioCotizacion();
  return prisma.cotizacion.create({
    data: {
      folio,
      clienteId: data.clienteId,
      vendedorId: data.vendedorId,
      incoterm: data.incoterm,
      modalidad: data.modalidad,
      origen: data.origen,
      destino: data.destino,
      montoVenta: data.montoVenta,
      montoCompra: data.montoCompra,
      moneda: data.moneda,
      validaHasta: data.validaHasta,
      status: "BORRADOR",
    },
  });
}

export async function marcarAceptada(id: string) {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion) {
    throw new ReglaDeNegocioError("Cotizacion no encontrada", 404);
  }

  // Al aceptar, se vuelve a verificar el cliente por si la cotizacion
  // original era un estimado de prospecto que aun no completaba KYC.
  await verificarClienteActivo(cotizacion.clienteId);

  return prisma.cotizacion.update({
    where: { id },
    data: { status: "ACEPTADA" },
  });
}

// Una cotizacion solo se edita mientras sigue siendo una propuesta. Una vez
// ACEPTADA es la base contractual del booking y del margen del embarque:
// cambiarle los montos ahi desincronizaria la rentabilidad del dashboard
// respecto a lo que el cliente autorizo -- exactamente el problema del Excel.
export async function actualizarCotizacion(id: string, data: ActualizarCotizacionInput) {
  const cotizacion = await prisma.cotizacion.findUnique({ where: { id } });
  if (!cotizacion) {
    throw new ReglaDeNegocioError("Cotizacion no encontrada", 404);
  }
  if (cotizacion.status !== "BORRADOR" && cotizacion.status !== "ENVIADA") {
    throw new ReglaDeNegocioError(
      `No se puede editar una cotizacion en status ${cotizacion.status}. Solo BORRADOR o ENVIADA son editables.`
    );
  }

  const limpio = limpiarEntrada(data);
  const venta = limpio.montoVenta ?? Number(cotizacion.montoVenta);
  const compra = limpio.montoCompra ?? Number(cotizacion.montoCompra);
  if (compra > venta) {
    // No se bloquea: un margen negativo es un caso real (el Excel tenia uno).
    // Solo se deja constancia de que se capturo a proposito.
    console.warn(
      `Cotizacion ${cotizacion.folio}: se guarda con margen negativo (${venta - compra}).`
    );
  }

  return prisma.cotizacion.update({ where: { id }, data: limpio });
}

export async function obtenerCotizacion(id: string) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: { select: SELECT_USUARIO_PUBLICO },
      booking: true,
      routingOrder: { include: { agente: true } },
    },
  });
  if (!cotizacion) {
    throw new ReglaDeNegocioError("Cotizacion no encontrada", 404);
  }
  return cotizacion;
}

export async function listarCotizaciones(status?: string) {
  return prisma.cotizacion.findMany({
    where: status ? { status: status as never } : undefined,
    // El vendedor se lee con la proyeccion publica: Usuario ya tiene
    // passwordHash y un include plano lo filtraria en la respuesta.
    // El routingOrder viaja completo (relacion 1:1, barato) para que Bookings
    // sepa si el gate 3 esta cubierto y Cotizaciones muestre su detalle sin
    // pedir cada uno por separado.
    include: {
      cliente: true,
      vendedor: { select: SELECT_USUARIO_PUBLICO },
      routingOrder: { include: { agente: { select: { id: true, nombre: true } } } },
    },
    orderBy: { creadoEn: "desc" },
  });
}
