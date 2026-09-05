import bcrypt from "bcryptjs";
import { prisma } from "@/config/prisma";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";
import { firmarToken } from "@/shared/middleware/auth";
import { SELECT_USUARIO_PUBLICO } from "@/modules/usuarios/usuario.service";
import { CambiarPasswordInput, LoginInput } from "./auth.schema";

const ROUNDS = 10;

export function hashPassword(plano: string) {
  return bcrypt.hash(plano, ROUNDS);
}

// Mensaje deliberadamente identico para "no existe", "sin contrasena",
// "inactivo" y "contrasena incorrecta": no se le dice a un atacante cual de
// los cuatro caso es. El status 401 lo distingue de un error de negocio.
const CREDENCIALES_INVALIDAS = "Correo o contrasena incorrectos";

export async function login(data: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { email: data.email.toLowerCase().trim() },
  });

  if (!usuario || !usuario.passwordHash || !usuario.activo) {
    throw new ReglaDeNegocioError(CREDENCIALES_INVALIDAS, 401);
  }

  const coincide = await bcrypt.compare(data.password, usuario.passwordHash);
  if (!coincide) {
    throw new ReglaDeNegocioError(CREDENCIALES_INVALIDAS, 401);
  }

  const token = firmarToken({
    sub: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
  });

  // passwordHash nunca sale del service: se devuelve la proyeccion publica.
  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo,
    },
  };
}

// Devuelve el usuario de la sesion actual a partir del id del token. El
// frontend lo usa al recargar la pagina para validar que el token sigue vivo.
export async function usuarioActual(id: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: SELECT_USUARIO_PUBLICO,
  });
  if (!usuario || !usuario.activo) {
    throw new ReglaDeNegocioError("Sesion invalida", 401);
  }
  return usuario;
}

export async function cambiarPassword(id: string, data: CambiarPasswordInput) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.passwordHash) {
    throw new ReglaDeNegocioError("Usuario no encontrado", 404);
  }
  const coincide = await bcrypt.compare(data.passwordActual, usuario.passwordHash);
  if (!coincide) {
    throw new ReglaDeNegocioError("La contrasena actual no es correcta", 401);
  }
  await prisma.usuario.update({
    where: { id },
    data: { passwordHash: await hashPassword(data.passwordNueva) },
  });
  return { ok: true };
}
