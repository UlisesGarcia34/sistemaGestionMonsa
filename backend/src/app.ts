import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { authRouter } from "@/modules/auth/auth.routes";
import { clienteRouter } from "@/modules/clientes/cliente.routes";
import { proveedorRouter } from "@/modules/proveedores/proveedor.routes";
import { cotizacionRouter } from "@/modules/cotizaciones/cotizacion.routes";
import { bookingRouter } from "@/modules/bookings/booking.routes";
import { shipmentRouter } from "@/modules/shipments/shipment.routes";
import { tarifaRouter } from "@/modules/tarifas/tarifa.routes";
import { routingOrderRouter } from "@/modules/routing-orders/routing-order.routes";
import { operacionRouter } from "@/modules/operaciones/operacion.routes";
import { facturaRouter } from "@/modules/facturacion/factura.routes";
import { complementoPagoRouter } from "@/modules/complementos-pago/complemento-pago.routes";
import { catalogoSatRouter } from "@/modules/catalogos-sat/catalogo-sat.routes";
import { cuentaPorPagarRouter } from "@/modules/cuentas-por-pagar/cxp.routes";
import { cuentaPorCobrarRouter } from "@/modules/cuentas-por-cobrar/cxc.routes";
import { dashboardRouter } from "@/modules/dashboard/dashboard.routes";
import { reporteRouter } from "@/modules/reportes/reporte.routes";
import { usuarioRouter } from "@/modules/usuarios/usuario.routes";
import { requireAuth } from "@/shared/middleware/auth";
import { errorHandler } from "@/shared/middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

// Unica ruta sin sesion junto con /api/auth/login (ver RUTAS_PUBLICAS en
// shared/middleware/auth.ts): sirve para que el frontend y los healthchecks
// sepan si la API esta viva sin necesitar credenciales.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Todo /api exige un JWT valido. El middleware va montado ANTES de los routers
// para que ninguna ruta nueva quede publica por olvido: la lista de excepciones
// es explicita y vive en un solo lugar.
app.use("/api", requireAuth);

app.use("/api/auth", authRouter);

// Rutas de la cascada operativa, en el mismo orden en que se desbloquean:
// clientes/proveedores -> cotizaciones -> bookings -> shipments -> facturacion
app.use("/api/clientes", clienteRouter);
app.use("/api/proveedores", proveedorRouter);
app.use("/api/tarifas", tarifaRouter);
app.use("/api/cotizaciones", cotizacionRouter);
app.use("/api/routing-orders", routingOrderRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/shipments", shipmentRouter);
app.use("/api/operaciones", operacionRouter);
app.use("/api/facturas", facturaRouter);
app.use("/api/complementos-pago", complementoPagoRouter);
app.use("/api/catalogos-sat", catalogoSatRouter);
app.use("/api/cuentas-por-pagar", cuentaPorPagarRouter);
app.use("/api/cuentas-por-cobrar", cuentaPorCobrarRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reportes", reporteRouter);
app.use("/api/usuarios", usuarioRouter);

app.use(errorHandler);
