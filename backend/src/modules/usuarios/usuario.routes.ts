import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as usuarioService from "./usuario.service";

// Modulo de solo lectura: alimenta los selects de vendedor / customer service
// en el frontend. El alta de usuarios y la matriz de permisos por rol siguen
// fuera del alcance del MVP; lo que si existe ya es la autenticacion real
// (modules/auth), que es quien emite el JWT con el rol.
export const usuarioRouter = Router();

usuarioRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await usuarioService.listarUsuarios(req.query.rol as string | undefined));
  })
);
