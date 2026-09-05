import { Request, Response } from "express";
import {
  actualizarDocumentoSchema,
  actualizarShipmentSchema,
  actualizarTrackingSchema,
  confirmarValorizacionSchema,
  crearShipmentSchema,
} from "./shipment.schema";
import * as shipmentService from "./shipment.service";

export async function crear(req: Request, res: Response) {
  const data = crearShipmentSchema.parse(req.body);
  const shipment = await shipmentService.crearShipment(data);
  res.status(201).json(shipment);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarShipmentSchema.parse(req.body);
  const shipment = await shipmentService.actualizarShipment(req.params.id, data);
  res.json(shipment);
}

export async function actualizarTracking(req: Request, res: Response) {
  const data = actualizarTrackingSchema.parse(req.body);
  const shipment = await shipmentService.actualizarTracking(req.params.id, data);
  res.json(shipment);
}

export async function actualizarDocumento(req: Request, res: Response) {
  const data = actualizarDocumentoSchema.parse(req.body);
  const documento = await shipmentService.actualizarDocumento(req.params.id, data);
  res.json(documento);
}

// TODO requireRol(VENTAS): la valorizacion la confirma el area de ventas.
export async function confirmarValorizacion(req: Request, res: Response) {
  const data = confirmarValorizacionSchema.parse(req.body);
  const shipment = await shipmentService.confirmarValorizacion(req.params.id, data);
  res.json(shipment);
}

export async function cerrar(req: Request, res: Response) {
  const resultado = await shipmentService.cerrarShipment(req.params.id);
  res.json(resultado);
}

export async function listar(req: Request, res: Response) {
  const { status } = req.query;
  const shipments = await shipmentService.listarShipments(status as string | undefined);
  res.json(shipments);
}

export async function obtener(req: Request, res: Response) {
  const shipment = await shipmentService.obtenerShipment(req.params.id);
  res.json(shipment);
}
