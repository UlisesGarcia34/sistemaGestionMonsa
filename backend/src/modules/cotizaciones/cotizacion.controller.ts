import { Request, Response } from "express";
import { actualizarCotizacionSchema, crearCotizacionSchema } from "./cotizacion.schema";
import * as cotizacionService from "./cotizacion.service";

export async function crear(req: Request, res: Response) {
  const data = crearCotizacionSchema.parse(req.body);
  const cotizacion = await cotizacionService.crearCotizacion(data);
  res.status(201).json(cotizacion);
}

export async function aceptar(req: Request, res: Response) {
  const cotizacion = await cotizacionService.marcarAceptada(req.params.id);
  res.json(cotizacion);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarCotizacionSchema.parse(req.body);
  const cotizacion = await cotizacionService.actualizarCotizacion(req.params.id, data);
  res.json(cotizacion);
}

export async function obtener(req: Request, res: Response) {
  res.json(await cotizacionService.obtenerCotizacion(req.params.id));
}

export async function listar(req: Request, res: Response) {
  const { status } = req.query;
  const cotizaciones = await cotizacionService.listarCotizaciones(status as string | undefined);
  res.json(cotizaciones);
}
