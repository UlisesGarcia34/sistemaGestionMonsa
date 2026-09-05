import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as proveedorController from "./proveedor.controller";

export const proveedorRouter = Router();

proveedorRouter.get("/", asyncHandler(proveedorController.listar));
proveedorRouter.get("/:id", asyncHandler(proveedorController.obtener));
proveedorRouter.post("/", asyncHandler(proveedorController.crear));
proveedorRouter.patch("/:id", asyncHandler(proveedorController.actualizar));
proveedorRouter.patch("/:id/activar", asyncHandler(proveedorController.activar));
proveedorRouter.post("/:id/tarifas", asyncHandler(proveedorController.agregarTarifa));
