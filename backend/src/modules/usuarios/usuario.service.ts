import { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma";

// Proyeccion publica de Usuario. Es la UNICA forma en que un usuario sale de
// la API: al ser un select explicito, agregar campos sensibles al modelo
// (passwordHash y los que vengan despues) no los filtra por accidente.
export const SELECT_USUARIO_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  creadoEn: true,
} satisfies Prisma.UsuarioSelect;

export async function listarUsuarios(rol?: string) {
  return prisma.usuario.findMany({
    where: rol ? { rol: rol as never } : undefined,
    select: SELECT_USUARIO_PUBLICO,
    orderBy: { nombre: "asc" },
  });
}
