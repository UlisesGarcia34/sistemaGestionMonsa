import { hoyOperativo } from '@/modules/shipments/shipment.politicas';
import { prisma } from "@/config/prisma";

// Replica los cortes de la hoja REP_AUT.xlsx (por vendedor, por status, por
// agente/proveedor) pero usando GROUP BY real sobre datos relacionales en vez
// de SUMIF/COUNTIF que comparan texto libre. Esto elimina la clase de error
// que encontramos en el Excel original (etiquetas que no coinciden con las
// de la formula, dashboards con numeros ya incorrectos sin que nadie lo note).

interface ConteoGrupo {
  _count: { _all: number };
}

export async function resumenPorStatus() {
  const resultado = await prisma.shipment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return resultado.map((r: { status: string } & ConteoGrupo) => ({
    status: r.status,
    cantidad: r._count._all,
  }));
}

export async function resumenPorModalidad() {
  const resultado = await prisma.shipment.groupBy({
    by: ["modalidad"],
    _count: { _all: true },
  });
  return resultado.map((r: { modalidad: string } & ConteoGrupo) => ({
    modalidad: r.modalidad,
    cantidad: r._count._all,
  }));
}

export async function resumenPorVendedor() {
  const resultado = await prisma.cotizacion.groupBy({
    by: ["vendedorId", "moneda"],
    _count: { _all: true },
    _sum: { montoVenta: true },
  });
  const vendedores = await prisma.usuario.findMany({
    where: { id: { in: resultado.map((r: { vendedorId: string }) => r.vendedorId) } },
    select: { id: true, nombre: true },
  });
  return resultado.map(
    (r: { vendedorId: string; moneda: string; _sum: { montoVenta: unknown } } & ConteoGrupo) => ({
      moneda: r.moneda,
      vendedor: vendedores.find((v: { id: string; nombre: string }) => v.id === r.vendedorId)?.nombre ?? "N/A",
      cotizaciones: r._count._all,
      ventaTotal: r._sum.montoVenta,
    })
  );
}

export async function embarquesPorSemana() {
  // Agregacion por semana ISO usando SQL crudo -- equivalente a la columna
  // "NO DE SEMANA" del Excel, pero calculada, no capturada a mano.
  // YEARWEEK(..., 3) usa el modo ISO-8601 (semana empieza en lunes, la
  // semana 1 es la que contiene el primer jueves del anio) igual que Excel.
  return prisma.$queryRaw`
    SELECT YEARWEEK(creadoEn, 3) AS semana, COUNT(*) AS cantidad
    FROM Shipment
    GROUP BY semana
    ORDER BY semana DESC
    LIMIT 12
  `;
}

export async function cuentasPorPagarVencenPronto(diasVentana = 10) {
  const limite = new Date();
  limite.setDate(limite.getDate() + diasVentana);
  return prisma.cuentaPorPagar.findMany({
    where: {
      fechaLimitePago: { lte: limite },
      fechaPagoConfirmado: null,
    },
    include: { proveedor: true, shipment: true },
    orderBy: { fechaLimitePago: "asc" },
  });
}

export async function cuentasPorCobrarVencenPronto(diasVentana = 10) {
  const limite = new Date();
  limite.setDate(limite.getDate() + diasVentana);
  return prisma.cuentaPorCobrar.findMany({
    where: {
      fechaVencimiento: { lte: limite },
      estatusCobro: { not: "COBRADA" },
    },
    include: {
      cliente: { select: { razonSocial: true } },
      factura: { select: { numeroFactura: true } },
    },
    orderBy: { fechaVencimiento: "asc" },
  });
}

// Rentabilidad real: solo valorizaciones confirmadas, excluyendo cancelados.
// Deja ver margenes negativos -- caso real del Excel (folio con perdida).
export async function rentabilidadPorEmbarque() {
  const shipments = await prisma.shipment.findMany({
    where: { status: { not: 'CANCELADO' }, valorizacionConfirmada: true, valorizacionVenta: { not: null }, valorizacionCompra: { not: null } },
    select: {
      valorizacionVenta: true, valorizacionCompra: true,
      folio: true,
      status: true,
      modalidad: true,
      consignee: { select: { razonSocial: true } },
      booking: {
        select: {
          cotizacion: { select: { montoVenta: true, montoCompra: true, moneda: true } },
        },
      },
    },
    orderBy: { creadoEn: "desc" },
  });
  return shipments.map((s) => {
    const venta = Number(s.valorizacionVenta);
    const compra = Number(s.valorizacionCompra);
    return {
      folio: s.folio,
      consignee: s.consignee.razonSocial,
      modalidad: s.modalidad,
      status: s.status,
      moneda: s.booking.cotizacion.moneda,
      venta,
      compra,
      margen: venta - compra,
    };
  });
}

