import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CircleDollarSign,
  FileSpreadsheet,
  ListPlus,
  Plus,
  Receipt,
  Send,
  Stamp,
  Trash2,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CancelarCfdiModal } from "@/components/CancelarCfdiModal";
import { ComboboxCatalogoSat } from "@/components/ComboboxCatalogoSat";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { api, descargarArchivo, mensajeError } from "@/lib/api";
import { dinero, fecha, numeroInput, texto } from "@/lib/format";
import { rutaVistaDocumento } from "@/lib/documentos";

interface CatalogoSat {
  clave: string;
  descripcion: string;
}

interface Shipment {
  id: string;
  folio: string;
  status: string;
  valorizacionConfirmada?: boolean;
  consignee: { razonSocial: string };
}

interface ConceptoFactura {
  id?: string;
  claveProdServ: string;
  claveUnidad: string;
  unidad?: string | null;
  cantidad: string | number;
  descripcion: string;
  valorUnitario: string | number;
  importe: string | number;
  objetoImpuesto: string;
  ivaTasa: string | number;
  ivaImporte: string | number;
}

interface ComplementoPago {
  id: string;
  folio: string;
  fechaPago: string;
  monto: string | number;
  moneda: string;
  formaPago: string;
  saldoAnterior: string | number;
  saldoInsoluto: string | number;
  estatus: string;
  cfdiUuid?: string | null;
}

interface Factura {
  id: string;
  tipo: string;
  numeroFactura: string;
  montoSinIva: string | number;
  moneda: string;
  estatus: string;
  cfdiUuid?: string | null;
  fechaTimbrado?: string | null;
  creadoEn?: string;
  regimenFiscalReceptor?: string | null;
  usoCfdi?: string | null;
  codigoPostalReceptor?: string | null;
  formaPago?: string | null;
  metodoPago: string;
  condicionesPago?: string | null;
  tipoCambio?: string | number | null;
  retencionIvaTasa?: string | number | null;
  retencionIsrTasa?: string | number | null;
  motivoCancelacion?: string | null;
  folioSustitucionUuid?: string | null;
  fechaCancelacion?: string | null;
  conceptos: ConceptoFactura[];
  complementosPago: ComplementoPago[];
  shipment: { folio: string; consignee: { razonSocial: string } };
}

interface Resumen {
  facturas: number;
  proformas: number;
  montoFacturado: number;
  pendientesTimbrado: number;
  canceladas?: number;
}

const SEGUIMIENTO_ACTIVO = ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR", "PARA_FACTURAR"];
const TONO_TIPO_FACTURA: Record<string, "navy" | "positivo"> = {
  PROFORMA: "navy",
  FINAL: "positivo",
};
const TONO_ESTATUS: Record<string, "gris" | "ambar" | "positivo" | "rojo"> = {
  BORRADOR: "gris",
  PENDIENTE_TIMBRADO: "ambar",
  TIMBRADA: "positivo",
  CANCELADA: "rojo",
};

// Solo campos que NO son los conceptos (esos tienen su propio editor: los
// importes se recalculan en el backend, no se confia en un total ya
// multiplicado que llegue del formulario). Forma de pago y moneda salen de
// los catalogos oficiales del SAT (modules/catalogos-sat).
function camposFactura(formasPago: CatalogoSat[], monedas: CatalogoSat[]): CampoFormulario[] {
  return [
    {
      nombre: "moneda",
      label: "Moneda",
      tipo: "select",
      requerido: true,
      opciones: monedas.map((m) => ({ valor: m.clave, label: `${m.clave} — ${m.descripcion}` })),
    },
    {
      nombre: "metodoPago",
      label: "Metodo de pago",
      tipo: "select",
      requerido: true,
      opciones: [
        { valor: "PUE", label: "PUE — Pago en una sola exhibicion" },
        { valor: "PPD", label: "PPD — Pago en parcialidades o diferido" },
      ],
    },
    {
      nombre: "formaPago",
      label: "Forma de pago (clave SAT)",
      tipo: "select",
      opciones: formasPago.map((f) => ({ valor: f.clave, label: `${f.clave} — ${f.descripcion}` })),
    },
    { nombre: "condicionesPago", label: "Condiciones de pago", ancho: true },
    { nombre: "tipoCambio", label: "Tipo de cambio", tipo: "numero", paso: "0.0001" },
    { nombre: "retencionIvaTasa", label: "Retencion IVA (%)", tipo: "numero", paso: "0.01" },
    { nombre: "retencionIsrTasa", label: "Retencion ISR (%)", tipo: "numero", paso: "0.01" },
  ];
}

