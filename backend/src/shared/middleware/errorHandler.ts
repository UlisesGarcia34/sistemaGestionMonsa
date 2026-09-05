import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Error de negocio explicito (ej. "no se puede confirmar booking sin cliente activo").
// Los servicios lanzan esto para que el cliente reciba un mensaje claro, no un 500 generico.
export class ReglaDeNegocioError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "ReglaDeNegocioError";
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos invalidos",
      detalles: err.flatten(),
    });
  }

  if (err instanceof ReglaDeNegocioError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
}

// Envuelve controladores async para que sus errores lleguen al errorHandler
// sin necesidad de try/catch repetido en cada endpoint.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
