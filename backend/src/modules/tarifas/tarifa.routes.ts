import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as tarifaController from "./tarifa.controller";

export const tarifaRouter = Router();

tarifaRouter.get("/", asyncHandler(tarifaController.listar));
tarifaRouter.post("/", asyncHandler(tarifaController.crear));
tarifaRouter.patch("/:id", asyncHandler(tarifaController.actualizar));
tarifaRouter.delete("/:id", asyncHandler(tarifaController.eliminar));
