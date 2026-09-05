import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Anchor,
  BellRing,
  CalendarClock,
  Navigation,
  RefreshCw,
  Ship,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import {
  EstatusMaterialTimeline,
  ProgresoMaterial,
  sugerenciaEtapa,
} from "@/components/EstatusMaterialTimeline";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { Field, Select, TextInput } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { etiqueta, fecha, fechaInput, texto } from "@/lib/format";

// Modulo Operaciones: tablero de seguimiento de los embarques vivos. El alta y
// el cierre siguen en /embarques; aqui se lleva el pulso diario (ETD/ETA,
// estatus del material, arribo, liberacion). Los campos calculados (dias en
// puerto, atraso, aviso de llegada) los deriva el backend al leer.

interface Contenedor {
  id: string;
  numero?: string | null;
  tipo?: string | null;
  sello?: string | null;
}

interface NotificacionEnviada {
  id: string;
  tipo: string;
  fechaEnviada: string;
  comentario?: string | null;
  enviadoPor?: { nombre: string } | null;
}

const TIPOS_NOTIFICACION = [
  "CUTOFF_DOCUMENTAL",
  "CUTOFF_CONTENEDOR",
  "ETD",
  "ETA",
  "AVISO_ARRIBO",
  "SOLICITUD_FACTURA",
  "OTRO",
];

interface FilaOperacion {
  id: string;
  folio: string;
  status: string;
  version: number;
  acciones: { editar: string | null };
  tipoOperacion: string;
  modalidad: string;
  estatusMaterial?: string | null;
  consignee: { id: string; razonSocial: string; contactoEmail?: string | null };
  shipperNombre: string;
  customerService?: { id: string; nombre: string } | null;
  proveedor?: { id: string; nombre: string } | null;
  referenciaBooking?: string | null;
  vessel?: string | null;
  voyage?: string | null;
  puertoOrigen?: string | null;
  paisOrigen?: string | null;
  puertoDestino?: string | null;
  destinoFinal?: string | null;
  etd?: string | null;
  eta?: string | null;
  fechaArriboReal?: string | null;
  fechaLiberacion?: string | null;
  contenedores: Contenedor[];
  notificaciones?: NotificacionEnviada[];
  diasEnPuerto: number | null;
  diasParaEta: number | null;
  atrasado: boolean;
  avisoLlegadaPendiente: boolean;
}

interface Resumen {
  activos: number;
  enTransito: number;
  enPuerto: number;
  arribanEstaSemana: number;
  atrasados: number;
  avisosPendientes: number;
}

interface Usuario {
  id: string;
  nombre: string;
}

const STATUS_ACTIVOS = ["NUEVO_EMBARQUE", "BOOKING_CONFIRMED", "PARA_CERRAR", "PARA_FACTURAR"];

// ETA con una pista visual: rojo si ya paso sin arribo, ambar si esta dentro de
// la ventana de aviso de llegada.
function CeldaEta({ f }: { f: FilaOperacion }) {
  if (!f.eta) return <span className="text-slate-400">—</span>;
  const tono = f.atrasado
    ? "text-rose-600 font-medium"
    : f.avisoLlegadaPendiente
      ? "text-amber-700 font-medium"
      : "text-slate-600 dark:text-slate-300";
  const nota =
    f.diasParaEta == null
      ? null
      : f.diasParaEta < 0
        ? `${Math.abs(f.diasParaEta)} d de atraso`
        : f.diasParaEta === 0
          ? "hoy"
          : `en ${f.diasParaEta} d`;
  return (
    <span className={`tabular ${tono}`}>
      {fecha(f.eta)}
      {nota && <span className="ml-1 text-xs text-slate-400">· {nota}</span>}
    </span>
  );
}

