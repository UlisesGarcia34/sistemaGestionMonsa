import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, LayoutDashboard, Wallet } from 'lucide-react';
import { Card } from '@/components/Card';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { FiltrosEmbarques, useFiltrosEmbarques } from '@/components/FiltrosEmbarques';
import { ResumenEmbarques } from '@/components/ResumenEmbarques';
import { api } from '@/lib/api';
import { dinero, fecha } from '@/lib/format';
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


export default function Dashboard() {
  const { filtros } = useFiltrosEmbarques();
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


  return (<div className="space-y-6">
    <PageHeader titulo="Dashboard operativo" icono={LayoutDashboard} descripcion="Sigue los embarques, atiende los próximos arribos y consulta el margen real confirmado." />
    <FiltrosEmbarques />
    <ResumenEmbarques filtros={filtros} completo />
    <p className="text-sm text-slate-500 dark:text-slate-400">Cartera general · Ventana independiente de 45 días, sin filtros de embarques.</p>
    <div className="grid gap-4 xl:grid-cols-2">
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
                  <span className="font-medium text-slate-900 dark:text-slate-100">{c.factura?.numeroFactura}</span>
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
                    <span className={vencido ? "font-semibold text-rose-600" : "text-slate-600 dark:text-slate-300"}>
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
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.proveedor?.nombre}</span>
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
                    <span className={vencido ? "font-semibold text-rose-600" : "text-slate-600 dark:text-slate-300"}>
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
