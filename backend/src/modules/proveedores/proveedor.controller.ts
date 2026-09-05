import { Request, Response } from "express";
import {
  actualizarProveedorSchema,
  crearProveedorSchema,
  crearTarifaSchema,
} from "./proveedor.schema";
import * as proveedorService from "./proveedor.service";

export async function crear(req: Request, res: Response) {
  const data = crearProveedorSchema.parse(req.body);
  const proveedor = await proveedorService.crearProveedor(data);
  res.status(201).json(proveedor);
}

export async function activar(req: Request, res: Response) {
  const proveedor = await proveedorService.activarProveedor(req.params.id);
  res.json(proveedor);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarProveedorSchema.parse(req.body);
  const proveedor = await proveedorService.actualizarProveedor(req.params.id, data);
  res.json(proveedor);
}

export async function obtener(req: Request, res: Response) {
  res.json(await proveedorService.obtenerProveedor(req.params.id));
}

export async function agregarTarifa(req: Request, res: Response) {
  const data = crearTarifaSchema.parse(req.body);
  const tarifa = await proveedorService.agregarTarifa(req.params.id, data);
  res.status(201).json(tarifa);
}

export async function listar(req: Request, res: Response) {
  const { tipo, estatus } = req.query;
  const proveedores = await proveedorService.listarProveedores(
    tipo as string | undefined,
    estatus as string | undefined
  );
  res.json(proveedores);
}