function conceptoVacio(): ConceptoFactura {
  return {
    claveProdServ: "78101803",
    claveUnidad: "E48",
    unidad: "Servicio",
    cantidad: 1,
    descripcion: "",
    valorUnitario: 0,
    importe: 0,
    objetoImpuesto: "02",
    ivaTasa: 16,
    ivaImporte: 0,
  };
}

export default function FacturacionPanel() {
  const qc = useQueryClient();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [shipmentId, setShipmentId] = useState("");
  const [tipoNueva, setTipoNueva] = useState("FINAL");
  const [montoSinIva, setMontoSinIva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<Factura | null>(null);
  const [editar, setEditar] = useState<Factura | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [editarConceptos, setEditarConceptos] = useState<Factura | null>(null);
  const [cancelar, setCancelar] = useState<Factura | null>(null);

  const { data: facturas, isLoading } = useQuery({
    queryKey: ["facturas"],
    queryFn: async () => (await api.get<Factura[]>("/facturas")).data,
  });
  const { data: resumen } = useQuery({
    queryKey: ["facturas", "resumen"],
    queryFn: async () => (await api.get<Resumen>("/facturas/resumen")).data,
  });
  const { data: todosShipments } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => (await api.get<Shipment[]>("/shipments")).data,
  });
  const { data: formasPago } = useQuery({
    queryKey: ["catalogos-sat", "forma-pago"],
    queryFn: async () => (await api.get<CatalogoSat[]>("/catalogos-sat/forma-pago")).data,
  });
  const { data: monedas } = useQuery({
    queryKey: ["catalogos-sat", "moneda"],
    queryFn: async () => (await api.get<CatalogoSat[]>("/catalogos-sat/moneda")).data,
  });

  // FINAL exige embarque cerrado (gate 7); PROFORMA basta con seguimiento
  // activo. Ambos exigen valorizacion confirmada (gate 6).
  const candidatos = (todosShipments ?? []).filter((s) => {
    if (!s.valorizacionConfirmada) return false;
    return tipoNueva === "FINAL"
      ? s.status === "PARA_FACTURAR"
      : SEGUIMIENTO_ACTIVO.includes(s.status);
  });
  const sinShipments = todosShipments != null && candidatos.length === 0;

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["facturas"] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
    qc.invalidateQueries({ queryKey: ["cxc"] });
    qc.invalidateQueries({ queryKey: ["complementos-pago"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/facturas", {
        shipmentId,
        tipo: tipoNueva,
        montoSinIva: Number(montoSinIva),
        moneda: "USD",
      }),
    onSuccess: () => {
      setMostrarForm(false);
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo generar la factura")),
  });

  const enviarATimbrado = useMutation({
    mutationFn: async (id: string) => api.patch(`/facturas/${id}/enviar-timbrado`),
    onSuccess: refrescar,
    onError: (e) => setError(mensajeError(e, "No se pudo enviar a timbrado")),
  });

  const timbrar = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/facturas/${id}/timbrar`, { cfdiUuid: `SIMULADO-${id.slice(0, 8)}` }),
    onSuccess: refrescar,
    onError: (e) => setError(mensajeError(e, "No se pudo timbrar")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/facturas/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const cancelarFactura = useMutation({
    mutationFn: async (payload: { motivoCancelacion: string; folioSustitucionUuid?: string }) =>
      api.patch(`/facturas/${cancelar!.id}/cancelar`, payload),
    onSuccess: () => {
      setCancelar(null);
      refrescar();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shipmentId || !montoSinIva) return;
    crear.mutate();
  }

  const gruposDetalle = (f: Factura): GrupoDetalle[] => [
    {
      titulo: "Factura",
      campos: [
        { label: "Numero", valor: f.numeroFactura },
        { label: "Tipo", valor: <StatusBadge status={f.tipo} tono={TONO_TIPO_FACTURA[f.tipo]} /> },
        { label: "Emitida", valor: fecha(f.creadoEn) },
        { label: "Embarque", valor: f.shipment?.folio },
        { label: "Cliente", valor: f.shipment?.consignee?.razonSocial, ancho: true },
      ],
    },
    {
      titulo: "Datos fiscales (CFDI)",
      campos: [
        { label: "Regimen fiscal receptor", valor: texto(f.regimenFiscalReceptor) },
        { label: "Uso CFDI", valor: texto(f.usoCfdi) },
        { label: "Codigo postal receptor", valor: texto(f.codigoPostalReceptor) },
        { label: "Forma de pago", valor: texto(f.formaPago) },
        { label: "Metodo de pago", valor: f.metodoPago },
        { label: "Condiciones de pago", valor: texto(f.condicionesPago) },
        { label: "Tipo de cambio", valor: f.tipoCambio ? String(f.tipoCambio) : "—" },
      ],
    },
    {
      titulo: "Conceptos",
      campos: f.conceptos.map((c, i) => ({
        label: `Concepto ${i + 1}`,
        valor: `${c.claveProdServ}/${c.claveUnidad} · ${c.cantidad} ${c.unidad ?? ""} — ${c.descripcion} · ${dinero(c.valorUnitario, f.moneda)} = ${dinero(c.importe, f.moneda)} (IVA ${dinero(c.ivaImporte, f.moneda)})`,
        ancho: true,
      })),
    },
    {
      titulo: "Importe",
      campos: [
        { label: "Subtotal", valor: dinero(f.montoSinIva, f.moneda) },
        { label: "Moneda", valor: f.moneda },
      ],
    },
    {
      titulo: "Timbrado (CFDI)",
      campos: [
        { label: "Estatus", valor: <StatusBadge status={f.estatus} tono={TONO_ESTATUS[f.estatus]} /> },
        { label: "Fecha de timbrado", valor: fecha(f.fechaTimbrado) },
        { label: "UUID del CFDI", valor: texto(f.cfdiUuid), ancho: true },
        ...(f.estatus === "CANCELADA"
          ? [
              { label: "Motivo de cancelacion", valor: texto(f.motivoCancelacion) },
              { label: "Fecha de cancelacion", valor: fecha(f.fechaCancelacion) },
              { label: "UUID que sustituye", valor: texto(f.folioSustitucionUuid), ancho: true },
            ]
          : []),
      ],
    },
    ...((f.complementosPago ?? []).length
      ? [
          {
            titulo: "Complementos de pago (REP)",
            campos: f.complementosPago.map((c) => ({
              label: c.folio,
              valor: `${dinero(c.monto, c.moneda)} · ${fecha(c.fechaPago)} · ${c.estatus}`,
              ancho: true,
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Una FINAL nace en BORRADOR (revisable), se manda a timbrado y solo entonces genera su
          cuenta por cobrar. Una PROFORMA se pide durante el seguimiento y nunca timbra. El
          timbrado real ante el PAC queda como integracion pendiente; aqui se simula.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variante="secondary"
            icono={FileSpreadsheet}
            onClick={() => descargarArchivo("/reportes/facturacion/excel", "facturacion-monsa.xlsx")}
          >
            Exportar a Excel
          </Button>
          <Button icono={Plus} onClick={() => setMostrarForm(true)}>
            Generar factura
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          etiqueta="Facturas emitidas"
          valor={resumen?.facturas ?? "—"}
          icono={Receipt}
          acento="navy"
          detalle="CFDI generados desde el sistema"
        />
        <KpiCard
          etiqueta="Monto facturado"
          valor={dinero(resumen?.montoFacturado ?? 0)}
          icono={CircleDollarSign}
          acento="teal"
          detalle="Suma sin IVA de las FINAL ya timbradas"
        />
        <KpiCard
          etiqueta="Pendientes de timbrar"
          valor={resumen?.pendientesTimbrado ?? "—"}
          icono={Stamp}
          acento={resumen?.pendientesTimbrado ? "amber" : "navy"}
          detalle={`En borrador o pendiente de timbrado · ${resumen?.proformas ?? 0} proformas`}
        />
      </div>

      <DataTable<Factura>
        keyExtractor={(f) => f.id}
        filas={facturas}
        cargando={isLoading}
        vacioMensaje="Sin facturas todavia"
        onVer={setVer}
        onEditar={(f) => {
          setErrorEdicion(null);
          setEditar(f);
        }}
        edicionBloqueada={(f) =>
          f.estatus !== "BORRADOR"
            ? `La factura esta en estatus ${f.estatus}. Solo BORRADOR es editable.`
            : null
        }
        accionesExtra={[
          {
            clave: "conceptos",
            label: "Editar conceptos",
            icono: ListPlus,
            deshabilitada: (f) =>
              f.estatus !== "BORRADOR" ? `Estatus ${f.estatus}: solo BORRADOR es editable.` : null,
            onClick: (f) => setEditarConceptos(f),
          },
          {
            clave: "enviar-timbrado",
            label: "Enviar a timbrado",
            icono: Send,
            tono: "acento",
            oculta: (f) => f.tipo === "PROFORMA" || f.estatus !== "BORRADOR",
            onClick: (f) => enviarATimbrado.mutate(f.id),
          },
          {
            clave: "timbrar",
            label: "Timbrar (simulado)",
            icono: Stamp,
            tono: "acento",
            oculta: (f) => f.tipo === "PROFORMA" || f.estatus === "TIMBRADA" || f.estatus === "CANCELADA",
            deshabilitada: (f) =>
              f.estatus === "BORRADOR" ? "Primero envia la factura a timbrado." : null,
            onClick: (f) => timbrar.mutate(f.id),
          },
          {
            clave: "cancelar",
            label: "Cancelar CFDI",
            icono: Ban,
            tono: "peligro",
            oculta: (f) => f.tipo === "PROFORMA" || f.estatus !== "TIMBRADA",
            onClick: (f) => setCancelar(f),
          },
        ]}
        columnas={[
          {
            header: "No. Factura",
            render: (f) => <span className="font-medium text-slate-900">{f.numeroFactura}</span>,
          },
          {
            header: "Tipo",
            render: (f) => <StatusBadge status={f.tipo} tono={TONO_TIPO_FACTURA[f.tipo]} />,
          },
          { header: "Embarque", render: (f) => f.shipment?.folio },
          { header: "Cliente", render: (f) => f.shipment?.consignee?.razonSocial },
          { header: "Monto", alinear: "der", render: (f) => dinero(f.montoSinIva, f.moneda) },
          {
            header: "Estatus",
            render: (f) => <StatusBadge status={f.estatus} tono={TONO_ESTATUS[f.estatus]} />,
          },
          {
            header: "UUID",
            render: (f) => <span className="text-xs text-slate-400">{texto(f.cfdiUuid)}</span>,
          },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.numeroFactura}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.estatus} tono={TONO_ESTATUS[ver.estatus]} />
              <span className="text-xs text-slate-400">{ver.shipment?.consignee?.razonSocial}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            (ver.tipo === "PROFORMA" || ver.estatus === "TIMBRADA" || ver.estatus === "CANCELADA") && (
              <Button
                variante="secondary"
                onClick={() =>
                  window.open(rutaVistaDocumento("factura", ver.id, "FACTURA"), "_blank")
                }
              >
                Ver CFDI
              </Button>
            )
          }
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar ${editar.numeroFactura}`}
          descripcion="Solo se edita mientras la factura sigue BORRADOR. El monto se edita desde 'Editar conceptos'."
          campos={camposFactura(formasPago ?? [], monedas ?? [])}
          valores={{
            moneda: editar.moneda,
            metodoPago: editar.metodoPago,
            formaPago: editar.formaPago ?? "",
            condicionesPago: editar.condicionesPago ?? "",
            tipoCambio: numeroInput(editar.tipoCambio),
            retencionIvaTasa: numeroInput(editar.retencionIvaTasa),
            retencionIsrTasa: numeroInput(editar.retencionIsrTasa),
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          maxWidth="max-w-lg"
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {editarConceptos && (
        <EditorConceptos factura={editarConceptos} onClose={() => setEditarConceptos(null)} onGuardado={refrescar} />
      )}

      {cancelar && (
        <CancelarCfdiModal
          titulo="factura"
          folio={cancelar.numeroFactura}
          avisoExtra={
            (cancelar.complementosPago ?? []).some((c) => c.estatus !== "CANCELADA")
              ? "Esta factura tiene complementos de pago activos. Cancelalos primero en 'Complementos de pago'."
              : undefined
          }
          guardando={cancelarFactura.isPending}
          error={cancelarFactura.error}
          onCancelar={(payload) => cancelarFactura.mutate(payload)}
          onClose={() => setCancelar(null)}
        />
      )}

      {mostrarForm && (
        <Modal
          titulo="Generar factura"
          descripcion="Nace en BORRADOR con un concepto automatico; se revisa y ajusta antes de enviarla a timbrado."
          onClose={() => setMostrarForm(false)}
          maxWidth="max-w-sm"
        >
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="Tipo de factura" requerido>
              <Select
                value={tipoNueva}
                onChange={(e) => {
                  setTipoNueva(e.target.value);
                  setShipmentId("");
                }}
              >
                <option value="FINAL">Final (CFDI)</option>
                <option value="PROFORMA">Proforma</option>
              </Select>
            </Field>
            <Field
              label={tipoNueva === "FINAL" ? "Embarque cerrado y valorizado" : "Embarque valorizado"}
              requerido
            >
              <Select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} required>
                <option value="">Selecciona un embarque</option>
                {candidatos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.folio} — {s.consignee?.razonSocial}
                  </option>
                ))}
              </Select>
            </Field>
            {sinShipments && (
              <Aviso tono="bloqueo">
                {tipoNueva === "FINAL"
                  ? "No hay embarques cerrados (PARA_FACTURAR) con valorizacion confirmada."
                  : "No hay embarques en seguimiento con valorizacion confirmada."}
              </Aviso>
            )}
            <Field label="Monto sin IVA (USD)" requerido>
              <TextInput
                type="number"
                step="0.01"
                value={montoSinIva}
                onChange={(e) => setMontoSinIva(e.target.value)}
                required
              />
            </Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variante="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending || !shipmentId}>
                Generar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Editor de conceptos del CFDI. Solo disponible mientras la factura sigue
