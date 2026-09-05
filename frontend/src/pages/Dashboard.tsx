import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  LayoutDashboard,
  Scale,
  Ship,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { dinero, dineroCompacto, fecha } from "@/lib/format";

interface Kpis {
  clientesActivos: number;
  prospectos: number;
  cotizacionesAbiertas: number;
  bookingsPorConfirmar: number;
  embarquesEnCurso: number;
  embarquesPorFacturar: number;
  margenTotal: number;
  embarquesConPerdida: number;
  porPagar: number;
  porCobrar: number;
}

interface Rentabilidad {
  folio: string;
  consignee: string;
  modalidad: string;
  status: string;
  moneda: string;
  venta: number;
  compra: number;
  margen: number;
}

interface ResumenStatus {
  status: string;
  cantidad: number;
}

interface ResumenVendedor {
  vendedor: string;
  cotizaciones: number;
  ventaTotal: number | null;
}

interface CobroPorVencer {
  id: string;
  monto: string | number;
  moneda: string;
  fechaVencimiento?: string;
  cliente: { razonSocial: string };
  factura: { numeroFactura: string };
}

interface PagoPorVencer {
  id: string;
  monto: string | number;
  moneda: string;
  fechaLimitePago?: string;
  proveedor: { nombre: string };
  shipment?: { folio: string } | null;
}

