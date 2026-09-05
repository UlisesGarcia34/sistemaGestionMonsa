import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { limpiarEntrada } from "@/shared/limpiarEntrada";
import {
  ActivarClienteInput,
  ActualizarClienteInput,
  CrearClienteInput,
} from "./cliente.schema";

// Alta de un prospecto: entra sin RFC ni credito, listo para recibir
// una cotizacion estimada pero NO para operar en firme.
export async function crearProspecto(data: CrearClienteInput) {
  return prisma.cliente.create({
    data: {
      ...data,
      estatus: "PROSPECTO",
    },
  });
}

// Convierte un prospecto en cliente activo una vez que KYC y credito
// estan completos. Este es el "gate" que desbloquea la cotizacion en firme.
export async function activarCliente(id: string, data: ActivarClienteInput) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) {
    throw new ReglaDeNegocioError("Cliente no encontrado", 404);
  }
  if (cliente.estatus === "ACTIVO") {
    throw new ReglaDeNegocioError("El cliente ya esta activo");
  }

  const rfcEnUso = await prisma.cliente.findFirst({
    where: { rfc: data.rfc, id: { not: id } },
  });
  if (rfcEnUso) {
    throw new ReglaDeNegocioError(`El RFC ${data.rfc} ya esta registrado en otro cliente`);
  }

  return prisma.cliente.update({
    where: { id },
    data: {
      ...data,
      estatus: "ACTIVO",
    },
  });
}

// Edicion de los datos de un cliente ya dado de alta. No toca el estatus: ese
// solo se mueve por activarCliente, que es donde vive el gate 1.
export async function actualizarCliente(id: string, data: ActualizarClienteInput) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) {
    throw new ReglaDeNegocioError("Cliente no encontrado", 404);
  }

  const limpio = limpiarEntrada(data);

  if (limpio.rfc) {
    const rfcEnUso = await prisma.cliente.findFirst({
      where: { rfc: limpio.rfc, id: { not: id } },
    });
    if (rfcEnUso) {
      throw new ReglaDeNegocioError(`El RFC ${limpio.rfc} ya esta registrado en otro cliente`);
    }
  }

  // Un cliente ACTIVO no puede quedarse sin el RFC que justifico su
  // activacion. La regla solo se dispara al BORRAR un RFC existente: los
  // clientes migrados del Excel se activaron sin RFC capturado, y bloquear ahi
  // haria inditable cualquier otro dato suyo por un campo que ya estaba vacio.
  if (cliente.estatus === "ACTIVO" && cliente.rfc && "rfc" in limpio && !limpio.rfc) {
    throw new ReglaDeNegocioError(
      "Un cliente ACTIVO no puede quedarse sin RFC. Suspendelo antes de borrar su KYC."
    );
  }

  return prisma.cliente.update({ where: { id }, data: limpio });
}

export async function listarClientes(estatus?: string) {
  return prisma.cliente.findMany({
    where: estatus ? { estatus: estatus as never } : undefined,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerCliente(id: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { cotizaciones: true },
  });
  if (!cliente) {
    throw new ReglaDeNegocioError("Cliente no encontrado", 404);
  }
  return cliente;
}

// Usado por el modulo de Cotizaciones para bloquear una cotizacion en firme
// si el cliente no esta activo. Esta es la implementacion literal de la
// regla "cascada": ventas no puede avanzar sin un cliente valido.
export async function verificarClienteActivo(id: string) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente || cliente.estatus !== "ACTIVO") {
    throw new ReglaDeNegocioError(
      "No se puede cotizar en firme: el cliente debe estar activo (KYC y credito aprobados)"
    );
  }
  return cliente;
}
