import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as routingOrderController from "./routing-order.controller";

export const routingOrderRouter = Router();

routingOrderRouter.get("/", asyncHandler(routingOrderController.listar));
routingOrderRouter.get("/:id", asyncHandler(routingOrderController.obtener));
routingOrderRouter.post("/", asyncHandler(routingOrderController.crear));
routingOrderRouter.patch("/:id", asyncHandler(routingOrderController.actualizar));
routingOrderRouter.patch("/:id/recibir", asyncHandler(routingOrderController.recibir));
