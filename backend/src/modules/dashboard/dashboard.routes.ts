import { Router } from "express";
import { filtrosShipmentSchema } from '@/modules/shipments/shipment.schema';
import { resumenEmbarques } from './embarque-kpi.service';
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as dashboardService from "./dashboard.service";

export const dashboardRouter = Router();
dashboardRouter.get('/embarques', asyncHandler(async (req, res) => {
  res.json(await resumenEmbarques(filtrosShipmentSchema.parse(req.query)));
}));

dashboardRouter.get(
  "/kpis",
  asyncHandler(async (_req, res) => res.json(await dashboardService.kpis()))
);
dashboardRouter.get(
  "/rentabilidad",
  asyncHandler(async (_req, res) => res.json(await dashboardService.rentabilidadPorEmbarque()))
);
dashboardRouter.get(
  "/por-status",
  asyncHandler(async (_req, res) => res.json(await dashboardService.resumenPorStatus()))
);
dashboardRouter.get(
  "/por-modalidad",
  asyncHandler(async (_req, res) => res.json(await dashboardService.resumenPorModalidad()))
);
dashboardRouter.get(
  "/por-vendedor",
  asyncHandler(async (_req, res) => res.json(await dashboardService.resumenPorVendedor()))
);
dashboardRouter.get(
  "/embarques-por-semana",
  asyncHandler(async (_req, res) => res.json(await dashboardService.embarquesPorSemana()))
);
dashboardRouter.get(
  "/pagos-por-vencer",
  asyncHandler(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 10;
    res.json(await dashboardService.cuentasPorPagarVencenPronto(dias));
  })
);
dashboardRouter.get(
  "/cobros-por-vencer",
  asyncHandler(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 10;
    res.json(await dashboardService.cuentasPorCobrarVencenPronto(dias));
  })
);
dashboardRouter.get(
  "/avisos-arribo-pendientes",
  asyncHandler(async (req, res) => {
    const dias = req.query.dias ? Number(req.query.dias) : 10;
    res.json(await dashboardService.avisosArriboPendientes(dias));
  })
);
