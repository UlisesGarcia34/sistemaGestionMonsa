import { Request, Response } from "express";
import * as catalogoSatService from "./catalogo-sat.service";

export async function claveProdServ(req: Request, res: Response) {
  res.json(await catalogoSatService.buscarClaveProdServ(req.query.q as string | undefined));
}

export async function claveUnidad(req: Request, res: Response) {
  res.json(await catalogoSatService.buscarClaveUnidad(req.query.q as string | undefined));
}

export async function regimenFiscal(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarRegimenFiscal());
}

export async function usoCfdi(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarUsoCfdi());
}

export async function formaPago(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarFormaPago());
}

export async function moneda(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarMoneda());
}

export async function objetoImp(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarObjetoImp());
}

export async function motivoCancelacion(_req: Request, res: Response) {
  res.json(await catalogoSatService.listarMotivoCancelacion());
}
