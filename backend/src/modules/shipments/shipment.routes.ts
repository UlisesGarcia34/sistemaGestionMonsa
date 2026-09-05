import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import { notificacionRouter } from "@/modules/notificaciones/notificacion.routes";
import * as shipmentController from "./shipment.controller";

export const shipmentRouter = Router();

shipmentRouter.get("/", asyncHandler(shipmentController.listar));
shipmentRouter.get("/:id", asyncHandler(shipmentController.obtener));
shipmentRouter.post("/", asyncHandler(shipmentController.crear));
shipmentRouter.patch("/:id", asyncHandler(shipmentController.actualizar));
shipmentRouter.patch("/:id/tracking", asyncHandler(shipmentController.actualizarTracking));
shipmentRouter.patch("/:id/documento", asyncHandler(shipmentController.actualizarDocumento));
shipmentRouter.patch("/:id/valorizacion", asyncHandler(shipmentController.confirmarValorizacion));
shipmentRouter.patch("/:id/cerrar", asyncHandler(shipmentController.cerrar));

// Log de notificaciones al cliente, colgado del embarque.
shipmentRouter.use("/:id/notificaciones", notificacionRouter);
