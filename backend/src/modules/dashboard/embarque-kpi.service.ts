import { Prisma } from '@prisma/client';
import { transaccion } from '@/shared/transaccion';
import { FiltrosShipment } from '@/modules/shipments/shipment.schema';
import { whereShipments } from '@/modules/shipments/shipment.service';
import { ABIERTOS, EDITABLES, hoyOperativo } from '@/modules/shipments/shipment.politicas';

export async function resumenEmbarques(filtros: FiltrosShipment, ahora = new Date()) {
  const hoy = hoyOperativo(ahora);
  const finVentana = new Date(hoy.getTime() + 11 * 86400000);
  return transaccion(async tx => {
    const base = whereShipments(filtros);
    const con = (w: Prisma.ShipmentWhereInput): Prisma.ShipmentWhereInput => ({ AND: [base, w] });
    const activos = { status: { in: [...EDITABLES] }, fechaArriboReal: null } satisfies Prisma.ShipmentWhereInput;
    const proximos = { ...activos, eta: { gte: hoy, lt: finVentana } };
    const atrasados = { ...activos, eta: { lt: hoy } };
    const pendientes = { ...proximos, notificaciones: { none: { tipo: 'AVISO_ARRIBO' as const } } };
    const valorizados = { status: { not: 'CANCELADO' as const }, valorizacionConfirmada: true, valorizacionVenta: { not: null }, valorizacionCompra: { not: null } };
    const [total, enCurso, porFacturar, cancelados, proximosArribos, avisosPendientes, arribosAtrasados, cobertura, porStatus, porModalidad, monedas, alertas] = await Promise.all([
      tx.shipment.count({ where: base }),
      tx.shipment.count({ where: con({ status: { in: [...ABIERTOS] } }) }),
      tx.shipment.count({ where: con({ status: 'PARA_FACTURAR' }) }),
      tx.shipment.count({ where: con({ status: 'CANCELADO' }) }),
      tx.shipment.count({ where: con(proximos) }), tx.shipment.count({ where: con(pendientes) }),
      tx.shipment.count({ where: con(atrasados) }), tx.shipment.count({ where: con(valorizados) }),
      tx.shipment.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      tx.shipment.groupBy({ by: ['modalidad'], where: base, _count: { _all: true } }),
      tx.cotizacion.groupBy({ by: ['moneda'] }),
      tx.shipment.findMany({ where: con({ OR: [atrasados, pendientes] }), take: 20, orderBy: [{ eta: 'asc' }, { id: 'asc' }],
        select: { id: true, folio: true, eta: true, consignee: { select: { razonSocial: true } } } }),
    ]);
    const financiero = await Promise.all(monedas.map(async ({ moneda }) => {
      const r = await tx.shipment.aggregate({ where: con({ ...valorizados, booking: { cotizacion: { moneda } } }),
        _sum: { valorizacionVenta: true, valorizacionCompra: true }, _count: { _all: true } });
      const venta = r._sum.valorizacionVenta ?? new Prisma.Decimal(0);
      const compra = r._sum.valorizacionCompra ?? new Prisma.Decimal(0);
      const margen = venta.minus(compra);
      return { moneda, embarques: r._count._all, venta: venta.toFixed(2), compra: compra.toFixed(2), margen: margen.toFixed(2),
        margenPorcentual: venta.isZero() ? null : margen.dividedBy(venta).times(100).toDecimalPlaces(2).toNumber() };
    }));
    return {
      calculadoEn: ahora.toISOString(), filtros, fechaPeriodo: 'creadoEn', zonaHoraria: 'America/Mexico_City',
      kpis: { total, enCurso, porFacturar, cancelados, proximosArribos, avisosPendientes, arribosAtrasados },
      cobertura: { valorizados: cobertura, elegibles: total - cancelados }, financiero: financiero.filter(r => r.embarques > 0),
      porStatus: porStatus.map(r => ({ status: r.status, cantidad: r._count._all })),
      porModalidad: porModalidad.map(r => ({ modalidad: r.modalidad, cantidad: r._count._all })),
      alertas: alertas.map(s => ({ ...s, tipo: s.eta! < hoy ? 'ATRASADO' : 'AVISO_PENDIENTE' })),
      alertasTotal: arribosAtrasados + avisosPendientes,
    };
  });
}
