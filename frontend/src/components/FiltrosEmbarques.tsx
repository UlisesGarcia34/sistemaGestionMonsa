import { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams } from 'react-router-dom';
import { Search, RotateCcw } from 'lucide-react';
import { Field, Select, TextInput } from './Field';
import { Button } from './Button';

const campos = ['q', 'status', 'tipoOperacion', 'modalidad', 'clienteId', 'customerServiceId', 'desde', 'hasta'];
export function useFiltrosEmbarques() {
  const [params, setParams] = useSearchParams();
  const filtros = Object.fromEntries(campos.filter(k => params.get(k)).map(k => [k, params.get(k)!]));
  return { params, setParams, filtros };
}
export function FiltrosEmbarques() {
  const { params, setParams } = useFiltrosEmbarques();
  const { data: clientes } = useQuery({ queryKey: ['clientes'], queryFn: async () => (await api.get<{ id: string; razonSocial: string }[]>('/clientes')).data });
  const { data: responsables } = useQuery({ queryKey: ['usuarios'], queryFn: async () => (await api.get<{ id: string; nombre: string }[]>('/usuarios')).data });
  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const siguientes = new URLSearchParams(params);
    campos.forEach(k => {
      if (!datos.has(k)) return;
      const valor = String(datos.get(k) ?? '').trim();
      if (valor) siguientes.set(k, valor); else siguientes.delete(k);
    });
    siguientes.set('page', '1');
    setParams(siguientes);
  }
  return <form key={params.toString()} onSubmit={aplicar} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta dark:border-slate-800 dark:bg-slate-900">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Buscar embarque" className="sm:col-span-2"><TextInput name="q" defaultValue={params.get('q') ?? ''} maxLength={100} placeholder="Folio, cliente, SO, MBL, HBL, contenedor o factura" /></Field>
      <Field label="Estado"><Select name="status" defaultValue={params.get('status') ?? ''}><option value="">Todos los estados</option>{['NUEVO_EMBARQUE', 'BOOKING_CONFIRMED', 'PARA_CERRAR', 'PARA_FACTURAR', 'FACTURADO', 'CANCELADO', 'TERMINADO'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</Select></Field>
      <Field label="Modalidad"><Select name="modalidad" defaultValue={params.get('modalidad') ?? ''}><option value="">Todas las modalidades</option>{['FCL', 'LCL', 'AEREO', 'TERRESTRE', 'FTL', 'LTL', 'SEGURO'].map(s => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="Operación"><Select name="tipoOperacion" defaultValue={params.get('tipoOperacion') ?? ''}><option value="">Todas las operaciones</option>{['IMPORTACION', 'EXPORTACION', 'TERRESTRE'].map(s => <option key={s}>{s}</option>)}</Select></Field>
      <Field label="Cliente"><Select name="clienteId" defaultValue={params.get('clienteId') ?? ''}><option value="">Todos los clientes</option>{clientes?.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}</Select></Field>
      <Field label="Responsable"><Select name="customerServiceId" defaultValue={params.get('customerServiceId') ?? ''}><option value="">Todos los responsables</option>{responsables?.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Field>
      <Field label="Alta desde"><TextInput name="desde" type="date" defaultValue={params.get('desde') ?? ''} /></Field>
      <Field label="Alta hasta"><TextInput name="hasta" type="date" defaultValue={params.get('hasta') ?? ''} /></Field>
      <div className="flex items-end gap-2"><Button type="submit" icono={Search}>Aplicar</Button><Button variante="secondary" icono={RotateCcw} onClick={() => setParams({})}>Limpiar</Button></div>
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">El periodo filtra la fecha de alta del embarque. Las alertas reflejan su situación actual.</p>
  </form>;
}
