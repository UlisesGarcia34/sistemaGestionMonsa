import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actualizarTrackingSchema } from '../src/modules/shipments/shipment.schema';
import { actualizarShipmentSchema, paginaShipmentSchema, filtrosShipmentSchema, cancelarShipmentSchema } from '../src/modules/shipments/shipment.schema';
import { accionesShipment, calculosOperativos, hoyOperativo } from '../src/modules/shipments/shipment.politicas';

test('tracking rechaza cambios de estado operativo', () => {
  assert.equal(actualizarTrackingSchema.safeParse({ version: 0, status: 'FACTURADO' }).success, false);
});

test('fechas vaciadas son null, nunca epoch; montos y bultos negativos se rechazan', () => {
  assert.equal(actualizarShipmentSchema.parse({ version: 0, eta: null }).eta, null);
  assert.equal(actualizarShipmentSchema.parse({ version: 0, eta: '' }).eta, null);
  for (const campo of ['cbm', 'grossWeight', 'totalItems']) assert.equal(actualizarShipmentSchema.safeParse({ version: 0, [campo]: -1 }).success, false);
});
test('consulta limita tamaño, orden y valida fechas reales e intervalos', () => {
  for (const p of [{ page: 0 }, { pageSize: 101 }, { pageSize: -1 }, { sort: 'passwordHash' }]) assert.equal(paginaShipmentSchema.safeParse(p).success, false);
  for (const p of [{ desde: '2026-02-30' }, { desde: '2026-09-05', hasta: '2026-09-01' }]) assert.equal(filtrosShipmentSchema.safeParse(p).success, false);
  assert.equal(paginaShipmentSchema.parse({}).pageSize, 20);
});
test('cancelación exige motivo y versión, estados terminales bloquean edición y cierre', () => {
  assert.equal(cancelarShipmentSchema.safeParse({ version: 0, motivo: '  ' }).success, false);
  assert.equal(cancelarShipmentSchema.safeParse({ motivo: 'Cancelado por cliente' }).success, false);
  for (const status of ['FACTURADO', 'CANCELADO', 'TERMINADO']) {
    const a = accionesShipment({ status });
    assert.ok(a.editar); assert.ok(a.cerrar); assert.ok(a.cancelar);
  }
});
test('alertas usan días de calendario: hoy y +10 incluidos, vencidos separados y null seguro', () => {
  const hoy = new Date('2026-09-05T00:00:00Z');
  const base = { status: 'NUEVO_EMBARQUE', fechaArriboReal: null, fechaLiberacion: null, notificaciones: [] };
  for (const [fecha, aviso, atrasado] of [['2026-09-04', false, true], ['2026-09-05', true, false], ['2026-09-15', true, false], ['2026-09-16', false, false]] as const) {
    const r = calculosOperativos({ ...base, eta: new Date(`${fecha}T00:00:00Z`) }, hoy);
    assert.equal(r.avisoLlegadaPendiente, aviso); assert.equal(r.atrasado, atrasado);
  }
  assert.equal(calculosOperativos({ ...base, eta: hoy, notificaciones: [{ tipo: 'AVISO_ARRIBO' }] }, hoy).avisoLlegadaPendiente, false);
  assert.equal(calculosOperativos({ ...base, status: 'CANCELADO', eta: hoy }, hoy).proximoArribo, false);
  assert.equal(calculosOperativos({ ...base, eta: null }, hoy).diasEnPuerto, null);
  assert.equal(hoyOperativo(new Date('2026-09-05T05:59:00Z')).toISOString(), '2026-09-04T00:00:00.000Z');
});
