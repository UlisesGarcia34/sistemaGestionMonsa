import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/errorHandler";
import * as authController from "./auth.controller";

// /api/auth/login es la unica ruta bajo /api que el middleware requireAuth
// deja pasar sin token (ver RUTAS_PUBLICAS en shared/middleware/auth.ts).
export const authRouter = Router();

authRouter.post("/login", asyncHandler(authController.login));
authRouter.get("/yo", asyncHandler(authController.yo));
authRouter.patch("/password", asyncHandler(authController.cambiarPassword));
