import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, ChartNoAxesCombined, Coins, Ship, TriangleAlert, ClipboardCheck } from 'lucide-react';
import { api, mensajeError } from '@/lib/api';
import { dinero, fecha } from '@/lib/format';
import { KpiCard } from './KpiCard';
import { Card } from './Card';
import { Aviso } from './Aviso';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { DataTable } from './DataTable';

interface Resumen {
  calculadoEn: string;
  kpis: { total: number; enCurso: number; porFacturar: number; cancelados: number; proximosArribos: number; avisosPendientes: number; arribosAtrasados: number };
  cobertura: { valorizados: number; elegibles: number };
  financiero: { moneda: string; embarques: number; venta: string; compra: string; margen: string; margenPorcentual: number | null }[];
  porStatus: { status: string; cantidad: number }[];
  porModalidad: { modalidad: string; cantidad: number }[];
  alertas: { id: string; folio: string; eta: string; tipo: string; consignee: { razonSocial: string } }[];
  alertasTotal: number;
}
export function ResumenEmbarques({ filtros, completo = false }: { filtros: Record<string, string>; completo?: boolean }) {
  const navigate = useNavigate();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['dashboard', 'embarques', filtros], queryFn: async () => (await api.get<Resumen>('/dashboard/embarques', { params: filtros })).data });
  if (error) return <Aviso tono="error">{mensajeError(error, 'No se pudo consultar el resumen.')} <Button variante="secondary" onClick={() => refetch()}>Reintentar</Button></Aviso>;
  if (isPending) return <div role="status" className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Calculando indicadores…</div>;
  if (!data) return null;
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard etiqueta="En curso" valor={data.kpis.enCurso} icono={Ship} acento="teal" detalle={`${data.kpis.total} embarques en la selección · ${data.kpis.cancelados} cancelados`} />
      <KpiCard etiqueta="Por facturar" valor={data.kpis.porFacturar} icono={ClipboardCheck} detalle="Embarques cerrados, pendientes de facturación" />
      <KpiCard etiqueta="Avisos pendientes" valor={data.kpis.avisosPendientes} icono={Bell} acento="amber" detalle={`${data.kpis.proximosArribos} arribos previstos de hoy a 10 días`} />
      <KpiCard etiqueta="Arribos atrasados" valor={data.kpis.arribosAtrasados} icono={TriangleAlert} acento={data.kpis.arribosAtrasados ? 'riesgo' : 'navy'} detalle="ETA vencida y sin arribo real registrado" />
    </div>
    {completo && <Card titulo="Margen real por moneda" icono={Coins} descripcion={`${data.cobertura.valorizados} de ${data.cobertura.elegibles} embarques no cancelados tienen valorización confirmada`}>
      {!data.financiero.length ? <p className="text-sm text-slate-500 dark:text-slate-400">Sin valorizaciones confirmadas en esta selección. Los importes pendientes no se consideran cero.</p> : <DataTable keyExtractor={r => r.moneda} filas={data.financiero} columnas={[
        { header: 'Moneda', render: r => r.moneda }, { header: 'Embarques', alinear: 'der', render: r => r.embarques },
        { header: 'Venta real', alinear: 'der', render: r => dinero(r.venta, r.moneda) }, { header: 'Compra real', alinear: 'der', render: r => dinero(r.compra, r.moneda) },
        { header: 'Margen', alinear: 'der', render: r => <span className={Number(r.margen) < 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-teal-700 dark:text-teal-300'}>{dinero(r.margen, r.moneda)}</span> },
        { header: '% sobre venta', alinear: 'der', render: r => r.margenPorcentual == null ? '—' : `${r.margenPorcentual}%` },
      ]} />}
    </Card>}
    {completo && <>
      <div className="grid gap-4 lg:grid-cols-2">
        {[{ titulo: 'Por estado', filas: data.porStatus.map(r => ({ nombre: r.status, cantidad: r.cantidad })) }, { titulo: 'Por modalidad', filas: data.porModalidad.map(r => ({ nombre: r.modalidad, cantidad: r.cantidad })) }].map(grupo => <Card key={grupo.titulo} titulo={grupo.titulo} icono={ChartNoAxesCombined}>
          {!grupo.filas.length && <p className="text-sm text-slate-500">Sin embarques con estos filtros.</p>}
          <ul className="space-y-3">{grupo.filas.map(r => <li key={r.nombre}><div className="mb-1 flex justify-between"><StatusBadge status={r.nombre} /><span className="tabular text-sm font-semibold text-navy-700 dark:text-navy-300">{r.cantidad}</span></div><div className="h-1.5 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"><div className="h-full bg-teal-500" style={{ width: `${data.kpis.total ? r.cantidad / data.kpis.total * 100 : 0}%` }} /></div></li>)}</ul>
        </Card>)}
      </div>
      <Card titulo="Embarques que requieren atención" icono={TriangleAlert} descripcion={`Mostrando ${data.alertas.length} de ${data.alertasTotal} alertas; primero las ETA más antiguas`}>
        <DataTable filas={data.alertas} keyExtractor={r => r.id} vacioMensaje="Sin atrasos ni avisos pendientes con estos filtros" onVer={r => navigate(`/embarques?q=${encodeURIComponent(r.folio)}`)} columnas={[
          { header: 'Folio', render: r => r.folio }, { header: 'Cliente', render: r => r.consignee.razonSocial }, { header: 'ETA', alinear: 'der', render: r => fecha(r.eta) },
          { header: 'Atención', render: r => <span className={r.tipo === 'ATRASADO' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-300'}>{r.tipo === 'ATRASADO' ? 'Arribo atrasado' : 'Enviar aviso de arribo'}</span> },
        ]} />
      </Card>
    </>}
  </div>;
}
