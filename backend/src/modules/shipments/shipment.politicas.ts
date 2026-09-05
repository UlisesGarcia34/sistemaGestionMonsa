import { ReglaDeNegocioError } from '@/shared/middleware/errorHandler';

export const ABIERTOS = ['NUEVO_EMBARQUE', 'BOOKING_CONFIRMED', 'PARA_CERRAR'] as const;
export const EDITABLES = [...ABIERTOS, 'PARA_FACTURAR'] as const;
export function accionesShipment(s: { status: string; facturas?: { tipo: string }[]; _count?: { cuentasPorPagar: number } }) {
  const abierto = (EDITABLES as readonly string[]).includes(s.status);
  const editar = !abierto ? `No se puede editar un embarque en status ${s.status}.` :
    s.facturas?.some(f => f.tipo === 'FINAL') ? 'El embarque ya sostiene una factura final.' : null;
  return {
    editar,
    cerrar: !(ABIERTOS as readonly string[]).includes(s.status) ? `No se puede cerrar un embarque en status ${s.status}.` : s.facturas?.some(f => f.tipo === 'FINAL') ? 'El embarque ya sostiene una factura final.' : null,
    cancelar: !abierto ? `No se puede cancelar un embarque en status ${s.status}.` :
      s.facturas?.length || s._count?.cuentasPorPagar ? 'El embarque tiene facturas o cuentas por pagar; requiere revision de Finanzas.' : null,
  };
}
export function verificarVersion(actual: number, recibida: number) {
  if (actual !== recibida) throw new ReglaDeNegocioError('Otro usuario modifico el embarque. Cierra el formulario y vuelve a abrirlo para cargar los cambios.', 409);
}

// Las fechas operativas del MVP son fechas de calendario (YYYY-MM-DD).
// Prisma las almacena a medianoche UTC; hoy se determina en la zona de negocio.
export function hoyOperativo(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
  const v = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return new Date(`${v('year')}-${v('month')}-${v('day')}T00:00:00Z`);
}
export function calculosOperativos(s: { status: string; eta: Date | null; fechaArriboReal: Date | null; fechaLiberacion: Date | null; notificaciones: { tipo: string }[] }, hoy = hoyOperativo()) {
  const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = (a: Date, b: Date) => (dia(b) - dia(a)) / 86400000;
  const activo = (EDITABLES as readonly string[]).includes(s.status);
  const diasParaEta = s.eta ? diff(hoy, s.eta) : null;
  const proximamente = activo && !s.fechaArriboReal && diasParaEta !== null && diasParaEta >= 0 && diasParaEta <= 10;
  const diasPuerto = s.fechaArriboReal ? diff(s.fechaArriboReal, s.fechaLiberacion ?? hoy) : null;
  return {
    diasParaEta,
    diasEnPuerto: diasPuerto === null || diasPuerto < 0 ? null : diasPuerto,
    atrasado: activo && !s.fechaArriboReal && diasParaEta !== null && diasParaEta < 0,
    proximoArribo: proximamente,
    avisoLlegadaPendiente: proximamente && !s.notificaciones.some(n => n.tipo === 'AVISO_ARRIBO'),
  };
}
