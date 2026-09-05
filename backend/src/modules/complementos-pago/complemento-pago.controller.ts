import { Request, Response } from "express";
import { cancelarComplementoSchema, timbrarComplementoSchema } from "./complemento-pago.schema";
import * as complementoPagoService from "./complemento-pago.service";

export async function listar(req: Request, res: Response) {
  const { facturaId } = req.query;
  res.json(await complementoPagoService.listarComplementosPago(facturaId as string | undefined));
}

export async function obtener(req: Request, res: Response) {
  res.json(await complementoPagoService.obtenerComplementoPago(req.params.id));
}

export async function enviarATimbrado(req: Request, res: Response) {
  res.json(await complementoPagoService.enviarATimbrado(req.params.id));
}

export async function timbrar(req: Request, res: Response) {
  const { cfdiUuid } = timbrarComplementoSchema.parse(req.body);
  res.json(await complementoPagoService.marcarTimbrado(req.params.id, cfdiUuid));
}

export async function cancelar(req: Request, res: Response) {
  const data = cancelarComplementoSchema.parse(req.body);
  res.json(await complementoPagoService.cancelarComplemento(req.params.id, data));
}