// BORRADOR (el backend recalcula importe e IVA, no confia en el total que
// llegue ya multiplicado).
function EditorConceptos({
  factura,
  onClose,
  onGuardado,
}: {
  factura: Factura;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [filas, setFilas] = useState<ConceptoFactura[]>(
    factura.conceptos.length ? factura.conceptos.map((c) => ({ ...c })) : [conceptoVacio()]
  );
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      api.put(`/facturas/${factura.id}/conceptos`, {
        conceptos: filas.map((f) => ({
          claveProdServ: f.claveProdServ,
          claveUnidad: f.claveUnidad,
          unidad: f.unidad || undefined,
          cantidad: Number(f.cantidad),
          descripcion: f.descripcion,
          valorUnitario: Number(f.valorUnitario),
          objetoImpuesto: f.objetoImpuesto,
          ivaTasa: Number(f.ivaTasa),
        })),
      }),
    onSuccess: () => {
      onGuardado();
      onClose();
    },
    onError: (e) => setError(mensajeError(e, "No se pudieron guardar los conceptos")),
  });

  function actualizarFila(i: number, campo: keyof ConceptoFactura, valor: string) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  const totalPreview = filas.reduce(
    (acc, f) => acc + Number(f.cantidad || 0) * Number(f.valorUnitario || 0),
    0
  );

  return (
    <Modal
      titulo={`Conceptos · ${factura.numeroFactura}`}
      descripcion="Cada linea del CFDI. El importe y el IVA se recalculan al guardar."
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-3">
        {error && <Aviso tono="error">{error}</Aviso>}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] font-semibold uppercase text-slate-500">
                <th className="px-2 py-2">Clave prod/serv</th>
                <th className="px-2 py-2">Clave unidad</th>
                <th className="px-2 py-2">Unidad</th>
                <th className="px-2 py-2">Descripcion</th>
                <th className="px-2 py-2">Cant.</th>
                <th className="px-2 py-2">V. unitario</th>
                <th className="px-2 py-2">IVA %</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <div className="w-56">
                      <ComboboxCatalogoSat
                        endpoint="clave-prod-serv"
                        valor={f.claveProdServ}
                        etiquetaCampo={(r) => String(r.descripcion)}
                        placeholder="Buscar por clave o descripcion..."
                        onSeleccionar={(clave) => actualizarFila(i, "claveProdServ", clave)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="w-40">
                      <ComboboxCatalogoSat
                        endpoint="clave-unidad"
                        valor={f.claveUnidad}
                        etiquetaCampo={(r) => String(r.nombre)}
                        placeholder="Buscar unidad..."
                        onSeleccionar={(clave) => actualizarFila(i, "claveUnidad", clave)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      className="w-20"
                      value={f.unidad ?? ""}
                      onChange={(e) => actualizarFila(i, "unidad", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      className="min-w-[14rem]"
                      value={f.descripcion}
                      onChange={(e) => actualizarFila(i, "descripcion", e.target.value)}
                      required
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      type="number"
                      step="0.001"
                      className="w-16"
                      value={String(f.cantidad)}
                      onChange={(e) => actualizarFila(i, "cantidad", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={String(f.valorUnitario)}
                      onChange={(e) => actualizarFila(i, "valorUnitario", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <TextInput
                      type="number"
                      step="0.01"
                      className="w-16"
                      value={String(f.ivaTasa)}
                      onChange={(e) => actualizarFila(i, "ivaTasa", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setFilas((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={filas.length === 1}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      <Trash2 size={14} strokeWidth={1.9} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variante="ghost"
            icono={Plus}
            onClick={() => setFilas((prev) => [...prev, conceptoVacio()])}
          >
            Agregar linea
          </Button>
          <p className="text-sm text-slate-600">
            Subtotal estimado: <span className="font-semibold">{dinero(totalPreview, factura.moneda)}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending ? "Guardando..." : "Guardar conceptos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
