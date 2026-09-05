import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { prisma } from '../src/config/prisma';
import { app } from '../src/app';
import { firmarToken } from '../src/shared/middleware/auth';
import { crearShipment } from '../src/modules/shipments/shipment.service';
import { hoyOperativo } from '../src/modules/shipments/shipment.politicas';

const db = new URL(process.env.DATABASE_URL!).pathname.slice(1);
if (!/^mgc_test_\d+_\d+$/.test(db) || db !== process.env.MGC_TEST_DB) throw new Error('Ejecutar mediante npm run test:integration; se exige una base efimera.');
let server: Server, base: string, admin: string, ventas: string, operaciones: string;
let clienteId: string, proveedorId: string, vendedorId: string;
async function api(method: string, path: string, body?: unknown, token: string | null = admin) {
  const r = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
}
async function booking(moneda = 'USD', status: 'CONFIRMADO' | 'SOLICITADO' = 'CONFIRMADO') {
  const c = await prisma.cotizacion.create({ data: { folio: `TEST-${randomUUID()}`, clienteId, vendedorId, incoterm: 'FOB', modalidad: 'FCL', origen: 'Shanghai', destino: 'Manzanillo', montoVenta: 200, montoCompra: 100, moneda, status: 'ACEPTADA' } });
  return prisma.booking.create({ data: { cotizacionId: c.id, proveedorId, status } });
}
async function embarque(moneda = 'USD') {
  const b = await booking(moneda);
  return crearShipment({ bookingId: b.id, consigneeId: clienteId, tipoOperacion: 'IMPORTACION', modalidad: 'FCL', shipperNombre: 'Prueba' }, vendedorId);
}
before(async () => {
  const u = await prisma.usuario.create({ data: { nombre: 'Pruebas MVP', email: 'mvp@test.invalid', rol: 'ADMIN' } });
  vendedorId = u.id;
  const payload = { sub: u.id, email: u.email, nombre: u.nombre };
  admin = firmarToken({ ...payload, rol: 'ADMIN' }); ventas = firmarToken({ ...payload, rol: 'VENTAS' }); operaciones = firmarToken({ ...payload, rol: 'OPERACIONES' });
  clienteId = (await prisma.cliente.create({ data: { razonSocial: 'Cliente MVP', estatus: 'ACTIVO', requiereRoutingOrder: false } })).id;
  proveedorId = (await prisma.proveedor.create({ data: { nombre: 'Naviera MVP', tipo: 'NAVIERA', estatus: 'ACTIVO' } })).id;
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); await prisma.$disconnect(); });

