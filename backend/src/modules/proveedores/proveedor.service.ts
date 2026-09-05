import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import {
  ActualizarProveedorInput,
  CrearProveedorInput,
  CrearTarifaInput,
} from "./proveedor.schema";

export async function crearProveedor(data: CrearProveedorInput) {
  return prisma.proveedor.create({
    data: { ...data, estatus: "EN_HOMOLOGACION" },
  });
}

// Un proveedor solo pasa a ACTIVO cuando ya tiene al menos una tarifa vigente.
// Esto evita que operaciones/ventas coticen con un proveedor sin tarifas cargadas.
export async function activarProveedor(id: string) {
  const tarifas = await prisma.tarifa.count({ where: { proveedorId: id } });
  if (tarifas === 0) {
    throw new ReglaDeNegocioError(
      "No se puede activar el proveedor: debe tener al menos una tarifa vigente cargada"
    );
  }
  return prisma.proveedor.update({
    where: { id },
    data: { estatus: "ACTIVO" },
  });
}

export async function actualizarProveedor(id: string, data: ActualizarProveedorInput) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor) {
    throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  return prisma.proveedor.update({ where: { id }, data: limpiarEntrada(data) });
}

export async function obtenerProveedor(id: string) {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id },
    include: { tarifas: true },
  });
  if (!proveedor) {
    throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  return proveedor;
}

export async function agregarTarifa(proveedorId: string, data: CrearTarifaInput) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) {
    throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  return prisma.tarifa.create({
    data: { ...data, proveedorId },
  });
}

export async function listarProveedores(tipo?: string, estatus?: string) {
  return prisma.proveedor.findMany({
    where: {
      tipo: tipo as never,
      estatus: estatus as never,
    },
    include: { tarifas: true },
    orderBy: { creadoEn: "desc" },
  });
}

// Usado por Bookings para bloquear la reserva si el proveedor no esta activo.
export async function verificarProveedorActivo(id: string) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id } });
  if (!proveedor || proveedor.estatus !== "ACTIVO") {
    throw new ReglaDeNegocioError(
      "No se puede confirmar booking: el proveedor debe estar activo y homologado"
    );
  }
  return proveedor;
}
