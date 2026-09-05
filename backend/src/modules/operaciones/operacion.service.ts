import { prisma } from "@/config/prisma";
import { accionesShipment, calculosOperativos, hoyOperativo } from '@/modules/shipments/shipment.politicas';
import { SELECT_USUARIO_PUBLICO } from "@/modules/usuarios/usuario.service";

// Modulo Operaciones: tablero de seguimiento de los embarques vivos. Es de
// solo lectura (como dashboard y usuarios) -- la edicion del tracking reusa
// PATCH /api/shipments/:id/tracking, donde ya vive la logica de shipment. Aqui
// solo se agregan los campos calculados que el Excel llevaba como formula
// (DIAS EN PUERTO, TT, atraso) pero que aqui se derivan al leer para que nunca
// se desincronicen del dato fuente.

// Estados en los que el embarque sigue siendo un expediente operativo: fuera de
// ellos ya paso a finanzas y no se le hace tracking.
const ACTIVOS = ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR", "PARA_FACTURAR"] as const;

const INCLUDE = {
  consignee: { select: { id: true, razonSocial: true, contactoEmail: true } },
  customerService: { select: SELECT_USUARIO_PUBLICO },
  contenedores: true,
  facturas: { select: { tipo: true } },
  booking: { include: { proveedor: { select: { id: true, nombre: true } } } },
  notificaciones: {
    include: { enviadoPor: { select: SELECT_USUARIO_PUBLICO } },
    orderBy: { fechaEnviada: "desc" } as const,
  },
};

export async function tablero(params: { status?: string; customerServiceId?: string } = {}) {
  const hoy = hoyOperativo();

  const shipments = await prisma.shipment.findMany({
    where: {
      status: params.status ? (params.status as never) : { in: ACTIVOS as never },
      customerServiceId: params.customerServiceId,
    },
    include: INCLUDE,
    orderBy: [{ eta: "asc" }, { creadoEn: "desc" }],
  });

  return shipments.map((s) => {
    const eta = s.eta ?? null;
    const arriboReal = s.fechaArriboReal ?? null;
    const liberacion = s.fechaLiberacion ?? null;

    return {
      id: s.id,
      version: s.version,
      acciones: accionesShipment(s),
      folio: s.folio,
      status: s.status,
      tipoOperacion: s.tipoOperacion,
      modalidad: s.modalidad,
      estatusMaterial: s.estatusMaterial,
      consignee: s.consignee,
      shipperNombre: s.shipperNombre,
      customerService: s.customerService,
      proveedor: s.booking?.proveedor ?? null,
      referenciaBooking: s.booking?.referencia ?? null,
      vessel: s.vessel,
      voyage: s.voyage,
      puertoOrigen: s.puertoOrigen,
      paisOrigen: s.paisOrigen,
      puertoDestino: s.puertoDestino,
      destinoFinal: s.destinoFinal,
      etd: s.etd,
      eta,
      fechaArriboReal: arriboReal,
      fechaLiberacion: liberacion,
      contenedores: s.contenedores,
      notificaciones: s.notificaciones,
      // Calculados (no persistidos):
      ...calculosOperativos(s, hoy),
    };
  });
}

export async function resumen() {
  const filas = await tablero();
  return {
    activos: filas.length,
    enTransito: filas.filter((f) => f.etd && !f.fechaArriboReal).length,
    enPuerto: filas.filter((f) => f.fechaArriboReal && !f.fechaLiberacion).length,
    arribanEstaSemana: filas.filter(
      (f) => f.diasParaEta != null && f.diasParaEta >= 0 && f.diasParaEta <= 7 && !f.fechaArriboReal
    ).length,
    atrasados: filas.filter((f) => f.atrasado).length,
    avisosPendientes: filas.filter((f) => f.avisoLlegadaPendiente).length,
  };
}
