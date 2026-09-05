import { Request, Response } from "express";
import { cambiarPasswordSchema, loginSchema } from "./auth.schema";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  res.json(await authService.login(data));
}

export async function yo(req: Request, res: Response) {
  res.json(await authService.usuarioActual(req.usuario!.sub));
}

export async function cambiarPassword(req: Request, res: Response) {
  const data = cambiarPasswordSchema.parse(req.body);
  res.json(await authService.cambiarPassword(req.usuario!.sub, data));
}
