import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as catalogoSatController from "./catalogo-sat.controller";

// Solo lectura: los catalogos SAT se pueblan con `npm run seed:sat`
// (prisma/importarCatalogosSat.ts), nunca desde la API.
export const catalogoSatRouter = Router();

catalogoSatRouter.get("/clave-prod-serv", asyncHandler(catalogoSatController.claveProdServ));
catalogoSatRouter.get("/clave-unidad", asyncHandler(catalogoSatController.claveUnidad));
catalogoSatRouter.get("/regimen-fiscal", asyncHandler(catalogoSatController.regimenFiscal));
catalogoSatRouter.get("/uso-cfdi", asyncHandler(catalogoSatController.usoCfdi));
catalogoSatRouter.get("/forma-pago", asyncHandler(catalogoSatController.formaPago));
catalogoSatRouter.get("/moneda", asyncHandler(catalogoSatController.moneda));
catalogoSatRouter.get("/objeto-imp", asyncHandler(catalogoSatController.objetoImp));
catalogoSatRouter.get(
  "/motivo-cancelacion",
  asyncHandler(catalogoSatController.motivoCancelacion)
);
