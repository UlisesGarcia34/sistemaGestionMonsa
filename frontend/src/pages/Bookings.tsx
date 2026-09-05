import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCheck, Download, Plus, Printer } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CascadeStepper } from "@/components/CascadeStepper";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { abrirPdf, api, mensajeError } from "@/lib/api";
import { rutaPdfDocumento, rutaVistaDocumento } from "@/lib/documentos";
import { dinero, etiqueta, fecha, texto } from "@/lib/format";

interface Cotizacion {
  id: string;
  folio: string;
  status: string;
  modalidad: string;
  incoterm?: string;
  origen?: string;
  destino?: string;
  montoVenta?: string | number;
  moneda?: string;
  cliente: { razonSocial: string; requiereRoutingOrder?: boolean };
  routingOrder?: { id: string; status: string } | null;
}

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
  estatus: string;
}

interface Booking {
  id: string;
  referencia?: string | null;
  status: string;
  proveedorId: string;
  confirmadoEn?: string | null;
  creadoEn?: string;
  cotizacion: Cotizacion;
  proveedor: Proveedor;
  shipment?: { id: string; folio: string } | null;
}

// Motivo por el que la confirmacion de booking no se puede emitir todavia.
// Es el mismo gate que aplica el backend en reporte.service.confirmacionBooking:
// aqui se adelanta para poder mostrarlo como tooltip del boton deshabilitado.
function bloqueoConfirmacion(b: Booking) {
  return b.status === "CONFIRMADO"
    ? null
    : `El booking esta en status ${b.status}. Confirmalo para poder emitir la confirmacion.`;
}

// Gate 3: un booking necesita el Routing Order del cliente en estado RECIBIDO,
// salvo que el cliente no lo requiera (requiereRoutingOrder = false). Mismo
// mensaje que lanza el backend en booking.service.crearBooking.
function bloqueoRoutingOrder(c?: Cotizacion | null) {
  if (!c) return null;
  if (c.cliente?.requiereRoutingOrder === false) return null;
  return c.routingOrder?.status === "RECIBIDO"
    ? null
    : "No se puede crear el booking: falta el Routing Order del cliente en estado RECIBIDO";
}

