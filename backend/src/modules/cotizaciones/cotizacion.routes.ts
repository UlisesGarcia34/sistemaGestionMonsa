import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as cotizacionController from "./cotizacion.controller";

export const cotizacionRouter = Router();

cotizacionRouter.get("/", asyncHandler(cotizacionController.listar));
cotizacionRouter.get("/:id", asyncHandler(cotizacionController.obtener));
cotizacionRouter.post("/", asyncHandler(cotizacionController.crear));
cotizacionRouter.patch("/:id", asyncHandler(cotizacionController.actualizar));
cotizacionRouter.patch("/:id/aceptar", asyncHandler(cotizacionController.aceptar));