// Embarques vivos con ETA dentro de la ventana de aviso de llegada (10 dias),
// sin arribo real y sin ninguna notificacion AVISO_ARRIBO ya registrada. Es la
// alerta que antes vivia solo como calculo en operaciones; ahora que hay un log
// de notificaciones se puede saber cuales YA se avisaron.
export async function avisosArriboPendientes(diasVentana = 10) {
  const hoy = hoyOperativo();
  const limite = new Date(hoy);
  limite.setUTCDate(limite.getUTCDate() + diasVentana + 1);

  const shipments = await prisma.shipment.findMany({
    where: {
      status: { in: ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR", "PARA_FACTURAR"] },
      fechaArriboReal: null,
      eta: { gte: hoy, lt: limite },
    },
    select: {
      id: true,
      folio: true,
      eta: true,
      consignee: { select: { razonSocial: true } },
      notificaciones: { where: { tipo: "AVISO_ARRIBO" }, select: { id: true } },
    },
    orderBy: { eta: "asc" },
  });

  return shipments
    .filter((s) => s.notificaciones.length === 0)
    .map((s) => ({
      id: s.id,
      folio: s.folio,
      consignee: s.consignee.razonSocial,
      eta: s.eta,
      diasParaEta: s.eta ? Math.floor((s.eta.getTime() - hoy.getTime()) / 86_400_000) : null,
    }));
}

// KPIs de cabecera del dashboard: donde esta parada la operacion (cascada)
// y el pulso financiero, en un solo llamado.
export async function kpis() {
  const [
    clientesActivos,
    prospectos,
    cotizacionesAbiertas,
    bookingsPorConfirmar,
    embarquesEnCurso,
    embarquesPorFacturar,
    rentabilidad,
    cxpAgg,
    cxcAgg,
  ] = await Promise.all([
    prisma.cliente.count({ where: { estatus: "ACTIVO" } }),
    prisma.cliente.count({ where: { estatus: { in: ["PROSPECTO", "EN_VALIDACION_KYC"] } } }),
    prisma.cotizacion.count({ where: { status: { in: ["BORRADOR", "ENVIADA", "ACEPTADA"] } } }),
    prisma.booking.count({ where: { status: "SOLICITADO" } }),
    prisma.shipment.count({
      where: { status: { in: ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR"] } },
    }),
    prisma.shipment.count({ where: { status: "PARA_FACTURAR" } }),
    rentabilidadPorEmbarque(),
    prisma.cuentaPorPagar.groupBy({
      by: ["moneda"],
      _sum: { monto: true },
      where: { fechaPagoConfirmado: null },
    }),
    prisma.cuentaPorCobrar.findMany({
      where: { estatusCobro: { not: "COBRADA" } },
      select: { monto: true, montoCobrado: true, moneda: true },
    }),
  ]);

  const monedas = new Set([...rentabilidad.map(r => r.moneda), ...cxpAgg.map(r => r.moneda), ...cxcAgg.map(r => r.moneda)]);
  const porMoneda = [...monedas].sort().map(moneda => ({
    moneda,
    margenTotal: rentabilidad.filter(r => r.moneda === moneda).reduce((a, r) => a + r.margen, 0),
    porCobrar: cxcAgg.filter(c => c.moneda === moneda).reduce((a, c) => a + Number(c.monto) - Number(c.montoCobrado), 0),
    porPagar: Number(cxpAgg.find(c => c.moneda === moneda)?._sum.monto ?? 0),
  }));
  const unico = porMoneda.length === 1 ? porMoneda[0] : null;
  const embarquesConPerdida = rentabilidad.filter(r => r.margen < 0).length;

  return {
    clientesActivos,
    prospectos,
    cotizacionesAbiertas,
    bookingsPorConfirmar,
    embarquesEnCurso,
    embarquesPorFacturar,
    margenTotal: unico?.margenTotal ?? null,
    moneda: unico?.moneda ?? null,
    porMoneda,
    embarquesConPerdida,
    porPagar: unico?.porPagar ?? null,
    porCobrar: unico?.porCobrar ?? null,
  };
}
