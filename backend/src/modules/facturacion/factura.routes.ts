import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as facturaController from "./factura.controller";

export const facturaRouter = Router();

// /resumen va antes que /:id para que Express no lo capture como un id.
facturaRouter.get("/", asyncHandler(facturaController.listar));
facturaRouter.get("/resumen", asyncHandler(facturaController.resumen));
facturaRouter.get("/:id", asyncHandler(facturaController.obtener));
facturaRouter.post("/", asyncHandler(facturaController.crear));
facturaRouter.patch("/:id", asyncHandler(facturaController.actualizar));
facturaRouter.put("/:id/conceptos", asyncHandler(facturaController.actualizarConceptos));
facturaRouter.patch("/:id/enviar-timbrado", asyncHandler(facturaController.enviarATimbrado));
facturaRouter.patch("/:id/timbrar", asyncHandler(facturaController.timbrar));
facturaRouter.patch("/:id/cancelar", asyncHandler(facturaController.cancelar));