export default function Bookings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cotizacionId, setCotizacionId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<Booking | null>(null);
  const [editar, setEditar] = useState<Booking | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.get<Booking[]>("/bookings")).data,
  });
  const { data: cotizaciones } = useQuery({
    queryKey: ["cotizaciones", "ACEPTADA"],
    queryFn: async () => (await api.get<Cotizacion[]>("/cotizaciones?status=ACEPTADA")).data,
  });
  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await api.get<Proveedor[]>("/proveedores")).data,
  });

  const proveedoresActivos = proveedores?.filter((p) => p.estatus === "ACTIVO") ?? [];
  const sinCotizaciones = cotizaciones != null && cotizaciones.length === 0;
  const sinProveedores = proveedores != null && proveedoresActivos.length === 0;
  const bloqueado = sinCotizaciones || sinProveedores;

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["reportes"] });
  };

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/bookings", { cotizacionId, proveedorId, referencia: referencia || undefined }),
    onSuccess: () => {
      setMostrarForm(false);
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo crear el booking")),
  });

  const confirmar = useMutation({
    mutationFn: async (id: string) => api.patch(`/bookings/${id}/confirmar`),
    onSuccess: refrescar,
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/bookings/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const cotizacionSeleccionada = cotizaciones?.find((c) => c.id === cotizacionId) ?? null;
  const bloqueoRO = bloqueoRoutingOrder(cotizacionSeleccionada);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cotizacionId || !proveedorId || bloqueoRO) return;
    crear.mutate();
  }

  // Con el booking ya CONFIRMADO el proveedor queda congelado: solo la
  // referencia del carrier sigue siendo editable (suele llegar despues).
  const camposEdicion = (b: Booking): CampoFormulario[] => [
    ...(b.status === "SOLICITADO"
      ? [
          {
            nombre: "proveedorId",
            label: "Proveedor (ACTIVO)",
            tipo: "select" as const,
            requerido: true,
            ancho: true,
            opciones: proveedoresActivos.map((p) => ({
              valor: p.id,
              label: `${p.nombre} · ${etiqueta(p.tipo)}`,
            })),
          },
        ]
      : []),
    {
      nombre: "referencia",
      label: "Referencia / SO del carrier",
      ancho: true,
      hint:
        b.status === "CONFIRMADO"
          ? "El proveedor ya no se puede cambiar en un booking confirmado."
          : undefined,
    },
  ];

  const gruposDetalle = (b: Booking): GrupoDetalle[] => [
    {
      titulo: "Booking",
      campos: [
        { label: "Status", valor: <StatusBadge status={b.status} /> },
        { label: "Referencia (SO)", valor: texto(b.referencia) },
        { label: "Solicitado", valor: fecha(b.creadoEn) },
        { label: "Confirmado", valor: fecha(b.confirmadoEn) },
        {
          label: "Embarque generado",
          valor: b.shipment?.folio ?? "Aun sin embarque abierto",
          ancho: true,
        },
      ],
    },
    {
      titulo: "Proveedor",
      campos: [
        { label: "Nombre", valor: b.proveedor?.nombre, ancho: true },
        { label: "Tipo", valor: etiqueta(b.proveedor?.tipo) },
        { label: "Estatus", valor: <StatusBadge status={b.proveedor?.estatus} /> },
      ],
    },
    {
      titulo: "Cotizacion de origen",
      campos: [
        { label: "Folio", valor: b.cotizacion?.folio },
        { label: "Cliente", valor: b.cotizacion?.cliente?.razonSocial, ancho: true },
        { label: "Modalidad", valor: b.cotizacion?.modalidad },
        { label: "Incoterm", valor: texto(b.cotizacion?.incoterm) },
        {
          label: "Ruta",
          valor:
            b.cotizacion?.origen && b.cotizacion?.destino
              ? `${b.cotizacion.origen} → ${b.cotizacion.destino}`
              : "—",
          ancho: true,
        },
        {
          label: "Monto de venta",
          valor:
            b.cotizacion?.montoVenta != null
              ? dinero(b.cotizacion.montoVenta, b.cotizacion.moneda ?? "USD")
              : "—",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Bookings"
        icono={CalendarCheck}
        distintivo="Paso 4 de 6"
        descripcion="Reserva de espacio con la naviera, coloader o transportista para una cotizacion ya aceptada."
        accion={
          <Button
            icono={Plus}
            onClick={() => setMostrarForm(true)}
            disabled={bloqueado}
            motivoDeshabilitado={
              [
                sinCotizaciones ? "No hay cotizaciones ACEPTADAS." : null,
                sinProveedores ? "No hay proveedores ACTIVOS." : null,
              ]
                .filter(Boolean)
                .join(" ") || null
            }
          >
            Nuevo booking
          </Button>
        }
      />

      <CascadeStepper
        actual="bookings"
        nota="Exige cotizacion ACEPTADA (gate 2), Routing Order del cliente RECIBIDO (gate 3) y proveedor ACTIVO (gate 4). Al confirmarlo se habilita el folio de embarque y su confirmacion imprimible."
      />

      {bloqueado && (
        <Aviso tono="bloqueo">
          {sinCotizaciones && "No hay cotizaciones ACEPTADAS. "}
          {sinProveedores && "No hay proveedores ACTIVOS. "}
          Resuelve eso antes de crear un booking.
        </Aviso>
      )}

      <DataTable<Booking>
        keyExtractor={(b) => b.id}
        filas={bookings}
        cargando={isLoading}
        vacioMensaje="Sin bookings todavia"
        onVer={setVer}
        onEditar={(b) => {
          setErrorEdicion(null);
          setEditar(b);
        }}
        edicionBloqueada={(b) =>
          b.status === "CANCELADO" ? "Un booking CANCELADO no se edita." : null
        }
        accionesExtra={[
          {
            clave: "confirmar",
            label: "Confirmar booking",
            icono: CheckCheck,
            tono: "acento",
            oculta: (b) => b.status !== "SOLICITADO",
            onClick: (b) => confirmar.mutate(b.id),
          },
          {
            clave: "imprimir",
            label: "Confirmacion de booking (imprimir)",
            icono: Printer,
            deshabilitada: bloqueoConfirmacion,
            onClick: (b) =>
              navigate(rutaVistaDocumento("booking", b.id, "CONFIRMACION_BOOKING")),
          },
          {
            clave: "pdf",
            label: "Confirmacion de booking (PDF)",
            icono: Download,
            deshabilitada: bloqueoConfirmacion,
            onClick: (b) => abrirPdf(rutaPdfDocumento("booking", b.id, "CONFIRMACION_BOOKING")),
          },
        ]}
        columnas={[
          {
            header: "Cotizacion",
            render: (b) => (
              <span className="font-medium text-slate-900">{b.cotizacion?.folio}</span>
            ),
          },
          { header: "Cliente", render: (b) => b.cotizacion?.cliente?.razonSocial },
          {
            header: "Proveedor",
            render: (b) => (
              <div className="min-w-0">
                <p className="text-slate-700">{b.proveedor?.nombre}</p>
                <p className="text-xs text-slate-400">{etiqueta(b.proveedor?.tipo)}</p>
              </div>
            ),
          },
          { header: "Referencia (SO)", render: (b) => texto(b.referencia) },
          {
            header: "Embarque",
            render: (b) =>
              b.shipment?.folio ? (
                <span className="text-slate-700">{b.shipment.folio}</span>
              ) : (
                <span className="text-slate-300">—</span>
              ),
          },
          { header: "Status", render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={`Booking · ${ver.cotizacion?.folio}`}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.status} />
              <span className="text-xs text-slate-400">{ver.proveedor?.nombre}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            <>
              <Button
                variante="secondary"
                icono={Printer}
                disabled={!!bloqueoConfirmacion(ver)}
                motivoDeshabilitado={bloqueoConfirmacion(ver)}
                onClick={() =>
                  navigate(rutaVistaDocumento("booking", ver.id, "CONFIRMACION_BOOKING"))
                }
              >
                Confirmacion
              </Button>
              <Button
                variante="secondary"
                onClick={() => {
                  setEditar(ver);
                  setVer(null);
                }}
              >
                Editar
              </Button>
            </>
          }
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar booking · ${editar.cotizacion?.folio}`}
          descripcion="La cotizacion de origen no se cambia: el booking es 1:1 con ella y reapuntarlo romperia la trazabilidad del margen."
          campos={camposEdicion(editar)}
          valores={{
            proveedorId: editar.proveedorId ?? editar.proveedor?.id ?? "",
            referencia: editar.referencia ?? "",
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          maxWidth="max-w-lg"
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {mostrarForm && (
        <Modal
          titulo="Nuevo booking"
          descripcion="Solo cotizaciones ACEPTADAS y proveedores ACTIVOS."
          onClose={() => setMostrarForm(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="Cotizacion aceptada" requerido>
              <Select
                value={cotizacionId}
                onChange={(e) => setCotizacionId(e.target.value)}
                required
              >
                <option value="">Selecciona una cotizacion</option>
                {cotizaciones?.map((c) => {
                  const faltaRO = !!bloqueoRoutingOrder(c);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.folio} — {c.cliente?.razonSocial}
                      {faltaRO ? " · falta Routing Order" : ""}
                    </option>
                  );
                })}
              </Select>
            </Field>
            {bloqueoRO && <Aviso tono="bloqueo">{bloqueoRO}</Aviso>}
            <Field label="Proveedor (ACTIVO)" requerido>
              <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
                <option value="">Selecciona un proveedor</option>
                {proveedoresActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {etiqueta(p.tipo)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referencia / SO number">
              <TextInput value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variante="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending || !!bloqueoRO}>
                Crear booking
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
