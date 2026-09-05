import { Request, Response } from "express";
import {
  actualizarConceptosSchema,
  actualizarFacturaSchema,
  cancelarFacturaSchema,
  crearFacturaSchema,
  timbrarSchema,
} from "./factura.schema";
import * as facturaService from "./factura.service";

export async function crear(req: Request, res: Response) {
  const data = crearFacturaSchema.parse(req.body);
  const factura = await facturaService.crearFactura(data);
  res.status(201).json(factura);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarFacturaSchema.parse(req.body);
  const factura = await facturaService.actualizarFactura(req.params.id, data);
  res.json(factura);
}

export async function actualizarConceptos(req: Request, res: Response) {
  const data = actualizarConceptosSchema.parse(req.body);
  const factura = await facturaService.actualizarConceptos(req.params.id, data);
  res.json(factura);
}

export async function enviarATimbrado(req: Request, res: Response) {
  const factura = await facturaService.enviarATimbrado(req.params.id);
  res.json(factura);
}

export async function timbrar(req: Request, res: Response) {
  const { cfdiUuid } = timbrarSchema.parse(req.body);
  const factura = await facturaService.marcarTimbrada(req.params.id, cfdiUuid);
  res.json(factura);
}

export async function cancelar(req: Request, res: Response) {
  const data = cancelarFacturaSchema.parse(req.body);
  const factura = await facturaService.cancelarFactura(req.params.id, data);
  res.json(factura);
}

export async function listar(_req: Request, res: Response) {
  const facturas = await facturaService.listarFacturas();
  res.json(facturas);
}

export async function obtener(req: Request, res: Response) {
  res.json(await facturaService.obtenerFactura(req.params.id));
}

export async function resumen(_req: Request, res: Response) {
  res.json(await facturaService.resumenFacturacion());
}
