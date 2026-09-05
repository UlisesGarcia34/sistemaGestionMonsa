import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as clienteController from "./cliente.controller";

export const clienteRouter = Router();

clienteRouter.get("/", asyncHandler(clienteController.listar));
clienteRouter.get("/:id", asyncHandler(clienteController.obtener));
clienteRouter.post("/", asyncHandler(clienteController.crear));
clienteRouter.patch("/:id", asyncHandler(clienteController.actualizar));
clienteRouter.patch("/:id/activar", asyncHandler(clienteController.activar));
