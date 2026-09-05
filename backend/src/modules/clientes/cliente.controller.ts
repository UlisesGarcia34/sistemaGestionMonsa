import { Request, Response } from "express";
import {
  activarClienteSchema,
  actualizarClienteSchema,
  crearClienteSchema,
} from "./cliente.schema";
import * as clienteService from "./cliente.service";

export async function crear(req: Request, res: Response) {
  const data = crearClienteSchema.parse(req.body);
  const prospecto = await clienteService.crearProspecto(data);
  res.status(201).json(prospecto);
}

export async function activar(req: Request, res: Response) {
  const data = activarClienteSchema.parse(req.body);
  const cliente = await clienteService.activarCliente(req.params.id, data);
  res.json(cliente);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarClienteSchema.parse(req.body);
  const cliente = await clienteService.actualizarCliente(req.params.id, data);
  res.json(cliente);
}

export async function listar(req: Request, res: Response) {
  const { estatus } = req.query;
  const clientes = await clienteService.listarClientes(estatus as string | undefined);
  res.json(clientes);
}

export async function obtener(req: Request, res: Response) {
  const cliente = await clienteService.obtenerCliente(req.params.id);
  res.json(cliente);
}
