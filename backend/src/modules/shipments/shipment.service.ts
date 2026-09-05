import { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { ReglaDeNegocioError } from '@/shared/middleware/errorHandler';
import { limpiarEntrada } from '@/shared/limpiarEntrada';
import { transaccion } from '@/shared/transaccion';
import { SELECT_USUARIO_PUBLICO } from '@/modules/usuarios/usuario.service';
import { ActualizarDocumentoInput, ActualizarShipmentInput, ActualizarTrackingInput, ConfirmarValorizacionInput, CrearShipmentInput, FiltrosShipment } from './shipment.schema';
import { accionesShipment, verificarVersion } from './shipment.politicas';

const INCLUDE_SHIPMENT = {
  consignee: true, customerService: { select: SELECT_USUARIO_PUBLICO }, documento: true, contenedores: true,
  booking: { include: { proveedor: true, cotizacion: true } },
  facturas: { select: { id: true, tipo: true, numeroFactura: true, estatus: true } },
  _count: { select: { cuentasPorPagar: true } },
  notificaciones: { include: { enviadoPor: { select: SELECT_USUARIO_PUBLICO } }, orderBy: { fechaEnviada: 'desc' } as const },
};
const conAcciones = <T extends Parameters<typeof accionesShipment>[0]>(s: T) => ({ ...s, acciones: accionesShipment(s) });
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));
async function auditar(tx: Prisma.TransactionClient, shipmentId: string, accion: string, autorId: string | undefined, antes: unknown, despues: unknown) {
  await tx.auditoriaShipment.create({ data: { shipmentId, accion, autorId, antes: antes == null ? Prisma.DbNull : json(antes), despues: json(despues) } });
}
async function siguienteFolio(tx: Prisma.TransactionClient) {
  const serie = `MGC${new Date().getFullYear().toString().slice(-2)}`;
  const incremento = await tx.consecutivoShipment.updateMany({ where: { serie }, data: { ultimo: { increment: 1 } } });
  if (!incremento.count) {
    const max = await tx.shipment.findFirst({ where: { folio: { startsWith: serie } }, orderBy: { folio: 'desc' }, select: { folio: true } });
    await tx.consecutivoShipment.create({ data: { serie, ultimo: max ? Number(max.folio.slice(serie.length)) + 1 : 1 } });
  }
  const n = await tx.consecutivoShipment.findUniqueOrThrow({ where: { serie } });
  if (n.ultimo > 999999) throw new ReglaDeNegocioError('Se agoto la serie anual de embarques.');
  return `${serie}${String(n.ultimo).padStart(6, '0')}`;
}
export async function crearShipment(data: CrearShipmentInput, autorId?: string) {
  return transaccion(async tx => {
    const b = await tx.booking.findUnique({ where: { id: data.bookingId }, include: { shipment: true, cotizacion: true } });
    if (!b) throw new ReglaDeNegocioError('Booking no encontrado', 404);
    if (b.status !== 'CONFIRMADO') throw new ReglaDeNegocioError('No se puede crear el embarque: el booking debe estar CONFIRMADO');
    if (b.shipment) throw new ReglaDeNegocioError('Este booking ya tiene un embarque asociado');
    if (data.consigneeId !== b.cotizacion.clienteId) throw new ReglaDeNegocioError('El consignee debe coincidir con el cliente de la cotizacion.');
    const s = await tx.shipment.create({ data: { ...data, folio: await siguienteFolio(tx), status: 'NUEVO_EMBARQUE' } });
    await auditar(tx, s.id, 'CREAR', autorId, null, s);
    return s;
  });
}
async function modificar(id: string, version: number, accion: 'EDITAR' | 'TRACKING' | 'DOCUMENTO' | 'VALORIZAR' | 'CERRAR' | 'CANCELAR', datos: Record<string, unknown>, autorId?: string) {
  return transaccion(async tx => {
    const s = await tx.shipment.findUnique({ where: { id }, include: INCLUDE_SHIPMENT });
    if (!s) throw new ReglaDeNegocioError('Embarque no encontrado', 404);
    verificarVersion(s.version, version);
    const bloqueos = accionesShipment(s);
    const bloqueo = accion === 'CERRAR' ? bloqueos.cerrar : accion === 'CANCELAR' ? bloqueos.cancelar : bloqueos.editar;
    if (bloqueo) throw new ReglaDeNegocioError(bloqueo);
    if (datos.consigneeId && datos.consigneeId !== s.booking.cotizacion.clienteId) throw new ReglaDeNegocioError('El consignee debe coincidir con el cliente de la cotizacion.');
    const limpio = limpiarEntrada(datos);
    if (accion !== 'DOCUMENTO') {
      const combinado = { ...s, ...limpio };
      const arribo = combinado.fechaArriboReal as Date | null;
      const liberacion = combinado.fechaLiberacion as Date | null;
      if (arribo && liberacion && liberacion < arribo) throw new ReglaDeNegocioError('La liberacion no puede ser anterior al arribo real.');
    }
    const cambio = await tx.shipment.updateMany({ where: { id, version, status: s.status },
      data: { ...(accion === 'DOCUMENTO' ? {} : limpio), version: { increment: 1 } } as Prisma.ShipmentUpdateManyMutationInput });
    if (!cambio.count) throw new ReglaDeNegocioError('Otro usuario modifico el embarque. Vuelve a cargarlo.');
    if (accion === 'DOCUMENTO') await tx.documento.upsert({ where: { shipmentId: id }, create: { shipmentId: id, ...limpio }, update: limpio });
    const actualizado = await tx.shipment.findUniqueOrThrow({ where: { id }, include: INCLUDE_SHIPMENT });
    const claves = Object.keys(limpio);
    const origen = accion === 'DOCUMENTO' ? s.documento : s;
    const destino = accion === 'DOCUMENTO' ? actualizado.documento : actualizado;
    const seleccionar = (o: unknown) => Object.fromEntries(claves.map(k => [k, (o as Record<string, unknown> | null)?.[k] ?? null]));
    await auditar(tx, id, accion, autorId, seleccionar(origen), seleccionar(destino));
    return { shipment: conAcciones(actualizado), divergenciaMargen: calcularDivergencia(s) };
  });
}
export async function actualizarShipment(id: string, { version, ...data }: ActualizarShipmentInput, autorId?: string) {
  return (await modificar(id, version, 'EDITAR', data, autorId)).shipment;
}
export async function actualizarTracking(id: string, { version, ...data }: ActualizarTrackingInput, autorId?: string) {
  return (await modificar(id, version, 'TRACKING', data, autorId)).shipment;
}
export async function actualizarDocumento(id: string, { version, ...data }: ActualizarDocumentoInput, autorId?: string) {
  return (await modificar(id, version, 'DOCUMENTO', data, autorId)).shipment.documento;
}
export async function confirmarValorizacion(id: string, { version, ...data }: ConfirmarValorizacionInput, autorId?: string) {
  return (await modificar(id, version, 'VALORIZAR', { ...data, valorizacionConfirmada: true, valorizacionConfirmadaEn: new Date() }, autorId)).shipment;
}
export async function cerrarShipment(id: string, version: number, autorId?: string) {
  return modificar(id, version, 'CERRAR', { status: 'PARA_FACTURAR' }, autorId);
}
export async function cancelarShipment(id: string, data: { version: number; motivo: string }, autorId?: string) {
  return (await modificar(id, data.version, 'CANCELAR', { status: 'CANCELADO', motivoCancelacion: data.motivo, canceladoEn: new Date(), canceladoPorId: autorId }, autorId)).shipment;
}
function calcularDivergencia(s: { valorizacionConfirmada: boolean; valorizacionVenta: unknown; valorizacionCompra: unknown; booking: { cotizacion: { montoVenta: unknown; montoCompra: unknown; moneda: string } } }) {
  const estimado = Number(s.booking.cotizacion.montoVenta) - Number(s.booking.cotizacion.montoCompra);
  const moneda = s.booking.cotizacion.moneda;
  if (!s.valorizacionConfirmada || s.valorizacionVenta == null || s.valorizacionCompra == null) return { estimado, valorizado: null, delta: null, alerta: false, moneda };
  const valorizado = Number(s.valorizacionVenta) - Number(s.valorizacionCompra);
  const delta = valorizado - estimado;
  return { estimado, valorizado, delta, alerta: Math.abs(delta) > Math.max(.1 * Math.abs(estimado), 50), moneda };
}
export function whereShipments(p: FiltrosShipment): Prisma.ShipmentWhereInput {
  // Periodo de alta técnica; offset de Mexico City para el periodo operativo 2026.
  const rango = p.desde || p.hasta ? { gte: p.desde ? new Date(`${p.desde}T00:00:00-06:00`) : undefined,
    lt: p.hasta ? new Date(new Date(`${p.hasta}T00:00:00-06:00`).getTime() + 86400000) : undefined } : undefined;
  return { status: p.status, tipoOperacion: p.tipoOperacion, modalidad: p.modalidad, consigneeId: p.clienteId,
    customerServiceId: p.customerServiceId, creadoEn: rango,
    ...(p.q ? { OR: [ { folio: { contains: p.q } }, { shipperNombre: { contains: p.q } },
      { consignee: { razonSocial: { contains: p.q } } }, { booking: { referencia: { contains: p.q } } },
      { documento: { OR: [{ mbl: { contains: p.q } }, { hbl: { contains: p.q } }] } },
      { contenedores: { some: { numero: { contains: p.q } } } }, { facturas: { some: { numeroFactura: { contains: p.q } } } },
    ] } : {}) };
}
// Compatibilidad con selectores existentes; la pantalla usa /pagina.
export async function listarShipments(status?: string) {
  return (await prisma.shipment.findMany({ where: status ? { status: status as never } : undefined, include: INCLUDE_SHIPMENT, orderBy: { creadoEn: 'desc' } })).map(conAcciones);
}
export async function paginaShipments(filtros: FiltrosShipment, p: { page: number; pageSize: number; sort: string; order: 'asc' | 'desc' }) {
  return transaccion(async tx => {
    const where = whereShipments(filtros);
    const total = await tx.shipment.count({ where });
    const items = await tx.shipment.findMany({ where, skip: (p.page - 1) * p.pageSize, take: p.pageSize,
      orderBy: [{ [p.sort]: p.order }, { id: 'asc' }], select: {
        id: true, folio: true, version: true, status: true, tipoOperacion: true, modalidad: true, shipperNombre: true,
        eta: true, estatusMaterial: true, valorizacionConfirmada: true,
        consignee: { select: { id: true, razonSocial: true } }, customerService: { select: SELECT_USUARIO_PUBLICO },
        documento: { select: { mbl: true, hbl: true } }, facturas: { select: { tipo: true } }, _count: { select: { cuentasPorPagar: true } },
      } });
    return { items: items.map(conAcciones), total, page: p.page, pageSize: p.pageSize, pages: Math.ceil(total / p.pageSize) };
  });
}
export async function obtenerShipment(id: string) {
  const s = await prisma.shipment.findUnique({ where: { id }, include: { ...INCLUDE_SHIPMENT, costosDemoras: true, auditoria: { orderBy: { creadoEn: 'desc' }, take: 50 } } });
  if (!s) throw new ReglaDeNegocioError('Embarque no encontrado', 404);
  const autores = await prisma.usuario.findMany({ where: { id: { in: s.auditoria.flatMap(a => a.autorId ? [a.autorId] : []) } }, select: { id: true, nombre: true } });
  const nombres = new Map(autores.map(u => [u.id, u.nombre]));
  return conAcciones({ ...s, auditoria: s.auditoria.map(a => ({ ...a, autorNombre: a.autorId ? nombres.get(a.autorId) ?? 'Usuario no disponible' : 'Sistema' })) });
}
