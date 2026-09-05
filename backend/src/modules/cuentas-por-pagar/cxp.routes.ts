import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as cxpController from "./cxp.controller";

export const cuentaPorPagarRouter = Router();

cuentaPorPagarRouter.get("/", asyncHandler(cxpController.listar));
cuentaPorPagarRouter.get("/resumen", asyncHandler(cxpController.resumen));
cuentaPorPagarRouter.post("/", asyncHandler(cxpController.crear));
cuentaPorPagarRouter.patch("/:id", asyncHandler(cxpController.actualizar));
cuentaPorPagarRouter.patch("/:id/pagar", asyncHandler(cxpController.pagar));
