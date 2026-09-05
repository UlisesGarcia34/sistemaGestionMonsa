import { Request, Response } from "express";
import { actualizarCxcSchema, registrarCobroSchema } from "./cxc.schema";
import * as cxcService from "./cxc.service";

export async function cobrar(req: Request, res: Response) {
  const data = registrarCobroSchema.parse(req.body);
  const cuenta = await cxcService.registrarCobro(req.params.id, data);
  res.json(cuenta);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarCxcSchema.parse(req.body);
  const cuenta = await cxcService.actualizarCuentaPorCobrar(req.params.id, data);
  res.json(cuenta);
}

export async function listar(req: Request, res: Response) {
  const { estado, clienteId } = req.query;
  const cuentas = await cxcService.listarCuentasPorCobrar(
    estado as string | undefined,
    clienteId as string | undefined
  );
  res.json(cuentas);
}

export async function resumen(_req: Request, res: Response) {
  res.json(await cxcService.resumenCuentasPorCobrar());
}
