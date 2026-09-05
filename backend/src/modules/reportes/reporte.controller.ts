import { Request, Response } from "express";
import { correoConfigurado, enviarCorreo } from "@/shared/mailer";
import { renderizarPdf } from "./reporte.pdf";
import { generarLibroFacturacion } from "./reporte.excel";
import { enviarDocumentoSchema, tipoConocimientoSchema } from "./reporte.schema";
import * as reporteService from "./reporte.service";
import { DocumentoRenderizable } from "./reporte.tipos";

// Cada documento se expone dos veces:
//  - GET .../<doc>       -> JSON con la estructura renderizable (la vista
//                           imprimible del frontend la pinta con @media print)
//  - GET .../<doc>.pdf   -> el mismo objeto pasado por el generador pdf-lib
// El contenido lo arma el service una sola vez, asi que las dos salidas no se
// pueden desincronizar.
function responderPdf(res: Response, documento: DocumentoRenderizable, pdf: Buffer) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${documento.nombreArchivo}"`);
  res.setHeader("Content-Length", pdf.length);
  res.end(pdf);
}

export async function catalogo(_req: Request, res: Response) {
  res.json(await reporteService.catalogoDocumentos());
}

export async function estadoCorreo(_req: Request, res: Response) {
  res.json(correoConfigurado());
}

export async function confirmacionBooking(req: Request, res: Response) {
  res.json(await reporteService.confirmacionBooking(req.params.id));
}

export async function confirmacionBookingPdf(req: Request, res: Response) {
  const documento = await reporteService.confirmacionBooking(req.params.id);
  responderPdf(res, documento, await renderizarPdf(documento));
}

export async function cartaInstrucciones(req: Request, res: Response) {
  res.json(await reporteService.cartaInstrucciones(req.params.id));
}

export async function cartaInstruccionesPdf(req: Request, res: Response) {
  const documento = await reporteService.cartaInstrucciones(req.params.id);
  responderPdf(res, documento, await renderizarPdf(documento));
}

export async function facturaCfdi(req: Request, res: Response) {
  res.json(await reporteService.facturaCfdi(req.params.id));
}

export async function facturaCfdiPdf(req: Request, res: Response) {
  const documento = await reporteService.facturaCfdi(req.params.id);
  responderPdf(res, documento, await renderizarPdf(documento));
}

export async function complementoPago(req: Request, res: Response) {
  res.json(await reporteService.complementoPagoDoc(req.params.id));
}

export async function complementoPagoPdf(req: Request, res: Response) {
  const documento = await reporteService.complementoPagoDoc(req.params.id);
  responderPdf(res, documento, await renderizarPdf(documento));
}

// Libro de Excel para el contador: 4 hojas (Facturas, Conceptos, Complementos
// de pago, Cuentas por cobrar). exceljs arma el workbook completo en memoria.
export async function facturacionExcel(_req: Request, res: Response) {
  const buffer = await generarLibroFacturacion();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="facturacion-monsa.xlsx"');
  res.end(buffer);
}

export async function conocimiento(req: Request, res: Response) {
  const tipo = tipoConocimientoSchema.parse(req.params.tipo.toUpperCase());
  res.json(await reporteService.conocimientoEmbarque(req.params.id, tipo));
}

export async function conocimientoPdf(req: Request, res: Response) {
  const tipo = tipoConocimientoSchema.parse(req.params.tipo.toUpperCase());
  const documento = await reporteService.conocimientoEmbarque(req.params.id, tipo);
  responderPdf(res, documento, await renderizarPdf(documento));
}

// Envio de la carta de instrucciones al cliente. El gate del service corre
// ANTES de tocar el correo: si el embarque no puede emitir carta, no se manda
// nada. El PDF adjunto es el mismo que se descarga desde la pantalla.
export async function enviarCartaInstrucciones(req: Request, res: Response) {
  const data = enviarDocumentoSchema.parse(req.body);
  const documento = await reporteService.cartaInstrucciones(req.params.id);

  const adjuntos = data.adjuntarPdf
    ? [
        {
          nombre: documento.nombreArchivo,
          contenido: await renderizarPdf(documento),
          tipo: "application/pdf",
        },
      ]
    : undefined;

  res.json(
    await enviarCorreo({
      para: data.para,
      copia: data.copia,
      asunto: data.asunto,
      cuerpo: data.cuerpo,
      adjuntos,
    })
  );
}
