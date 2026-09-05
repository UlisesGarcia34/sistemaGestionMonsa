import { Request, Response } from "express";
import { crearNotificacionSchema } from "./notificacion.schema";
import * as notificacionService from "./notificacion.service";

// El router se monta con mergeParams desde shipment.routes.ts, asi que el id
// del embarque llega como req.params.id.
export async function crear(req: Request, res: Response) {
  const data = crearNotificacionSchema.parse(req.body);
  const notificacion = await notificacionService.registrarNotificacion(
    req.params.id,
    req.usuario?.sub,
    data
  );
  res.status(201).json(notificacion);
}

export async function listar(req: Request, res: Response) {
  res.json(await notificacionService.listarPorShipment(req.params.id));
}
