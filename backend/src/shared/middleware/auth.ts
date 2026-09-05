import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { RolUsuario } from "@prisma/client";

// Payload que viaja dentro del JWT. Incluye el rol para poder autorizar por
// rol sin volver a consultar la base en cada request (CLAUDE.md seccion 11).
export interface TokenPayload {
  sub: string; // id del usuario
  email: string;
  nombre: string;
  rol: RolUsuario;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

// El secreto NO tiene default de produccion a proposito: si falta la variable
// se arranca en modo desarrollo con un secreto obvio y un aviso en consola,
// para que nadie lo confunda con una configuracion valida de produccion.
export function jwtSecret(): string {
  const secreto = process.env.JWT_SECRET;
  if (secreto && secreto.length >= 16) return secreto;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET no configurado (minimo 16 caracteres) en produccion");
  }
  return "monsa-desarrollo-secreto-no-usar-en-produccion";
}

export function jwtExpiracion(): string {
  return process.env.JWT_EXPIRES_IN ?? "8h";
}

export function firmarToken(payload: TokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: jwtExpiracion() } as jwt.SignOptions);
}

// Rutas que se resuelven sin sesion. Todo lo demas bajo /api requiere token.
// Se comparan contra originalUrl porque el middleware va montado en "/api":
// dentro del handler, req.path ya viene sin ese prefijo.
const RUTAS_PUBLICAS = ["/api/auth/login"];

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const ruta = req.originalUrl.split("?")[0].replace(/\/+$/, "") || "/";
  if (RUTAS_PUBLICAS.includes(ruta)) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sesion requerida. Inicia sesion para continuar." });
  }

  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as TokenPayload;
    req.usuario = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Sesion invalida o expirada. Vuelve a iniciar sesion." });
  }
}

// Autorizacion por rol. Todavia no se aplica a ninguna ruta (el MVP no define
// la matriz de permisos), pero el rol ya viaja en el token para poder hacerlo
// sin cambiar el contrato de autenticacion.
export function requireRol(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Sesion requerida" });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "Tu rol no tiene permiso para esta operacion" });
    }
    return next();
  };
}
