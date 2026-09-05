import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as bookingController from "./booking.controller";

export const bookingRouter = Router();

bookingRouter.get("/", asyncHandler(bookingController.listar));
bookingRouter.get("/:id", asyncHandler(bookingController.obtener));
bookingRouter.post("/", asyncHandler(bookingController.crear));
bookingRouter.patch("/:id", asyncHandler(bookingController.actualizar));
bookingRouter.patch("/:id/confirmar", asyncHandler(bookingController.confirmar));
