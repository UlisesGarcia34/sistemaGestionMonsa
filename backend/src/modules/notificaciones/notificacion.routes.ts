import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as notificacionController from "./notificacion.controller";

// mergeParams: true para heredar :id del router de shipments donde se monta
// (GET/POST /api/shipments/:id/notificaciones).
export const notificacionRouter = Router({ mergeParams: true });

notificacionRouter.get("/", asyncHandler(notificacionController.listar));
notificacionRouter.post("/", asyncHandler(notificacionController.crear));
