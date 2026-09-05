import { Request, Response } from "express";
import { actualizarCxpSchema, crearCxpSchema, registrarPagoSchema } from "./cxp.schema";
import * as cxpService from "./cxp.service";

export async function crear(req: Request, res: Response) {
  const data = crearCxpSchema.parse(req.body);
  const cuenta = await cxpService.crearCuentaPorPagar(data);
  res.status(201).json(cuenta);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarCxpSchema.parse(req.body);
  const cuenta = await cxpService.actualizarCuentaPorPagar(req.params.id, data);
  res.json(cuenta);
}

export async function pagar(req: Request, res: Response) {
  const data = registrarPagoSchema.parse(req.body);
  const cuenta = await cxpService.registrarPago(req.params.id, data);
  res.json(cuenta);
}

export async function listar(req: Request, res: Response) {
  const { estado, proveedorId } = req.query;
  const cuentas = await cxpService.listarCuentasPorPagar(
    estado as string | undefined,
    proveedorId as string | undefined
  );
  res.json(cuentas);
}

export async function resumen(_req: Request, res: Response) {
  res.json(await cxpService.resumenCuentasPorPagar());
}