export default function Operaciones() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [csId, setCsId] = useState("");
  const [ver, setVer] = useState<FilaOperacion | null>(null);
  const [editar, setEditar] = useState<FilaOperacion | null>(null);
  const [notificar, setNotificar] = useState<FilaOperacion | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const filtros = { status, csId };
  const { data: filas, isLoading } = useQuery({
    queryKey: ["operaciones", filtros],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (csId) p.set("customerServiceId", csId);
      return (await api.get<FilaOperacion[]>(`/operaciones?${p.toString()}`)).data;
    },
  });

  const { data: resumen } = useQuery({
    queryKey: ["operaciones", "resumen"],
    queryFn: async () => (await api.get<Resumen>("/operaciones/resumen")).data,
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["operaciones"] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/shipments/${editar!.id}/tracking`, { ...payload, version: editar!.version }),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudo guardar el tracking")),
  });

  const registrarNotificacion = useMutation({
    mutationFn: async (payload: { tipo: string; comentario?: string }) =>
      api.post(`/shipments/${notificar!.id}/notificaciones`, payload),
    onSuccess: () => {
      setNotificar(null);
      setErrorAccion(null);
      refrescar();
    },
    onError: (e) => setErrorAccion(mensajeError(e, "No se pudo registrar la notificacion")),
  });

  const gruposDetalle = (f: FilaOperacion): GrupoDetalle[] => [
    {
      titulo: "Embarque",
      campos: [
        { label: "Folio", valor: f.folio },
        { label: "Status", valor: <StatusBadge status={f.status} /> },
        { label: "Tipo de operacion", valor: etiqueta(f.tipoOperacion) },
        { label: "Modalidad", valor: f.modalidad },
        {
          label: "Estatus del material",
          valor: <ProgresoMaterial modalidad={f.modalidad} valor={f.estatusMaterial} />,
          ancho: true,
        },
      ],
    },
    {
      titulo: "Partes",
      campos: [
        { label: "Consignee", valor: f.consignee?.razonSocial, ancho: true },
        { label: "Shipper", valor: texto(f.shipperNombre), ancho: true },
        { label: "Proveedor / carrier", valor: texto(f.proveedor?.nombre) },
        { label: "Booking del carrier", valor: texto(f.referenciaBooking) },
        { label: "Customer service", valor: texto(f.customerService?.nombre) },
      ],
    },
    {
      titulo: "Ruta y fechas",
      campos: [
        { label: "Buque / unidad", valor: texto(f.vessel) },
        { label: "Viaje / vuelo", valor: texto(f.voyage) },
        {
          label: "Origen",
          valor: texto([f.puertoOrigen, f.paisOrigen].filter(Boolean).join(", ")),
        },
        { label: "Destino", valor: texto(f.puertoDestino || f.destinoFinal) },
        { label: "ETD", valor: fecha(f.etd) },
        { label: "ETA", valor: fecha(f.eta) },
        { label: "Arribo real", valor: fecha(f.fechaArriboReal) },
        { label: "Liberacion", valor: fecha(f.fechaLiberacion) },
        {
          label: "Dias en puerto",
          valor: f.diasEnPuerto != null ? `${f.diasEnPuerto} d` : "—",
        },
      ],
    },
    {
      titulo: `Contenedores (${f.contenedores?.length ?? 0})`,
      campos: f.contenedores?.length
        ? f.contenedores.map((c) => ({
            label: c.numero ?? "Sin numero",
            valor: [c.tipo, c.sello && `sello ${c.sello}`].filter(Boolean).join(" · ") || "—",
            ancho: true,
          }))
        : [{ label: "Sin contenedores capturados", valor: "—", ancho: true }],
    },
    {
      titulo: "Notificaciones al cliente",
      campos: [
        {
          label: "Enviadas",
          ancho: true,
          valor: f.notificaciones?.length ? (
            <ul className="space-y-1">
              {f.notificaciones.map((n) => (
                <li key={n.id} className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">{etiqueta(n.tipo)}</span> · {fecha(n.fechaEnviada)}
                  {n.enviadoPor?.nombre ? ` · ${n.enviadoPor.nombre}` : ""}
                  {n.comentario ? ` — ${n.comentario}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            "Sin notificaciones registradas"
          ),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Operaciones"
        icono={Navigation}
        distintivo="Seguimiento"
        descripcion="Tablero de los embarques vivos: estatus del material, ETD/ETA, arribo y liberacion. El alta y el cierre siguen en Embarques."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard etiqueta="Activos" valor={resumen?.activos ?? "—"} icono={Ship} acento="navy" />
        <KpiCard
          etiqueta="En transito"
          valor={resumen?.enTransito ?? "—"}
          icono={Navigation}
          acento="teal"
        />
        <KpiCard etiqueta="En puerto" valor={resumen?.enPuerto ?? "—"} icono={Anchor} acento="teal" />
        <KpiCard
          etiqueta="Arriban esta semana"
          valor={resumen?.arribanEstaSemana ?? "—"}
          icono={CalendarClock}
          acento="amber"
        />
        <KpiCard
          etiqueta="Atrasados"
          valor={resumen?.atrasados ?? "—"}
          icono={TriangleAlert}
          acento={resumen?.atrasados ? "riesgo" : "navy"}
          alerta={resumen?.atrasados ? "ETA vencido sin arribo" : null}
        />
        <KpiCard
          etiqueta="Avisos de llegada"
          valor={resumen?.avisosPendientes ?? "—"}
          icono={BellRing}
          acento="amber"
          alerta={resumen?.avisosPendientes ? "Por notificar al cliente" : null}
        />
      </div>

      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta dark:border-slate-800 dark:bg-slate-900">
        <label className="block min-w-[11rem]">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los activos</option>
            {STATUS_ACTIVOS.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </label>
        <label className="block min-w-[11rem]">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Customer service</span>
          <Select value={csId} onChange={(e) => setCsId(e.target.value)}>
            <option value="">Todos</option>
            {usuarios?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <DataTable<FilaOperacion>
        keyExtractor={(f) => f.id}
        filas={filas}
        cargando={isLoading}
        vacioMensaje="Sin embarques activos con estos filtros"
        onVer={setVer}
        onEditar={(f) => {
          setErrorEdicion(null);
          setEditar(f);
        }}
        accionesExtra={[
          {
            clave: "tracking",
            deshabilitada: s => s.acciones.editar,
            label: "Actualizar tracking",
            icono: RefreshCw,
            tono: "acento",
            onClick: (f) => {
              setErrorEdicion(null);
              setEditar(f);
            },
          },
          {
            clave: "notificar",
            label: "Registrar notificacion al cliente",
            icono: BellRing,
            onClick: (f) => {
              setErrorAccion(null);
              setNotificar(f);
            },
          },
        ]}
        renderDetalle={(f) => (
          <div className="space-y-3">
            {f.avisoLlegadaPendiente && (
              <Aviso tono="bloqueo">
                Arribo dentro de la ventana de aviso: avisa al consignee
                {f.consignee?.contactoEmail ? ` (${f.consignee.contactoEmail})` : ""} antes del ETA.
              </Aviso>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Vessel / Voyage</dt>
                <dd className="text-slate-700 dark:text-slate-300">{texto([f.vessel, f.voyage].filter(Boolean).join(" / "))}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Origen</dt>
                <dd className="text-slate-700 dark:text-slate-300">
                  {texto([f.puertoOrigen, f.paisOrigen].filter(Boolean).join(", "))}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Destino</dt>
                <dd className="text-slate-700 dark:text-slate-300">{texto(f.puertoDestino || f.destinoFinal)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Dias en puerto</dt>
                <dd className="text-slate-700 dark:text-slate-300">{f.diasEnPuerto != null ? `${f.diasEnPuerto} d` : "—"}</dd>
              </div>
            </dl>
          </div>
        )}
        columnas={[
          {
            header: "Folio",
            render: (f) => (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-900 dark:text-slate-100">{f.folio}</span>
                {f.avisoLlegadaPendiente && (
                  <BellRing size={13} className="text-amber-500" aria-label="Aviso de llegada pendiente" />
                )}
              </div>
            ),
          },
          { header: "Consignee", render: (f) => f.consignee?.razonSocial },
          { header: "Modalidad", render: (f) => f.modalidad },
          {
            header: "Material",
            render: (f) => <ProgresoMaterial modalidad={f.modalidad} valor={f.estatusMaterial} />,
          },
          { header: "ETD", alinear: "der", render: (f) => fecha(f.etd) },
          { header: "ETA", render: (f) => <CeldaEta f={f} /> },
          {
            header: "Arribo real",
            alinear: "der",
            render: (f) => fecha(f.fechaArriboReal),
          },
          { header: "Status", render: (f) => <StatusBadge status={f.status} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.folio}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.status} />
              <span className="text-xs text-slate-400">{ver.consignee?.razonSocial}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            <Button
              variante="secondary"
              icono={RefreshCw}
              onClick={() => {
                setEditar(ver);
                setVer(null);
              }}
            >
              Actualizar tracking
            </Button>
          }
        />
      )}

      {notificar && (
        <NotificacionModal
          folio={notificar.folio}
          guardando={registrarNotificacion.isPending}
          onClose={() => setNotificar(null)}
          onRegistrar={(p) => registrarNotificacion.mutate(p)}
        />
      )}

      {editar && (
        <TrackingModal
          fila={editar}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}
    </div>
  );
}

// Modal de tracking: timeline clickeable para el estatus del material + fechas.
// El estatus se guarda como texto (Shipment.estatusMaterial); el timeline y el
// campo "Detalle / otro" escriben el mismo valor.
function TrackingModal({
  fila,
  error,
  guardando,
  onClose,
  onGuardar,
}: {
  fila: FilaOperacion;
  error: string | null;
  guardando: boolean;
  onClose: () => void;
  onGuardar: (payload: Record<string, unknown>) => void;
}) {
  const [estatusMaterial, setEstatusMaterial] = useState(fila.estatusMaterial ?? "");
  const [etd, setEtd] = useState(fechaInput(fila.etd));
  const [eta, setEta] = useState(fechaInput(fila.eta));
  const [arribo, setArribo] = useState(fechaInput(fila.fechaArriboReal));
  const [liberacion, setLiberacion] = useState(fechaInput(fila.fechaLiberacion));

  const sugerencia = sugerenciaEtapa({ etd, fechaArriboReal: arribo, fechaLiberacion: liberacion });

  return (
    <Modal
      titulo={`Tracking · ${fila.folio}`}
      descripcion="El status y el folio los mueve la cascada desde Embarques. Aqui solo el seguimiento."
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGuardar({
            estatusMaterial: estatusMaterial.trim() || null,
            etd: etd || null,
            eta: eta || null,
            fechaArriboReal: arribo || null,
            fechaLiberacion: liberacion || null,
          });
        }}
        className="space-y-4"
      >
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Estatus del material
          </span>
          <EstatusMaterialTimeline
            modalidad={fila.modalidad}
            valor={estatusMaterial}
            onChange={setEstatusMaterial}
            sugerencia={sugerencia}
          />
        </div>

        <Field label="Detalle / otro" hint="Sobrescribe el timeline: EN ADUANA, DEMORADO EN ORIGEN, ...">
          <TextInput
            value={estatusMaterial}
            onChange={(e) => setEstatusMaterial(e.target.value)}
            placeholder="Escribe un estatus fuera de las etapas estandar"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ETD">
            <TextInput type="date" value={etd} onChange={(e) => setEtd(e.target.value)} />
          </Field>
          <Field label="ETA">
            <TextInput type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </Field>
          <Field label="Arribo real">
            <TextInput type="date" value={arribo} onChange={(e) => setArribo(e.target.value)} />
          </Field>
          <Field label="Liberacion">
            <TextInput
              type="date"
              value={liberacion}
              onChange={(e) => setLiberacion(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar tracking"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Registro de una notificacion puntual al cliente. Mismo endpoint que usa
// Embarques; aqui vive porque el seguimiento diario de Customer Service pasa
// por este tablero.
function NotificacionModal({
  folio,
  guardando,
  onClose,
  onRegistrar,
}: {
  folio: string;
  guardando: boolean;
  onClose: () => void;
  onRegistrar: (p: { tipo: string; comentario?: string }) => void;
}) {
  const [tipo, setTipo] = useState(TIPOS_NOTIFICACION[0]);
  const [comentario, setComentario] = useState("");
  return (
    <Modal
      titulo={`Notificar al cliente · ${folio}`}
      descripcion="Queda en el log del embarque con la fecha y quien lo envio. Un AVISO_ARRIBO registrado apaga la alerta de aviso de llegada."
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRegistrar({ tipo, comentario: comentario || undefined });
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de notificacion</span>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_NOTIFICACION.map((t) => (
              <option key={t} value={t}>
                {etiqueta(t)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Comentario</span>
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
