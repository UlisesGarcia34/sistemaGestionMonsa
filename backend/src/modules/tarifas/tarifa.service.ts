import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import { ActualizarTarifaInput, CrearTarifaInput } from "./tarifa.schema";

// Modulo Pricing: catalogo transversal de las tarifas de compra (buy rates).
// El modelo Tarifa ya existia (lo consume el gate 4, activarProveedor); lo que
// faltaba era un lugar para verlas y mantenerlas todas juntas, no proveedor
// por proveedor.

interface FiltrosTarifa {
  proveedorId?: string;
  modalidad?: string;
  tipo?: string;
  soloVigentes?: boolean;
}

// "Vigente" = hoy cae dentro de [vigenteDesde, vigenteHasta]. Sin vigenteHasta
// la tarifa es abierta. Se deriva al leer, nunca se persiste (mismo criterio
// que "VENCIDA" en cuentas por cobrar).
export function estaVigente(t: { vigenteDesde: Date; vigenteHasta: Date | null }, ref = new Date()) {
  if (t.vigenteDesde > ref) return false;
  if (t.vigenteHasta && t.vigenteHasta < ref) return false;
  return true;
}

export async function listarTarifas(filtros: FiltrosTarifa = {}) {
  const tarifas = await prisma.tarifa.findMany({
    where: {
      proveedorId: filtros.proveedorId,
      modalidad: filtros.modalidad as never,
      tipo: filtros.tipo as never,
    },
    include: { proveedor: { select: { id: true, nombre: true, tipo: true, estatus: true } } },
    orderBy: [{ vigenteDesde: "desc" }],
  });

  const conVigencia = tarifas.map((t) => ({
    ...t,
    vigente: estaVigente(t),
  }));

  return filtros.soloVigentes ? conVigencia.filter((t) => t.vigente) : conVigencia;
}

export async function crearTarifa(data: CrearTarifaInput) {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: data.proveedorId } });
  if (!proveedor) {
    throw new ReglaDeNegocioError("Proveedor no encontrado", 404);
  }
  if (data.vigenteHasta && data.vigenteHasta < data.vigenteDesde) {
    throw new ReglaDeNegocioError("La vigencia no puede terminar antes de empezar");
  }
  return prisma.tarifa.create({
    data: {
      proveedorId: data.proveedorId,
      origen: data.origen,
      destino: data.destino,
      modalidad: data.modalidad,
      tipo: data.tipo,
      montoCompra: data.montoCompra,
      moneda: data.moneda,
      vigenteDesde: data.vigenteDesde,
      vigenteHasta: data.vigenteHasta ?? null,
    },
    include: { proveedor: { select: { id: true, nombre: true, tipo: true, estatus: true } } },
  });
}

export async function actualizarTarifa(id: string, data: ActualizarTarifaInput) {
  const tarifa = await prisma.tarifa.findUnique({ where: { id } });
  if (!tarifa) {
    throw new ReglaDeNegocioError("Tarifa no encontrada", 404);
  }
  const limpio = limpiarEntrada(data);
  const desde = (limpio.vigenteDesde as Date | undefined) ?? tarifa.vigenteDesde;
  const hasta = (limpio.vigenteHasta as Date | null | undefined) ?? tarifa.vigenteHasta;
  if (hasta && hasta < desde) {
    throw new ReglaDeNegocioError("La vigencia no puede terminar antes de empezar");
  }
  return prisma.tarifa.update({
    where: { id },
    data: limpio as never,
    include: { proveedor: { select: { id: true, nombre: true, tipo: true, estatus: true } } },
  });
}

// Cascada aplicada a la escritura: un proveedor ACTIVO no puede quedarse sin
// ninguna tarifa vigente, que es justo lo que exige el gate 4 para activarlo.
export async function eliminarTarifa(id: string) {
  const tarifa = await prisma.tarifa.findUnique({
    where: { id },
    include: { proveedor: { select: { estatus: true } } },
  });
  if (!tarifa) {
    throw new ReglaDeNegocioError("Tarifa no encontrada", 404);
  }
  if (tarifa.proveedor.estatus === "ACTIVO") {
    const restantes = await prisma.tarifa.count({
      where: { proveedorId: tarifa.proveedorId, id: { not: id } },
    });
    if (restantes === 0) {
      throw new ReglaDeNegocioError(
        "No se puede eliminar: es la ultima tarifa de un proveedor ACTIVO. Carga otra antes de borrarla."
      );
    }
  }
  await prisma.tarifa.delete({ where: { id } });
  return { ok: true };
}
