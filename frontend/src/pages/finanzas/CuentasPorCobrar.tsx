import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CircleDollarSign, HandCoins, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { dinero, fecha, fechaInput, texto } from "@/lib/format";

interface Cxc {
  id: string;
  monto: string | number;
  montoCobrado: string | number;
  moneda: string;
  fechaEmision: string;
  fechaVencimiento?: string | null;
  fechaCobro?: string | null;
  estatusCobro: string;
  vencida: boolean;
  comentarios?: string | null;
  cliente: { razonSocial: string };
  factura: { numeroFactura: string; shipment?: { folio: string } };
}

interface Resumen {
  cuentasAbiertas: number;
  totalPorCobrar: number;
  totalVencido: number;
}

interface CatalogoSat {
  clave: string;
  descripcion: string;
}

// Solo los terminos de cobranza son editables: el monto viene del CFDI y el
// cobrado es el acumulado de los cobros. Misma regla en cxc.schema.ts.
const CAMPOS_CXC: CampoFormulario[] = [
  { nombre: "fechaVencimiento", label: "Fecha de vencimiento", tipo: "fecha" },
  { nombre: "comentarios", label: "Comentarios", tipo: "textarea", ancho: true },
];

export default function CuentasPorCobrar() {
  const qc = useQueryClient();
  const [cobrar, setCobrar] = useState<Cxc | null>(null);
  const [ver, setVer] = useState<Cxc | null>(null);
  const [editar, setEditar] = useState<Cxc | null>(null);
  const [monto, setMonto] = useState("");
  const [formaPago, setFormaPago] = useState("03");
  const [numOperacion, setNumOperacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const { data: cuentas, isLoading } = useQuery({
    queryKey: ["cxc"],
    queryFn: async () => (await api.get<Cxc[]>("/cuentas-por-cobrar")).data,
  });
  const { data: formasPago } = useQuery({
    queryKey: ["catalogos-sat", "forma-pago"],
    queryFn: async () => (await api.get<CatalogoSat[]>("/catalogos-sat/forma-pago")).data,
  });
  const { data: resumen } = useQuery({
    queryKey: ["cxc", "resumen"],
    queryFn: async () => (await api.get<Resumen>("/cuentas-por-cobrar/resumen")).data,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cxc"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const registrar = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/cuentas-por-cobrar/${id}/cobrar`, {
        monto: Number(monto),
        formaPago,
        numOperacion: numOperacion || undefined,
      }),
    onSuccess: () => {
      setCobrar(null);
      setMonto("");
      setNumOperacion("");
      setError(null);
      refrescar();
      qc.invalidateQueries({ queryKey: ["complementos-pago"] });
    },
    onError: (e) => setError(mensajeError(e, "No se pudo registrar el cobro")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/cuentas-por-cobrar/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const gruposDetalle = (c: Cxc): GrupoDetalle[] => {
    const saldo = Number(c.monto) - Number(c.montoCobrado);
    return [
      {
        titulo: "Cuenta por cobrar",
        campos: [
          { label: "Factura", valor: c.factura?.numeroFactura },
          { label: "Embarque", valor: c.factura?.shipment?.folio ?? "—" },
          { label: "Cliente", valor: c.cliente?.razonSocial, ancho: true },
          { label: "Estatus", valor: <StatusBadge status={c.estatusCobro} /> },
        ],
      },
      {
        titulo: "Importes",
        campos: [
          { label: "Monto facturado", valor: dinero(c.monto, c.moneda) },
          { label: "Cobrado", valor: dinero(c.montoCobrado, c.moneda) },
          {
            label: "Saldo pendiente",
            valor: (
              <span className={saldo > 0 ? "font-semibold text-amber-700" : "text-slate-500"}>
                {dinero(saldo, c.moneda)}
              </span>
            ),
          },
        ],
      },
      {
        titulo: "Fechas",
        campos: [
          { label: "Emision", valor: fecha(c.fechaEmision) },
          {
            label: "Vencimiento",
            valor: c.fechaVencimiento ? (
              <span className={c.vencida ? "font-semibold text-rose-600" : ""}>
                {fecha(c.fechaVencimiento)}
              </span>
            ) : (
              "De contado"
            ),
          },
          { label: "Cobro total", valor: fecha(c.fechaCobro) },
        ],
      },
      {
        titulo: "Notas",
        campos: [{ label: "Comentarios", valor: texto(c.comentarios), ancho: true }],
      },
    ];
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500">
        Lo que el cliente le debe a Monsa una vez emitida la factura. Cada cuenta nace
        automaticamente al generar la factura y hereda los dias de credito del cliente.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          etiqueta="Cuentas abiertas"
          valor={resumen?.cuentasAbiertas ?? "—"}
          icono={Banknote}
          acento="navy"
          detalle="Facturas con saldo pendiente"
        />
        <KpiCard
          etiqueta="Total por cobrar"
          valor={dinero(resumen?.totalPorCobrar ?? 0)}
          icono={CircleDollarSign}
          acento="teal"
          detalle="Suma de saldos no cobrados"
        />
        <KpiCard
          etiqueta="Vencido"
          valor={dinero(resumen?.totalVencido ?? 0)}
          icono={TriangleAlert}
          acento={resumen?.totalVencido ? "riesgo" : "navy"}
          detalle="Pasado su fecha de vencimiento"
          alerta={resumen?.totalVencido ? "Cartera vencida por cobrar" : null}
        />
      </div>

      <DataTable<Cxc>
        keyExtractor={(c) => c.id}
        filas={cuentas}
        cargando={isLoading}
        vacioMensaje="Sin cuentas por cobrar. Se generan al facturar un embarque cerrado."
        onVer={setVer}
        onEditar={(c) => {
          setErrorEdicion(null);
          setEditar(c);
        }}
        edicionBloqueada={(c) =>
          c.estatusCobro === "COBRADA" ? "Una cuenta ya cobrada no se edita." : null
        }
        accionesExtra={[
          {
            clave: "cobrar",
            label: "Registrar cobro",
            icono: HandCoins,
            tono: "acento",
            oculta: (c) => c.estatusCobro === "COBRADA",
            onClick: (c) => {
              setError(null);
              setCobrar(c);
              setMonto(String(Number(c.monto) - Number(c.montoCobrado)));
            },
          },
        ]}
        columnas={[
          {
            header: "Factura",
            render: (c) => (
              <span className="font-medium text-slate-900 dark:text-slate-100">{c.factura?.numeroFactura}</span>
            ),
          },
          { header: "Embarque", render: (c) => c.factura?.shipment?.folio ?? "—" },
          { header: "Cliente", render: (c) => c.cliente?.razonSocial },
          { header: "Monto", alinear: "der", render: (c) => dinero(c.monto, c.moneda) },
          {
            header: "Cobrado",
            alinear: "der",
            render: (c) => (
              <span className="text-slate-500">{dinero(c.montoCobrado, c.moneda)}</span>
            ),
          },
          {
            header: "Vence",
            alinear: "der",
            render: (c) => (
              <span className={c.vencida ? "font-semibold text-rose-600" : "text-slate-600 dark:text-slate-300"}>
                {fecha(c.fechaVencimiento)}
              </span>
            ),
          },
          { header: "Estatus", render: (c) => <StatusBadge status={c.estatusCobro} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.factura?.numeroFactura ?? "Cuenta por cobrar"}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.estatusCobro} />
              <span className="text-xs text-slate-400">{ver.cliente?.razonSocial}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar cobranza · ${editar.factura?.numeroFactura}`}
          descripcion="El monto viene del CFDI y el cobrado es el acumulado de los cobros: aqui solo se ajustan los terminos."
          campos={CAMPOS_CXC}
          valores={{
            fechaVencimiento: fechaInput(editar.fechaVencimiento),
            comentarios: editar.comentarios ?? "",
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          maxWidth="max-w-lg"
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {cobrar && (
        <Modal
          titulo={`Registrar cobro · ${cobrar.factura.numeroFactura}`}
          descripcion={`Saldo pendiente: ${dinero(
            Number(cobrar.monto) - Number(cobrar.montoCobrado),
            cobrar.moneda
          )}. Un cobro parcial deja la cuenta en PARCIAL. Si la factura es metodo de pago PPD, este cobro genera un complemento de pago.`}
          onClose={() => setCobrar(null)}
          maxWidth="max-w-sm"
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (Number(monto) > 0) registrar.mutate(cobrar.id);
            }}
            className="space-y-3"
          >
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label={`Monto cobrado (${cobrar.moneda})`} requerido>
              <TextInput
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </Field>
            <Field label="Forma de pago (clave SAT)">
              <Select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                {formasPago?.map((f) => (
                  <option key={f.clave} value={f.clave}>
                    {f.clave} — {f.descripcion}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Num. de operacion / referencia" hint="Opcional">
              <TextInput value={numOperacion} onChange={(e) => setNumOperacion(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button type="button" variante="ghost" onClick={() => setCobrar(null)}>
                Cancelar
              </Button>
              <Button type="submit" icono={HandCoins} disabled={registrar.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