test('API: autenticación, gate 5 y tracking no permite saltar estados', async () => {
  assert.equal((await api('GET', '/shipments/pagina', undefined, null)).status, 401);
  const b = await booking('USD', 'SOLICITADO');
  assert.equal((await api('POST', '/shipments', { bookingId: b.id, consigneeId: clienteId, tipoOperacion: 'IMPORTACION', modalidad: 'FCL', shipperNombre: 'Prueba' })).status, 409);
  const s = await embarque();
  assert.equal((await api('PATCH', `/shipments/${s.id}/tracking`, { version: 0, status: 'FACTURADO' })).status, 400);
  assert.equal((await prisma.shipment.findUniqueOrThrow({ where: { id: s.id } })).status, 'NUEVO_EMBARQUE');
});
test('gate 1: un prospecto no puede recibir cotización en firme', async () => {
  const prospecto = await prisma.cliente.create({ data: { razonSocial: 'Prospecto test' } });
  const r = await api('POST', '/cotizaciones', { clienteId: prospecto.id, vendedorId, modalidad: 'FCL', incoterm: 'FOB', origen: 'A', destino: 'B', montoVenta: 20, montoCompra: 10 });
  assert.equal(r.status, 409);
});
test('gates 2, 3 y 4: aceptación, routing recibido y proveedor activo', async () => {
  const b = await booking();
  await prisma.booking.delete({ where: { id: b.id } });
  const body = { cotizacionId: b.cotizacionId, proveedorId };
  await prisma.cotizacion.update({ where: { id: b.cotizacionId }, data: { status: 'BORRADOR' } });
  assert.match((await api('POST', '/bookings', body)).body.error, /ACEPTADA/);
  await prisma.cotizacion.update({ where: { id: b.cotizacionId }, data: { status: 'ACEPTADA' } });
  await prisma.cliente.update({ where: { id: clienteId }, data: { requiereRoutingOrder: true } });
  assert.match((await api('POST', '/bookings', body)).body.error, /Routing Order/);
  await prisma.routingOrder.create({ data: { cotizacionId: b.cotizacionId, status: 'RECIBIDO' } });
  await prisma.proveedor.update({ where: { id: proveedorId }, data: { estatus: 'SUSPENDIDO' } });
  assert.equal((await api('POST', '/bookings', body)).status, 409);
  await prisma.proveedor.update({ where: { id: proveedorId }, data: { estatus: 'ACTIVO' } });
  assert.equal((await api('POST', '/bookings', body)).status, 201);
  await prisma.cliente.update({ where: { id: clienteId }, data: { requiereRoutingOrder: false } });
});
test('gates 6 y 7, roles, factura final congela edición del expediente', async () => {
  const s = await embarque();
  const factura = { shipmentId: s.id, tipo: 'FINAL', montoSinIva: 200 };
  assert.match((await api('POST', '/facturas', factura)).body.error, /valorizacion/);
  assert.equal((await api('PATCH', `/shipments/${s.id}/valorizacion`, { version: 0, valorizacionVenta: 200, valorizacionCompra: 100 }, operaciones)).status, 403);
  assert.equal((await api('PATCH', `/shipments/${s.id}/valorizacion`, { version: 0, valorizacionVenta: 200, valorizacionCompra: 100 }, ventas)).status, 200);
  assert.match((await api('POST', '/facturas', factura)).body.error, /cerrado/);
  assert.equal((await api('PATCH', `/shipments/${s.id}/cerrar`, { version: 1 })).status, 200);
  assert.equal((await api('POST', '/facturas', factura)).status, 201);
  assert.equal((await api('PATCH', `/shipments/${s.id}/documento`, { version: 2, mbl: 'CAMBIO' })).status, 409);
});
test('altas simultáneas: folios únicos; mismo booking no duplica expediente', async () => {
  const bs = await Promise.all([booking(), booking(), booking()]);
  const resultados = await Promise.all(bs.map(b => crearShipment({ bookingId: b.id, consigneeId: clienteId, tipoOperacion: 'IMPORTACION', modalidad: 'FCL', shipperNombre: 'Concurrencia' })));
  assert.equal(new Set(resultados.map(s => s.folio)).size, 3);
  const b = await booking();
  const body = { bookingId: b.id, consigneeId: clienteId, tipoOperacion: 'IMPORTACION', modalidad: 'FCL', shipperNombre: 'Duplicado' };
  const r = await Promise.all([api('POST', '/shipments', body), api('POST', '/shipments', body)]);
  assert.deepEqual(r.map(x => x.status).sort(), [201, 409]);
});
test('dos ediciones de la misma versión: una gana, la otra recibe 409; auditoría atómica', async () => {
  const s = await embarque();
  const r = await Promise.all(['A', 'B'].map(shipperNombre => api('PATCH', `/shipments/${s.id}`, { version: 0, shipperNombre })));
  assert.deepEqual(r.map(x => x.status).sort(), [200, 409]);
  const actual = await prisma.shipment.findUniqueOrThrow({ where: { id: s.id }, include: { auditoria: true } });
  assert.equal(actual.version, 1); assert.equal(actual.auditoria.length, 2);
  assert.equal((await api('PATCH', `/shipments/${s.id}/tracking`, { version: 1, fechaArriboReal: '2026-09-05', fechaLiberacion: '2026-09-01' })).status, 409);
  assert.equal(await prisma.auditoriaShipment.count({ where: { shipmentId: s.id } }), 2);
});
test('cancelación exige admin y motivo; conserva evidencia y bloquea cierre/tracking/documentos', async () => {
  const s = await embarque();
  const payload = { version: 0, motivo: 'Solicitud del cliente' };
  assert.equal((await api('PATCH', `/shipments/${s.id}/cancelar`, payload, ventas)).status, 403);
  assert.equal((await api('PATCH', `/shipments/${s.id}/cancelar`, { version: 0, motivo: ' ' })).status, 400);
  const cancelado = await api('PATCH', `/shipments/${s.id}/cancelar`, payload);
  assert.equal(cancelado.status, 200); assert.equal(cancelado.body.status, 'CANCELADO');
  assert.equal(cancelado.body.motivoCancelacion, payload.motivo); assert.equal(cancelado.body.canceladoPorId, vendedorId);
  for (const ruta of ['cerrar', 'tracking', 'documento']) assert.equal((await api('PATCH', `/shipments/${s.id}/${ruta}`, { version: 1 })).status, 409);
  assert.equal((await api('PATCH', `/shipments/${s.id}/cancelar`, payload)).status, 409);
  assert.equal(await prisma.auditoriaShipment.count({ where: { shipmentId: s.id, accion: 'CANCELAR' } }), 1);
});
test('cancelación bloqueada por CxP y cierre no retrocede FACTURADO/TERMINADO', async () => {
  const s = await embarque();
  await prisma.cuentaPorPagar.create({ data: { shipmentId: s.id, proveedorId, monto: 10 } });
  assert.equal((await api('PATCH', `/shipments/${s.id}/cancelar`, { version: 0, motivo: 'Solicitud del cliente' })).status, 409);
  for (const status of ['FACTURADO', 'TERMINADO'] as const) {
    await prisma.shipment.update({ where: { id: s.id }, data: { status } });
    assert.equal((await api('PATCH', `/shipments/${s.id}/cerrar`, { version: 0 })).status, 409);
  }
});
test('paginación estable, filtros combinados y búsquedas sobre relaciones sin duplicados', async () => {
  const s = await embarque();
  await prisma.contenedor.createMany({ data: [{ shipmentId: s.id, numero: 'BUSQUEDA-UNO' }, { shipmentId: s.id, numero: 'BUSQUEDA-DOS' }] });
  const r = await api('GET', '/shipments/pagina?q=BUSQUEDA&modalidad=FCL&pageSize=1');
  assert.equal(r.status, 200); assert.equal(r.body.total, 1); assert.equal(r.body.items[0].id, s.id);
  assert.equal(r.body.items[0].contenedores, undefined);
  assert.equal((await api('GET', '/shipments/pagina?q=BUSQUEDA&modalidad=LCL')).body.total, 0);
  assert.equal((await api('GET', '/shipments/pagina?pageSize=101')).status, 400);
  assert.equal((await api('GET', '/shipments/pagina?sort=passwordHash')).status, 400);
  assert.equal((await api('GET', '/shipments/pagina?desde=2026-02-30')).status, 400);
  const primero = (await api('GET', '/shipments/pagina?pageSize=1&page=1')).body.items[0].id;
  assert.notEqual((await api('GET', '/shipments/pagina?pageSize=1&page=2')).body.items[0].id, primero);
});
test('KPI: valorización real, monedas separadas, pérdida, ceros, cobertura y cancelados excluidos', async () => {
  const grupo = await prisma.cliente.create({ data: { razonSocial: 'KPI aislado', estatus: 'ACTIVO', requiereRoutingOrder: false } });
  const filas = await Promise.all([embarque('USD'), embarque('MXN'), embarque('USD'), embarque('USD'), embarque('EUR')]);
  for (const [i, s] of filas.entries()) await prisma.shipment.update({ where: { id: s.id }, data: { consigneeId: grupo.id, valorizacionConfirmada: i !== 2,
    valorizacionVenta: i === 4 ? 0 : i === 1 ? 1000 : 100, valorizacionCompra: i === 4 ? 0 : i === 1 ? 600 : 120, status: i === 3 ? 'CANCELADO' : 'NUEVO_EMBARQUE' } });
  const r = await api('GET', `/dashboard/embarques?clienteId=${grupo.id}`);
  assert.equal(r.status, 200); assert.deepEqual(r.body.cobertura, { valorizados: 3, elegibles: 4 });
  assert.equal(r.body.financiero.find((x: any) => x.moneda === 'USD').margen, '-20.00');
  assert.equal(r.body.financiero.find((x: any) => x.moneda === 'MXN').margen, '400.00');
  assert.equal(r.body.financiero.find((x: any) => x.moneda === 'EUR').margenPorcentual, null);
});
test('Dashboard y Operaciones concuerdan en avisos: hoy/+10 incluidos y vencidos separados', async () => {
  const hoy = hoyOperativo();
  const ids: string[] = [];
  for (const dias of [-1, 0, 10, 11]) {
    const s = await embarque(); ids.push(s.id);
    await prisma.shipment.update({ where: { id: s.id }, data: { eta: new Date(hoy.getTime() + dias * 86400000) } });
  }
  await prisma.notificacionEnviada.create({ data: { shipmentId: ids[1], tipo: 'AVISO_ARRIBO' } });
  const resumen = (await api('GET', '/dashboard/embarques')).body;
  const tablero = (await api('GET', '/operaciones')).body;
  assert.equal(resumen.kpis.avisosPendientes, tablero.filter((s: any) => s.avisoLlegadaPendiente).length);
  assert.equal(resumen.kpis.arribosAtrasados, tablero.filter((s: any) => s.atrasado).length);
  assert.equal(tablero.find((s: any) => s.id === ids[2]).avisoLlegadaPendiente, true);
  const anteriores = (await api('GET', '/dashboard/avisos-arribo-pendientes')).body;
  assert.equal(anteriores.length, resumen.kpis.avisosPendientes);
});

