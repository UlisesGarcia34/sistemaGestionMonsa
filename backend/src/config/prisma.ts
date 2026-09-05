import { PrismaClient } from "@prisma/client";

// Instancia unica de Prisma reutilizada en toda la app.
// Evita agotar conexiones a la base de datos en desarrollo con hot-reload.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
