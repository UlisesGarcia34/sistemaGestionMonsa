import { prisma } from "@/config/prisma";
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

// Ventana del aviso de llegada: el equipo avisa al cliente ~10 dias antes del
// arribo. No hay campo que persista "aviso enviado" en el schema vigente, asi
// que la alerta se deriva: ETA dentro de la ventana y sin arribo real todavia.
const DIAS_AVISO_LLEGADA = 10;

const DIA_MS = 86_400_000;

function diffDias(desde: Date, hasta: Date) {
  return Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS);
}

const INCLUDE = {
  consignee: { select: { id: true, razonSocial: true, contactoEmail: true } },
  customerService: { select: SELECT_USUARIO_PUBLICO },
  contenedores: true,
  booking: { include: { proveedor: { select: { id: true, nombre: true } } } },
  notificaciones: {
    include: { enviadoPor: { select: SELECT_USUARIO_PUBLICO } },
    orderBy: { fechaEnviada: "desc" } as const,
  },
};

export async function tablero(params: { status?: string; customerServiceId?: string } = {}) {
  const hoy = new Date();

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

    // Dias en puerto: desde el arribo real hasta la liberacion (o hasta hoy si
    // sigue sin liberarse). Sin arribo real todavia no aplica.
    const diasEnPuerto = arriboReal ? diffDias(arriboReal, liberacion ?? hoy) : null;

    // Dias para el ETA: negativo = el ETA ya paso.
    const diasParaEta = eta ? diffDias(hoy, eta) : null;

    const atrasado = eta != null && !arriboReal && eta < hoy;
    const yaAvisoArribo = s.notificaciones.some((n) => n.tipo === "AVISO_ARRIBO");
    const avisoLlegadaPendiente =
      eta != null &&
      !arriboReal &&
      !yaAvisoArribo &&
      diasParaEta != null &&
      diasParaEta >= 0 &&
      diasParaEta <= DIAS_AVISO_LLEGADA;

    return {
      id: s.id,
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
      diasEnPuerto,
      diasParaEta,
      atrasado,
      avisoLlegadaPendiente,
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
