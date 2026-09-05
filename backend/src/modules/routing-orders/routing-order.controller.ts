import { Request, Response } from "express";
import {
  actualizarRoutingOrderSchema,
  crearRoutingOrderSchema,
} from "./routing-order.schema";
import * as routingOrderService from "./routing-order.service";

export async function crear(req: Request, res: Response) {
  const data = crearRoutingOrderSchema.parse(req.body);
  const ro = await routingOrderService.crearRoutingOrder(data);
  res.status(201).json(ro);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarRoutingOrderSchema.parse(req.body);
  const ro = await routingOrderService.actualizarRoutingOrder(req.params.id, data);
  res.json(ro);
}

export async function recibir(req: Request, res: Response) {
  const ro = await routingOrderService.marcarRecibido(req.params.id);
  res.json(ro);
}

export async function listar(req: Request, res: Response) {
  const { cotizacionId, status } = req.query;
  const lista = await routingOrderService.listarRoutingOrders({
    cotizacionId: cotizacionId as string | undefined,
    status: status as string | undefined,
  });
  res.json(lista);
}

export async function obtener(req: Request, res: Response) {
  res.json(await routingOrderService.obtenerRoutingOrder(req.params.id));
}
