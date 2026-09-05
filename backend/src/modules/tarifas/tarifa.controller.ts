import { Request, Response } from "express";
import { actualizarTarifaSchema, crearTarifaSchema } from "./tarifa.schema";
import * as tarifaService from "./tarifa.service";

export async function listar(req: Request, res: Response) {
  const { proveedorId, modalidad, tipo, soloVigentes } = req.query;
  const tarifas = await tarifaService.listarTarifas({
    proveedorId: proveedorId as string | undefined,
    modalidad: modalidad as string | undefined,
    tipo: tipo as string | undefined,
    soloVigentes: soloVigentes === "true",
  });
  res.json(tarifas);
}

export async function crear(req: Request, res: Response) {
  const data = crearTarifaSchema.parse(req.body);
  const tarifa = await tarifaService.crearTarifa(data);
  res.status(201).json(tarifa);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarTarifaSchema.parse(req.body);
  const tarifa = await tarifaService.actualizarTarifa(req.params.id, data);
  res.json(tarifa);
}

export async function eliminar(req: Request, res: Response) {
  res.json(await tarifaService.eliminarTarifa(req.params.id));
}
