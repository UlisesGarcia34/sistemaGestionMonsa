import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCheck,
  ClipboardList,
  FileText,
  Plus,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CascadeStepper } from "@/components/CascadeStepper";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextArea, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { dinero, etiqueta, fecha, fechaInput, numeroInput, texto } from "@/lib/format";

interface Cliente {
  id: string;
  razonSocial: string;
  estatus: string;
  requiereRoutingOrder?: boolean;
}

interface RoutingOrder {
  id: string;
  status: string;
  shipperNombre?: string | null;
  shipperDireccion?: string | null;
  pol?: string | null;
  pod?: string | null;
  destinoFinal?: string | null;
  tipoServicioEntrega?: string | null;
  especificaciones?: string | null;
  agenteId?: string | null;
  agente?: { id: string; nombre: string } | null;
  fechaRecibido?: string | null;
}

interface Cotizacion {
  id: string;
  folio: string;
  status: string;
  incoterm: string;
  modalidad: string;
  origen: string;
  destino: string;
  montoVenta: string | number;
  montoCompra: string | number;
  moneda: string;
  validaHasta?: string | null;
  creadoEn?: string;
  vendedorId: string;
  cliente: Cliente;
  vendedor: { id: string; nombre: string };
  routingOrder?: RoutingOrder | null;
}

interface Vendedor {
  id: string;
  nombre: string;
}

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
}

const MODALIDADES = ["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"];

// Tipo de servicio de entrega del Routing Order (enum del backend).
const SERVICIOS_ENTREGA: { valor: string; label: string }[] = [
  { valor: "CY_PUERTO", label: "CY / cortado a puerto" },
  { valor: "DENTRO_BL_RAIL", label: "Dentro de BL — tren a bodega" },
  { valor: "DENTRO_BL_TRUCK", label: "Dentro de BL — camion a bodega" },
  { valor: "FUERA_BL_CAMION", label: "Fuera de BL — camion contratado aparte" },
  { valor: "RAM", label: "RAM — hasta aduana interna" },
];
const etiquetaServicio = (v?: string | null) =>
  SERVICIOS_ENTREGA.find((s) => s.valor === v)?.label ?? texto(v);

// Una cotizacion solo se edita mientras sigue siendo una propuesta. El backend
// aplica la misma regla; esto evita el viaje al servidor y explica el porque.
const EDITABLES = ["BORRADOR", "ENVIADA"];

