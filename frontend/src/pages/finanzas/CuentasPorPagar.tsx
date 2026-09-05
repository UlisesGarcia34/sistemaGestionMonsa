import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BanknoteArrowUp, HandCoins, TriangleAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { dinero, etiqueta, fecha, fechaInput, numeroInput, texto } from "@/lib/format";

interface Cxp {
  id: string;
  numeroFactura?: string | null;
  monto: string | number;
  moneda: string;
  fechaSolicitud?: string | null;
  fechaLimitePago?: string | null;
  fechaPagoConfirmado?: string | null;
  esGarantia: boolean;
  comentarios?: string | null;
  proveedorId: string;
  shipmentId?: string | null;
  proveedor: { nombre: string; tipo: string };
  shipment?: { folio: string; consignee?: { razonSocial: string } } | null;
}

interface Resumen {
  cuentasPendientes: number;
  totalPendiente: number;
  totalVencido: number;
}

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
}

interface Shipment {
  id: string;
  folio: string;
}

export default function CuentasPorPagar() {
  const qc = useQueryClient();
  const [ver, setVer] = useState<Cxp | null>(null);
  const [editar, setEditar] = useState<Cxp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const { data: cuentas, isLoading } = useQuery({
    queryKey: ["cxp"],
    queryFn: async () => (await api.get<Cxp[]>("/cuentas-por-pagar")).data,
  });
  const { data: resumen } = useQuery({
    queryKey: ["cxp", "resumen"],
    queryFn: async () => (await api.get<Resumen>("/cuentas-por-pagar/resumen")).data,
  });
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await api.get<Proveedor[]>("/proveedores")).data,
  });
  const { data: shipments } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => (await api.get<Shipment[]>("/shipments")).data,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cxp"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const pagar = useMutation({
    mutationFn: async (id: string) => api.patch(`/cuentas-por-pagar/${id}/pagar`, {}),
    onSuccess: () => {
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo registrar el pago")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/cuentas-por-pagar/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const hoy = new Date();
  const estaVencida = (c: Cxp) =>
    !c.fechaPagoConfirmado && !!c.fechaLimitePago && new Date(c.fechaLimitePago) < hoy;

  const campos: CampoFormulario[] = [
    {
      nombre: "proveedorId",
      label: "Proveedor",
      tipo: "select",
      requerido: true,
      ancho: true,
      opciones: (proveedores ?? []).map((p) => ({
        valor: p.id,
        label: `${p.nombre} · ${etiqueta(p.tipo)}`,
      })),
    },
    {
      nombre: "shipmentId",
      label: "Embarque",
      tipo: "select",
      hint: "Opcional: hay pagos que no cuelgan de un embarque (garantias globales)",
      opciones: (shipments ?? []).map((s) => ({ valor: s.id, label: s.folio })),
    },
    { nombre: "numeroFactura", label: "Factura del proveedor" },
    { nombre: "monto", label: "Monto", tipo: "numero", paso: "0.01", requerido: true },
    { nombre: "moneda", label: "Moneda", requerido: true },
    { nombre: "fechaSolicitud", label: "Fecha de solicitud", tipo: "fecha" },
    { nombre: "fechaLimitePago", label: "Fecha limite de pago", tipo: "fecha" },
    { nombre: "esGarantia", label: "Es garantia de contenedor", tipo: "checkbox", ancho: true },
    { nombre: "comentarios", label: "Comentarios", tipo: "textarea", ancho: true },
  ];

  const gruposDetalle = (c: Cxp): GrupoDetalle[] => [
    {
      titulo: "Cuenta por pagar",
      campos: [
        { label: "Proveedor", valor: c.proveedor?.nombre, ancho: true },
        { label: "Tipo de proveedor", valor: etiqueta(c.proveedor?.tipo) },
        { label: "Factura del proveedor", valor: texto(c.numeroFactura) },
        { label: "Embarque", valor: texto(c.shipment?.folio) },
        { label: "Cliente del embarque", valor: texto(c.shipment?.consignee?.razonSocial) },
        { label: "Es garantia", valor: c.esGarantia ? "Si" : "No" },
      ],
    },
    {
      titulo: "Importe y fechas",
      campos: [
        { label: "Monto", valor: dinero(c.monto, c.moneda) },
        {
          label: "Estatus",
          valor: c.fechaPagoConfirmado ? (
            <StatusBadge status="PAGADA" tono="positivo" />
          ) : estaVencida(c) ? (
            <StatusBadge status="VENCIDA" tono="rojo" />
          ) : (
            <StatusBadge status="PENDIENTE" tono="ambar" />
          ),
        },
        { label: "Solicitud", valor: fecha(c.fechaSolicitud) },
        { label: "Limite de pago", valor: fecha(c.fechaLimitePago) },
        { label: "Pago confirmado", valor: fecha(c.fechaPagoConfirmado) },
      ],
    },
    {
      titulo: "Notas",
      campos: [{ label: "Comentarios", valor: texto(c.comentarios), ancho: true }],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-500">
        Lo que Monsa le debe a proveedores de flete y servicios. Equivale a la hoja
        &ldquo;CONTROL DE PAGOS&rdquo; del Excel, con FK reales a embarque y proveedor.
      </p>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          etiqueta="Cuentas pendientes"
          valor={resumen?.cuentasPendientes ?? "—"}
          icono={Wallet}
          acento="navy"
          detalle="Sin pago confirmado"
        />
        <KpiCard
          etiqueta="Total por pagar"
          valor={dinero(resumen?.totalPendiente ?? 0)}
          icono={BanknoteArrowUp}
          acento="amber"
          detalle="Salida de efectivo comprometida"
        />
        <KpiCard
          etiqueta="Vencido"
          valor={dinero(resumen?.totalVencido ?? 0)}
          icono={TriangleAlert}
          acento={resumen?.totalVencido ? "riesgo" : "navy"}
          detalle="Pasado su fecha limite de pago"
          alerta={resumen?.totalVencido ? "Hay pagos fuera de fecha" : null}
        />
      </div>

      <DataTable<Cxp>
        keyExtractor={(c) => c.id}
        filas={cuentas}
        cargando={isLoading}
        vacioMensaje="Sin cuentas por pagar"
        onVer={setVer}
        onEditar={(c) => {
          setErrorEdicion(null);
          setEditar(c);
        }}
        edicionBloqueada={(c) =>
          c.fechaPagoConfirmado
            ? "El pago ya esta confirmado: el monto y la fecha limite son lo que justifico la salida de dinero."
            : null
        }
        accionesExtra={[
          {
            clave: "pagar",
            label: "Registrar pago",
            icono: HandCoins,
            tono: "acento",
            oculta: (c) => !!c.fechaPagoConfirmado,
            onClick: (c) => pagar.mutate(c.id),
          },
        ]}
        columnas={[
          {
            header: "Proveedor",
            render: (c) => (
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.proveedor?.nombre}</p>
                <p className="text-xs text-slate-400">{etiqueta(c.proveedor?.tipo)}</p>
              </div>
            ),
          },
          { header: "Embarque", render: (c) => texto(c.shipment?.folio) },
          { header: "Factura prov.", render: (c) => texto(c.numeroFactura) },
          { header: "Monto", alinear: "der", render: (c) => dinero(c.monto, c.moneda) },
          {
            header: "Limite pago",
            alinear: "der",
            render: (c) => (
              <span className={estaVencida(c) ? "font-semibold text-rose-600" : "text-slate-600"}>
                {fecha(c.fechaLimitePago)}
              </span>
            ),
          },
          {
            header: "Estatus",
            render: (c) =>
              c.fechaPagoConfirmado ? (
                <StatusBadge status="PAGADA" tono="positivo" />
              ) : estaVencida(c) ? (
                <StatusBadge status="VENCIDA" tono="rojo" />
              ) : (
                <StatusBadge status="PENDIENTE" tono="ambar" />
              ),
          },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.proveedor?.nombre ?? "Cuenta por pagar"}
          subtitulo={
            <span className="text-xs text-slate-400">
              {dinero(ver.monto, ver.moneda)} · {texto(ver.shipment?.folio)}
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar cuenta · ${editar.proveedor?.nombre}`}
          descripcion="La confirmacion del pago no se edita aqui: se registra con la accion Registrar pago."
          campos={campos}
          valores={{
            proveedorId: editar.proveedorId,
            shipmentId: editar.shipmentId ?? "",
            numeroFactura: editar.numeroFactura ?? "",
            monto: numeroInput(editar.monto),
            moneda: editar.moneda,
            fechaSolicitud: fechaInput(editar.fechaSolicitud),
            fechaLimitePago: fechaInput(editar.fechaLimitePago),
            esGarantia: editar.esGarantia,
            comentarios: editar.comentarios ?? "",
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}
    </div>
  );
}
