import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { SELECT_USUARIO_PUBLICO } from "@/modules/usuarios/usuario.service";
import { CrearNotificacionInput } from "./notificacion.schema";

const INCLUDE = {
  enviadoPor: { select: SELECT_USUARIO_PUBLICO },
};

// Log de notificaciones al cliente. No hay gate propio: registrar un aviso es
// siempre valido mientras el embarque exista. Reemplaza al booleano unico que
// nunca se llego a persistir (ver operaciones/operacion.service.ts).
export async function registrarNotificacion(
  shipmentId: string,
  usuarioId: string | undefined,
  data: CrearNotificacionInput
) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) {
    throw new ReglaDeNegocioError("Embarque no encontrado", 404);
  }
  return prisma.notificacionEnviada.create({
    data: {
      shipmentId,
      tipo: data.tipo,
      comentario: data.comentario ?? null,
      enviadoPorId: usuarioId ?? null,
    },
    include: INCLUDE,
  });
}

export async function listarPorShipment(shipmentId: string) {
  return prisma.notificacionEnviada.findMany({
    where: { shipmentId },
    include: INCLUDE,
    orderBy: { fechaEnviada: "desc" },
  });
}