test('cancelación concurrente con CxP o factura: nunca deja relaciones financieras nuevas en CANCELADO', async () => {
  for (const recurso of ['cxp', 'factura']) {
    const s = await embarque();
    await prisma.shipment.update({ where: { id: s.id }, data: { valorizacionConfirmada: true, valorizacionVenta: 100, valorizacionCompra: 50 } });
    const resultados = await Promise.all([
      api('PATCH', `/shipments/${s.id}/cancelar`, { version: 0, motivo: 'Cancelacion simultanea' }),
      recurso === 'cxp' ? api('POST', '/cuentas-por-pagar', { shipmentId: s.id, proveedorId, monto: 10 }) : api('POST', '/facturas', { shipmentId: s.id, tipo: 'PROFORMA', montoSinIva: 100 }),
    ]);
    assert.equal(resultados.filter(r => r.status === 409).length, 1);
    assert.equal(resultados.filter(r => r.status === 200 || r.status === 201).length, 1);
    const actual = await prisma.shipment.findUniqueOrThrow({ where: { id: s.id }, include: { cuentasPorPagar: true, facturas: true } });
    assert.ok(actual.status !== 'CANCELADO' || actual.cuentasPorPagar.length + actual.facturas.length === 0);
  }
});

test('endpoints anteriores no mezclan monedas ni muestran cotización como margen real', async () => {
  const r = (await api('GET', '/dashboard/rentabilidad')).body;
  assert.ok(r.every((s: any) => s.status !== 'CANCELADO'));
  const k = (await api('GET', '/dashboard/kpis')).body;
  assert.ok(k.porMoneda.length >= 2);
  assert.equal(k.margenTotal, null); assert.equal(k.moneda, null);
});