// Barra proporcional de una fila de resumen. Da una lectura relativa que un
// numero suelto no da, sin meter una libreria de graficas para dos listas.
function BarraProporcion({ valor, maximo, tono }: { valor: number; maximo: number; tono: string }) {
  const ancho = maximo > 0 ? Math.max((valor / maximo) * 100, 3) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tono}`} style={{ width: `${ancho}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { data: kpis } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => (await api.get<Kpis>("/dashboard/kpis")).data,
  });
  const { data: rentabilidad, isLoading: cargandoRent } = useQuery({
    queryKey: ["dashboard", "rentabilidad"],
    queryFn: async () => (await api.get<Rentabilidad[]>("/dashboard/rentabilidad")).data,
  });
  const { data: porStatus } = useQuery({
    queryKey: ["dashboard", "por-status"],
    queryFn: async () => (await api.get<ResumenStatus[]>("/dashboard/por-status")).data,
  });
  const { data: porVendedor } = useQuery({
    queryKey: ["dashboard", "por-vendedor"],
    queryFn: async () => (await api.get<ResumenVendedor[]>("/dashboard/por-vendedor")).data,
  });
  const { data: cobros } = useQuery({
    queryKey: ["dashboard", "cobros-por-vencer"],
    queryFn: async () =>
      (await api.get<CobroPorVencer[]>("/dashboard/cobros-por-vencer?dias=45")).data,
  });
  const { data: pagos } = useQuery({
    queryKey: ["dashboard", "pagos-por-vencer"],
    queryFn: async () =>
      (await api.get<PagoPorVencer[]>("/dashboard/pagos-por-vencer?dias=45")).data,
  });

  const posicionNeta = (kpis?.porCobrar ?? 0) - (kpis?.porPagar ?? 0);
  const margenNegativo = (kpis?.margenTotal ?? 0) < 0;
  const maxStatus = Math.max(...(porStatus?.map((s) => s.cantidad) ?? [0]), 1);
  const maxVendedor = Math.max(...(porVendedor?.map((v) => Number(v.ventaTotal ?? 0)) ?? [0]), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dashboard operativo"
        icono={LayoutDashboard}
        descripcion="Estado de la cascada y pulso financiero, calculado con agregaciones reales sobre la base de datos — no formulas de texto como en la hoja REP_AUT del Excel."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          etiqueta="Clientes activos"
          valor={kpis?.clientesActivos ?? "—"}
          icono={Users}
          acento="navy"
          detalle={
            <>
              <strong className="font-semibold text-slate-700">{kpis?.prospectos ?? 0}</strong>{" "}
              prospectos en pipeline, aun sin KYC completo
            </>
          }
        />
        <KpiCard
          etiqueta="Embarques en curso"
          valor={kpis?.embarquesEnCurso ?? "—"}
          icono={Ship}
          acento="teal"
          detalle={
            <>
              <strong className="font-semibold text-slate-700">
                {kpis?.embarquesPorFacturar ?? 0}
              </strong>{" "}
              cerrados y listos para facturar
            </>
          }
        />
        <KpiCard
          etiqueta="Margen acumulado"
          valor={dineroCompacto(kpis?.margenTotal ?? 0)}
          icono={margenNegativo ? TrendingDown : TrendingUp}
          acento={margenNegativo ? "riesgo" : "teal"}
          detalle="Venta menos compra de la cotizacion de cada embarque"
          alerta={
            kpis?.embarquesConPerdida
              ? `${kpis.embarquesConPerdida} embarque(s) con perdida`
              : null
          }
        />
        <KpiCard
          etiqueta="Posicion neta"
          valor={dineroCompacto(posicionNeta)}
          icono={Scale}
          acento={posicionNeta < 0 ? "amber" : "navy"}
          detalle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight size={12} className="text-teal-600" aria-hidden />
                Cobrar {dinero(kpis?.porCobrar ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowDownRight size={12} className="text-amber-500" aria-hidden />
                Pagar {dinero(kpis?.porPagar ?? 0)}
              </span>
            </span>
          }
          alerta={posicionNeta < 0 ? "Se debe mas de lo que se va a cobrar" : null}
        />
      </div>

      <Card
        titulo="Rentabilidad por embarque"
        icono={BadgeDollarSign}
        descripcion="Venta y compra vienen de la cotizacion. El margen negativo se marca en rojo."
        bodyClassName=""
      >
        <DataTable<Rentabilidad>
          keyExtractor={(r) => r.folio}
          filas={rentabilidad}
          cargando={cargandoRent}
          vacioMensaje="Sin embarques todavia"
          columnas={[
            {
              header: "Folio",
              render: (r) => <span className="font-medium text-slate-900">{r.folio}</span>,
            },
            { header: "Consignee", render: (r) => r.consignee },
            { header: "Modalidad", render: (r) => r.modalidad },
            { header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { header: "Venta", alinear: "der", render: (r) => dinero(r.venta, r.moneda) },
            {
              header: "Compra",
              alinear: "der",
              render: (r) => <span className="text-slate-500">{dinero(r.compra, r.moneda)}</span>,
            },
            {
              header: "Margen",
              alinear: "der",
              render: (r) => (
                <span
                  className={`inline-flex items-center justify-end gap-1 font-semibold ${
                    r.margen < 0 ? "text-rose-600" : "text-teal-700"
                  }`}
                >
                  {r.margen < 0 ? (
                    <ArrowDownRight size={13} strokeWidth={2.4} aria-hidden />
                  ) : (
                    <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
                  )}
                  {dinero(r.margen, r.moneda)}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card titulo="Embarques por status" icono={Ship} descripcion="Donde esta parada la operacion.">
          {!porStatus?.length && <p className="text-sm text-slate-400">Sin datos</p>}
          <ul className="space-y-3">
            {porStatus?.map((row) => (
              <li key={row.status} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={row.status} />
                  <span className="tabular text-sm font-semibold text-navy-700">
                    {row.cantidad}
                  </span>
                </div>
                <BarraProporcion valor={row.cantidad} maximo={maxStatus} tono="bg-teal-400" />
              </li>
            ))}
          </ul>
        </Card>

        <Card
          titulo="Por vendedor"
          icono={Users}
          descripcion="Cotizaciones emitidas y venta potencial."
        >
          {!porVendedor?.length && <p className="text-sm text-slate-400">Sin datos</p>}
          <ul className="space-y-3">
            {porVendedor?.map((row) => (
              <li key={row.vendedor} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{row.vendedor}</span>
                  <span className="tabular text-sm text-slate-600">
                    <span className="text-slate-400">{row.cotizaciones} cot ·</span>{" "}
                    <span className="font-semibold text-navy-700">
                      {dinero(row.ventaTotal ?? 0)}
                    </span>
                  </span>
                </div>
                <BarraProporcion
                  valor={Number(row.ventaTotal ?? 0)}
                  maximo={maxVendedor}
                  tono="bg-navy-400"
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card
          titulo="Cuentas por cobrar proximas / vencidas"
          icono={Wallet}
          descripcion="Ventana de 45 dias."
          bodyClassName=""
        >
          <DataTable<CobroPorVencer>
            keyExtractor={(c) => c.id}
            filas={cobros}
            vacioMensaje="Nada por cobrar en la ventana"
            columnas={[
              {
                header: "Factura",
                render: (c) => (
                  <span className="font-medium text-slate-900">{c.factura?.numeroFactura}</span>
                ),
              },
              { header: "Cliente", render: (c) => c.cliente?.razonSocial },
              { header: "Monto", alinear: "der", render: (c) => dinero(c.monto, c.moneda) },
              {
                header: "Vence",
                alinear: "der",
                render: (c) => {
                  const vencido = c.fechaVencimiento && new Date(c.fechaVencimiento) < new Date();
                  return (
                    <span className={vencido ? "font-semibold text-rose-600" : "text-slate-600"}>
                      {fecha(c.fechaVencimiento)}
                    </span>
                  );
                },
              },
            ]}
          />
        </Card>

        <Card
          titulo="Cuentas por pagar proximas / vencidas"
          icono={BadgeDollarSign}
          descripcion="Ventana de 45 dias."
          bodyClassName=""
        >
          <DataTable<PagoPorVencer>
            keyExtractor={(p) => p.id}
            filas={pagos}
            vacioMensaje="Nada por pagar en la ventana"
            columnas={[
              {
                header: "Proveedor",
                render: (p) => (
                  <span className="font-medium text-slate-900">{p.proveedor?.nombre}</span>
                ),
              },
              { header: "Embarque", render: (p) => p.shipment?.folio ?? "—" },
              { header: "Monto", alinear: "der", render: (p) => dinero(p.monto, p.moneda) },
              {
                header: "Limite",
                alinear: "der",
                render: (p) => {
                  const vencido = p.fechaLimitePago && new Date(p.fechaLimitePago) < new Date();
                  return (
                    <span className={vencido ? "font-semibold text-rose-600" : "text-slate-600"}>
                      {fecha(p.fechaLimitePago)}
                    </span>
                  );
                },
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
