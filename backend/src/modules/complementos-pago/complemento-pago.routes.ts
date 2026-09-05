import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as complementoPagoController from "./complemento-pago.controller";

export const complementoPagoRouter = Router();

complementoPagoRouter.get("/", asyncHandler(complementoPagoController.listar));
complementoPagoRouter.get("/:id", asyncHandler(complementoPagoController.obtener));
complementoPagoRouter.patch(
  "/:id/enviar-timbrado",
  asyncHandler(complementoPagoController.enviarATimbrado)
);
complementoPagoRouter.patch("/:id/timbrar", asyncHandler(complementoPagoController.timbrar));
complementoPagoRouter.patch("/:id/cancelar", asyncHandler(complementoPagoController.cancelar));
