import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as cxcController from "./cxc.controller";

export const cuentaPorCobrarRouter = Router();

cuentaPorCobrarRouter.get("/", asyncHandler(cxcController.listar));
cuentaPorCobrarRouter.get("/resumen", asyncHandler(cxcController.resumen));
cuentaPorCobrarRouter.patch("/:id", asyncHandler(cxcController.actualizar));
cuentaPorCobrarRouter.patch("/:id/cobrar", asyncHandler(cxcController.cobrar));
