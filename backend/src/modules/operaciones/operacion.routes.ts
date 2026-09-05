import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as operacionService from "./operacion.service";

export const operacionRouter = Router();

// Solo lectura: la actualizacion del tracking reusa
// PATCH /api/shipments/:id/tracking (ver shipment.service.actualizarTracking).
operacionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, customerServiceId } = req.query;
    res.json(
      await operacionService.tablero({
        status: status as string | undefined,
        customerServiceId: customerServiceId as string | undefined,
      })
    );
  })
);

operacionRouter.get(
  "/resumen",
  asyncHandler(async (_req, res) => res.json(await operacionService.resumen()))
);