export default function Cotizaciones() {
  const qc = useQueryClient();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [incoterm, setIncoterm] = useState("FOB");
  const [modalidad, setModalidad] = useState(MODALIDADES[0]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [montoVenta, setMontoVenta] = useState("");
  const [montoCompra, setMontoCompra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<Cotizacion | null>(null);
  const [editar, setEditar] = useState<Cotizacion | null>(null);
  const [roDe, setRoDe] = useState<Cotizacion | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const { data: cotizaciones, isLoading } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: async () => (await api.get<Cotizacion[]>("/cotizaciones")).data,
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await api.get<Cliente[]>("/clientes")).data,
  });
  const { data: vendedores } = useQuery({
    queryKey: ["usuarios", "VENTAS"],
    queryFn: async () => (await api.get<Vendedor[]>("/usuarios?rol=VENTAS")).data,
  });
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await api.get<Proveedor[]>("/proveedores")).data,
  });

  const clientesActivos = clientes?.filter((c) => c.estatus === "ACTIVO") ?? [];
  const sinClientesActivos = clientes != null && clientesActivos.length === 0;

  const refrescar = () => qc.invalidateQueries({ queryKey: ["cotizaciones"] });

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/cotizaciones", {
        clienteId,
        vendedorId,
        incoterm,
        modalidad,
        origen,
        destino,
        montoVenta: Number(montoVenta),
        montoCompra: Number(montoCompra),
        esEstimado: false,
      }),
    onSuccess: () => {
      setMostrarForm(false);
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo crear la cotizacion")),
  });

  const aceptar = useMutation({
    mutationFn: async (id: string) => api.patch(`/cotizaciones/${id}/aceptar`),
    onSuccess: () => {
      setErrorAccion(null);
      refrescar();
    },
    onError: (e) => setErrorAccion(mensajeError(e, "No se pudo aceptar la cotizacion")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/cotizaciones/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clienteId || !vendedorId || !origen || !destino || !montoVenta || !montoCompra) return;
    crear.mutate();
  }

  const camposEdicion: CampoFormulario[] = [
    {
      nombre: "vendedorId",
      label: "Vendedor",
      tipo: "select",
      requerido: true,
      opciones: (vendedores ?? []).map((v) => ({ valor: v.id, label: v.nombre })),
    },
    {
      nombre: "modalidad",
      label: "Modalidad",
      tipo: "select",
      requerido: true,
      opciones: MODALIDADES.map((m) => ({ valor: m, label: m })),
    },
    { nombre: "incoterm", label: "Incoterm", requerido: true },
    { nombre: "moneda", label: "Moneda", requerido: true },
    { nombre: "origen", label: "Origen", requerido: true },
    { nombre: "destino", label: "Destino", requerido: true },
    { nombre: "montoVenta", label: "Monto venta", tipo: "numero", paso: "0.01", requerido: true },
    { nombre: "montoCompra", label: "Monto compra", tipo: "numero", paso: "0.01", requerido: true },
    { nombre: "validaHasta", label: "Valida hasta", tipo: "fecha", ancho: true },
  ];

  const gruposDetalle = (c: Cotizacion): GrupoDetalle[] => {
    const margen = Number(c.montoVenta) - Number(c.montoCompra);
    return [
      {
        titulo: "Cotizacion",
        campos: [
          { label: "Folio", valor: c.folio },
          { label: "Status", valor: <StatusBadge status={c.status} /> },
          { label: "Cliente", valor: c.cliente?.razonSocial, ancho: true },
          { label: "Vendedor", valor: c.vendedor?.nombre },
          { label: "Emitida", valor: fecha(c.creadoEn) },
          { label: "Valida hasta", valor: fecha(c.validaHasta) },
        ],
      },
      {
        titulo: "Servicio",
        campos: [
          { label: "Modalidad", valor: c.modalidad },
          { label: "Incoterm", valor: c.incoterm },
          { label: "Ruta", valor: `${c.origen} → ${c.destino}`, ancho: true },
        ],
      },
      {
        titulo: "Economia del embarque",
        campos: [
          { label: "Venta", valor: dinero(c.montoVenta, c.moneda) },
          { label: "Compra", valor: dinero(c.montoCompra, c.moneda) },
          {
            label: "Margen",
            valor: (
              <span className={margen < 0 ? "font-semibold text-rose-600" : "font-semibold text-teal-700"}>
                {dinero(margen, c.moneda)}
              </span>
            ),
          },
          {
            label: "Margen %",
            valor:
              Number(c.montoVenta) > 0
                ? `${((margen / Number(c.montoVenta)) * 100).toFixed(1)} %`
                : "—",
          },
        ],
      },
      ...(c.status === "ACEPTADA"
        ? [
            {
              titulo: "Routing Order",
              campos: [
                {
                  label: "Estado",
                  valor: c.routingOrder ? (
                    <StatusBadge status={c.routingOrder.status} />
                  ) : (
                    "Sin solicitar"
                  ),
                },
                { label: "Agente designado", valor: texto(c.routingOrder?.agente?.nombre) },
                { label: "POL", valor: texto(c.routingOrder?.pol) },
                { label: "POD", valor: texto(c.routingOrder?.pod) },
                {
                  label: "Servicio de entrega",
                  valor: etiquetaServicio(c.routingOrder?.tipoServicioEntrega),
                  ancho: true,
                },
                { label: "Recibido", valor: fecha(c.routingOrder?.fechaRecibido) },
              ],
            },
          ]
        : []),
    ];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Cotizaciones"
        icono={FileText}
        distintivo="Paso 2 de 6"
        descripcion="Cotizacion comercial con margen venta vs compra. La aceptacion es lo que habilita crear el booking."
        accion={
          <Button
            icono={Plus}
            onClick={() => setMostrarForm(true)}
            disabled={sinClientesActivos}
            motivoDeshabilitado="No hay clientes ACTIVOS. Activa un cliente en Contactos antes de cotizar en firme."
          >
            Nueva cotizacion
          </Button>
        }
      />

      <CascadeStepper
        actual="cotizaciones"
        nota="Una cotizacion en firme exige un cliente ACTIVO (gate 1). Al aceptarla pasa a ACEPTADA y desbloquea el booking."
      />

      {sinClientesActivos && (
        <Aviso tono="bloqueo">
          No hay clientes ACTIVOS. Activa un cliente en Contactos antes de cotizar en firme.
        </Aviso>
      )}
      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}

      <DataTable<Cotizacion>
        keyExtractor={(c) => c.id}
        filas={cotizaciones}
        cargando={isLoading}
        vacioMensaje="Sin cotizaciones todavia"
        onVer={setVer}
        onEditar={(c) => {
          setErrorEdicion(null);
          setEditar(c);
        }}
        edicionBloqueada={(c) =>
          EDITABLES.includes(c.status)
            ? null
            : `Una cotizacion ${c.status} ya sostiene el booking y el margen del embarque: no se edita.`
        }
        accionesExtra={[
          {
            clave: "aceptar",
            label: "Marcar como aceptada",
            icono: CheckCheck,
            tono: "acento",
            oculta: (c) => !EDITABLES.includes(c.status),
            deshabilitada: (c) =>
              c.cliente?.estatus === "ACTIVO"
                ? null
                : "El cliente debe estar ACTIVO (KYC y credito aprobados) para aceptar la cotizacion.",
            onClick: (c) => aceptar.mutate(c.id),
          },
          {
            clave: "routing-order",
            label: "Routing Order del cliente",
            icono: ClipboardList,
            oculta: (c) => c.status !== "ACEPTADA",
            onClick: (c) => setRoDe(c),
          },
        ]}
        columnas={[
          {
            header: "Folio",
            render: (c) => <span className="font-medium text-slate-900">{c.folio}</span>,
          },
          { header: "Cliente", render: (c) => c.cliente?.razonSocial },
          { header: "Vendedor", render: (c) => c.vendedor?.nombre },
          {
            header: "Ruta",
            render: (c) => (
              <span className="text-slate-600">
                {c.origen} <span className="text-slate-300">→</span> {c.destino}
              </span>
            ),
          },
          { header: "Modalidad", render: (c) => c.modalidad },
          { header: "Venta", alinear: "der", render: (c) => dinero(c.montoVenta, c.moneda) },
          {
            header: "Margen",
            alinear: "der",
            render: (c) => {
              const m = Number(c.montoVenta) - Number(c.montoCompra);
              return (
                <span
                  className={`inline-flex items-center justify-end gap-1 font-medium ${
                    m < 0 ? "text-rose-600" : "text-teal-700"
                  }`}
                >
                  {m < 0 ? (
                    <ArrowDownRight size={13} strokeWidth={2.4} aria-hidden />
                  ) : (
                    <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden />
                  )}
                  {dinero(m, c.moneda)}
                </span>
              );
            },
          },
          { header: "Status", render: (c) => <StatusBadge status={c.status} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.folio}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.status} />
              <span className="text-xs text-slate-400">{ver.cliente?.razonSocial}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            EDITABLES.includes(ver.status) ? (
              <Button
                variante="secondary"
                onClick={() => {
                  setEditar(ver);
                  setVer(null);
                }}
              >
                Editar cotizacion
              </Button>
            ) : null
          }
        />
      )}

      {roDe && (
        <RoutingOrderModal
          cotizacion={roDe}
          proveedores={proveedores ?? []}
          onClose={() => setRoDe(null)}
          onSaved={() => {
            refrescar();
            setRoDe(null);
          }}
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar ${editar.folio}`}
          descripcion="El cliente y el status no se editan: cambiar de cliente es una cotizacion nueva, y el status se mueve al aceptarla."
          campos={camposEdicion}
          valores={{
            vendedorId: editar.vendedorId ?? editar.vendedor?.id ?? "",
            modalidad: editar.modalidad,
            incoterm: editar.incoterm,
            moneda: editar.moneda,
            origen: editar.origen,
            destino: editar.destino,
            montoVenta: numeroInput(editar.montoVenta),
            montoCompra: numeroInput(editar.montoCompra),
            validaHasta: fechaInput(editar.validaHasta),
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {mostrarForm && (
        <Modal
          titulo="Nueva cotizacion en firme"
          descripcion="Solo se listan clientes ACTIVOS. Venta y compra son obligatorias: el margen nace aqui, no al final."
          onClose={() => setMostrarForm(false)}
          maxWidth="max-w-lg"
        >
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="Cliente (ACTIVO)" requerido>
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                <option value="">Selecciona un cliente</option>
                {clientesActivos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vendedor" requerido>
              <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} required>
                <option value="">Selecciona un vendedor</option>
                {vendedores?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origen" requerido>
                <TextInput value={origen} onChange={(e) => setOrigen(e.target.value)} required />
              </Field>
              <Field label="Destino" requerido>
                <TextInput value={destino} onChange={(e) => setDestino(e.target.value)} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Modalidad">
                <Select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Incoterm">
                <TextInput value={incoterm} onChange={(e) => setIncoterm(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto venta (USD)" requerido>
                <TextInput
                  type="number"
                  step="0.01"
                  value={montoVenta}
                  onChange={(e) => setMontoVenta(e.target.value)}
                  required
                />
              </Field>
              <Field label="Monto compra (USD)" requerido>
                <TextInput
                  type="number"
                  step="0.01"
                  value={montoCompra}
                  onChange={(e) => setMontoCompra(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variante="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending}>
                Crear cotizacion
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Routing Order del cliente: instrucciones formales que se piden tras aceptar
// la cotizacion (gate 2) y que habilitan crear el booking (gate 3). Se crea
// SOLICITADO, se completa, y "Marcar recibido" lo pasa a RECIBIDO.
function RoutingOrderModal({
  cotizacion,
  proveedores,
  onClose,
  onSaved,
}: {
  cotizacion: Cotizacion;
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const ro = cotizacion.routingOrder ?? null;
  const soloLectura = ro?.status === "RECIBIDO";
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    shipperNombre: ro?.shipperNombre ?? "",
    shipperDireccion: ro?.shipperDireccion ?? "",
    pol: ro?.pol ?? cotizacion.origen ?? "",
    pod: ro?.pod ?? cotizacion.destino ?? "",
    destinoFinal: ro?.destinoFinal ?? cotizacion.destino ?? "",
    tipoServicioEntrega: ro?.tipoServicioEntrega ?? "",
    especificaciones: ro?.especificaciones ?? "",
    agenteId: ro?.agenteId ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const cuerpo = () => ({
    shipperNombre: f.shipperNombre || null,
    shipperDireccion: f.shipperDireccion || null,
    pol: f.pol || null,
    pod: f.pod || null,
    destinoFinal: f.destinoFinal || null,
    tipoServicioEntrega: f.tipoServicioEntrega || null,
    especificaciones: f.especificaciones || null,
    agenteId: f.agenteId || null,
  });

  const guardar = useMutation({
    mutationFn: async () =>
      ro
        ? api.patch(`/routing-orders/${ro.id}`, cuerpo())
        : api.post("/routing-orders", { cotizacionId: cotizacion.id, ...cuerpo() }),
    onSuccess: onSaved,
    onError: (e) => setError(mensajeError(e, "No se pudo guardar el Routing Order")),
  });

  const recibir = useMutation({
    mutationFn: async () => api.patch(`/routing-orders/${ro!.id}/recibir`),
    onSuccess: onSaved,
    onError: (e) => setError(mensajeError(e, "No se pudo marcar como recibido")),
  });

  const agentes = proveedores.filter((p) =>
    ["AGENTE_ADUANAL", "COLOADER", "NAVIERA", "OTRO"].includes(p.tipo)
  );

  return (
    <Modal
      titulo={`Routing Order · ${cotizacion.folio}`}
      descripcion={
        soloLectura
          ? "Recibido: las instrucciones ya alimentan el booking y no se editan."
          : "Instrucciones del cliente. Complétalas y marca 'Recibido' para habilitar el booking (gate 3)."
      }
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!soloLectura) guardar.mutate();
        }}
        className="space-y-3"
      >
        {error && <Aviso tono="error">{error}</Aviso>}
        {ro && (
          <div className="flex items-center gap-2">
            <StatusBadge status={ro.status} />
            {ro.fechaRecibido && (
              <span className="text-xs text-slate-400">recibido {fecha(ro.fechaRecibido)}</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shipper">
            <TextInput
              value={f.shipperNombre}
              disabled={soloLectura}
              onChange={(e) => set("shipperNombre", e.target.value)}
            />
          </Field>
          <Field label="Direccion del shipper">
            <TextInput
              value={f.shipperDireccion}
              disabled={soloLectura}
              onChange={(e) => set("shipperDireccion", e.target.value)}
            />
          </Field>
          <Field label="POL (puerto de carga)">
            <TextInput
              value={f.pol}
              disabled={soloLectura}
              onChange={(e) => set("pol", e.target.value)}
            />
          </Field>
          <Field label="POD (puerto de destino)">
            <TextInput
              value={f.pod}
              disabled={soloLectura}
              onChange={(e) => set("pod", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Destino final">
          <TextInput
            value={f.destinoFinal}
            disabled={soloLectura}
            onChange={(e) => set("destinoFinal", e.target.value)}
          />
        </Field>
        <Field label="Servicio de entrega">
          <Select
            value={f.tipoServicioEntrega}
            disabled={soloLectura}
            onChange={(e) => set("tipoServicioEntrega", e.target.value)}
          >
            <option value="">— sin definir —</option>
            {SERVICIOS_ENTREGA.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Agente designado" hint="El vendedor indica con que agente reservar.">
          <Select
            value={f.agenteId}
            disabled={soloLectura}
            onChange={(e) => set("agenteId", e.target.value)}
          >
            <option value="">— sin definir —</option>
            {agentes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {etiqueta(p.tipo)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Especificaciones especiales">
          <TextArea
            value={f.especificaciones}
            disabled={soloLectura}
            onChange={(e) => set("especificaciones", e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {!soloLectura && (
            <>
              <Button type="submit" variante="secondary" disabled={guardar.isPending}>
                {ro ? "Guardar" : "Solicitar Routing Order"}
              </Button>
              {ro && (
                <Button
                  type="button"
                  disabled={recibir.isPending}
                  onClick={() => recibir.mutate()}
                >
                  Marcar recibido
                </Button>
              )}
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
