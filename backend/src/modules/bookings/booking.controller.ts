import { Request, Response } from "express";
import { actualizarBookingSchema, crearBookingSchema } from "./booking.schema";
import * as bookingService from "./booking.service";

export async function crear(req: Request, res: Response) {
  const data = crearBookingSchema.parse(req.body);
  const booking = await bookingService.crearBooking(data);
  res.status(201).json(booking);
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarBookingSchema.parse(req.body);
  const booking = await bookingService.actualizarBooking(req.params.id, data);
  res.json(booking);
}

export async function confirmar(req: Request, res: Response) {
  const booking = await bookingService.confirmarBooking(req.params.id);
  res.json(booking);
}

export async function listar(req: Request, res: Response) {
  const { status } = req.query;
  const bookings = await bookingService.listarBookings(status as string | undefined);
  res.json(bookings);
}

export async function obtener(req: Request, res: Response) {
  res.json(await bookingService.obtenerBooking(req.params.id));
}
