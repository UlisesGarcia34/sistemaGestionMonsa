import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as reporteController from "./reporte.controller";

export const reporteRouter = Router();

// El PDF cuelga de un segmento /pdf y no de una extension ".pdf": el router de
// Express 4 mezcla el punto con el nombre del parametro cuando la extension va
// pegada a un :param, y aqui hay rutas parametrizadas (:tipo). El nombre real
// del archivo lo fija el Content-Disposition, no la URL.

// Catalogo de todo lo generable, con el motivo de bloqueo cuando la cascada
// todavia no lo permite (lo consume la pagina /reportes).
reporteRouter.get("/", asyncHandler(reporteController.catalogo));
reporteRouter.get("/estado-correo", asyncHandler(reporteController.estadoCorreo));

reporteRouter.get("/booking/:id/confirmacion", asyncHandler(reporteController.confirmacionBooking));
reporteRouter.get(
  "/booking/:id/confirmacion/pdf",
  asyncHandler(reporteController.confirmacionBookingPdf)
);

reporteRouter.get(
  "/shipment/:id/carta-instrucciones",
  asyncHandler(reporteController.cartaInstrucciones)
);
reporteRouter.get(
  "/shipment/:id/carta-instrucciones/pdf",
  asyncHandler(reporteController.cartaInstruccionesPdf)
);
reporteRouter.post(
  "/shipment/:id/carta-instrucciones/enviar",
  asyncHandler(reporteController.enviarCartaInstrucciones)
);

reporteRouter.get("/factura/:id/cfdi", asyncHandler(reporteController.facturaCfdi));
reporteRouter.get("/factura/:id/cfdi/pdf", asyncHandler(reporteController.facturaCfdiPdf));

reporteRouter.get(
  "/complemento-pago/:id/documento",
  asyncHandler(reporteController.complementoPago)
);
reporteRouter.get(
  "/complemento-pago/:id/documento/pdf",
  asyncHandler(reporteController.complementoPagoPdf)
);

// Libro de Excel para el contador (Facturas, Conceptos, Complementos de pago,
// Cuentas por cobrar). Va antes de las rutas /shipment/:id... por si acaso,
// pero el prefijo distinto ya evita cualquier choque.
reporteRouter.get("/facturacion/excel", asyncHandler(reporteController.facturacionExcel));

// :tipo = hbl | mbl
reporteRouter.get(
  "/shipment/:id/conocimiento/:tipo",
  asyncHandler(reporteController.conocimiento)
);
reporteRouter.get(
  "/shipment/:id/conocimiento/:tipo/pdf",
  asyncHandler(reporteController.conocimientoPdf)
);
