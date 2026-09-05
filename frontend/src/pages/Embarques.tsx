import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Ban,
  Calculator,
  FileText,
  Lock,
  Plus,
  Printer,
  ScrollText,
  Send,
  Ship,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/auth';
import { FiltrosEmbarques, useFiltrosEmbarques } from '@/components/FiltrosEmbarques';
import { ResumenEmbarques } from '@/components/ResumenEmbarques';
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CascadeStepper } from "@/components/CascadeStepper";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { EnviarCorreoModal } from "@/components/EnviarCorreoModal";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { opcionesEstatusMaterial, ProgresoMaterial } from "@/components/EstatusMaterialTimeline";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { abrirPdf, api, mensajeError } from "@/lib/api";
import { rutaPdfDocumento, rutaVistaDocumento } from "@/lib/documentos";
import { etiqueta, fecha, fechaInput, numeroInput, texto } from "@/lib/format";

interface Booking {
  id: string;
  shipment?: { id: string } | null;
  referencia?: string | null;
  cotizacion: { modalidad: string; cliente: { id: string; razonSocial: string } };
  proveedor: { nombre: string };
}

interface Contenedor {
  id: string;
  numero?: string | null;
  tipo?: string | null;
  sello?: string | null;
}

interface Documento {
  mbl?: string | null;
  hbl?: string | null;
  manifiesto?: string | null;
  estatusEmisionHbl?: string | null;
  estatusEmisionMbl?: string | null;
}

interface NotificacionEnviada {
  id: string;
  tipo: string;
  fechaEnviada: string;
  comentario?: string | null;
  enviadoPor?: { nombre: string } | null;
}

interface Shipment {
  version: number;
  acciones: { editar: string | null; cerrar: string | null; cancelar: string | null };
  motivoCancelacion?: string | null;
  canceladoEn?: string | null;
  auditoria?: { id: string; accion: string; autorNombre: string; creadoEn: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> }[];
  id: string;
  folio: string;
  status: string;
  tipoOperacion: string;
  modalidad: string;
  estatusMaterial?: string | null;
  incoterm?: string | null;
  poCliente?: string | null;
  shipperNombre: string;
  consigneeId: string;
  customerServiceId?: string | null;
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
  grossWeight?: string | number | null;
  cbm?: string | number | null;
  totalItems?: number | null;
  expedienteFisico?: boolean;
  valorizacionVenta?: string | number | null;
  valorizacionCompra?: string | number | null;
  valorizacionConfirmada?: boolean;
  valorizacionConfirmadaEn?: string | null;
  fechaRevalidacionNaviera?: string | null;
  blEndosadoEnviado?: boolean;
  fechaBlEndosadoEnviado?: string | null;
  creadoEn?: string;
  consignee: { id: string; razonSocial: string; contactoEmail?: string | null };
  customerService?: { id: string; nombre: string } | null;
  documento?: Documento | null;
  contenedores?: Contenedor[];
  notificaciones?: NotificacionEnviada[];
  booking: {
    referencia?: string | null;
    proveedor: { nombre: string };
    cotizacion?: { montoVenta?: string | number; montoCompra?: string | number; moneda?: string };
  };
}

interface Cliente {
  id: string;
  razonSocial: string;
}

interface Usuario {
  id: string;
  nombre: string;
}

const TIPOS_OPERACION = ["IMPORTACION", "EXPORTACION", "TERRESTRE"];
const MODALIDADES = ["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"];
const EMISION_BL = ["DRAFT", "FINAL"];
const TIPOS_NOTIFICACION = [
  "CUTOFF_DOCUMENTAL",
  "CUTOFF_CONTENEDOR",
  "ETD",
  "ETA",
  "AVISO_ARRIBO",
  "SOLICITUD_FACTURA",
  "OTRO",
];

// Estados en los que el expediente sigue vivo. Fuera de ellos el embarque ya
// sostiene una factura y su cuenta por cobrar: el backend aplica la misma
// regla en shipment.service.actualizarShipment.


// Mismos gates que reporte.service, adelantados al cliente para poder mostrar
// el motivo en el tooltip del boton deshabilitado en vez de esconder la accion.
const bloqueoCarta = (s: Shipment) =>
  s.status === "CANCELADO" ? "El embarque esta CANCELADO: no se emite carta de instrucciones." : null;

const bloqueoConocimiento = (s: Shipment, tipo: "HBL" | "MBL") =>
  (tipo === "HBL" ? s.documento?.hbl : s.documento?.mbl)?.trim()
    ? null
    : `Falta capturar el numero de ${tipo}. Registralo con "Documentacion" en esta misma fila.`;

export default function Embarques() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const { params, setParams, filtros } = useFiltrosEmbarques();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [cancelar, setCancelar] = useState<Shipment | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const navigate = useNavigate();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState(TIPOS_OPERACION[0]);
  const [modalidad, setModalidad] = useState(MODALIDADES[0]);
  const [shipperNombre, setShipperNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [ver, setVer] = useState<Shipment | null>(null);
  const [editar, setEditar] = useState<Shipment | null>(null);
  const [documentar, setDocumentar] = useState<Shipment | null>(null);
  const [valorizar, setValorizar] = useState<Shipment | null>(null);
  const [notificar, setNotificar] = useState<Shipment | null>(null);
  const [enviarCarta, setEnviarCarta] = useState<Shipment | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [avisoCierre, setAvisoCierre] = useState<string | null>(null);

  const { data: pagina, isLoading, error: errorLista, refetch } = useQuery({
    queryKey: ['shipments', 'pagina', filtros, page],
    queryFn: async () => (await api.get<{ items: Shipment[]; total: number; pages: number }>('/shipments/pagina', { params: { ...filtros, page, pageSize: 20 } })).data,
  });
  const shipments = pagina?.items;
  async function detalle(s: Shipment, abrir: (s: Shipment) => void) {
    setCargandoDetalle(true); setErrorAccion(null); setErrorEdicion(null);
    try { abrir((await api.get<Shipment>(`/shipments/${s.id}`)).data); }
    catch (e) { setErrorAccion(mensajeError(e, 'No se pudo abrir el expediente')); }
    finally { setCargandoDetalle(false); }
  }
  const { data: bookingsConfirmados } = useQuery({
    queryKey: ["bookings", "CONFIRMADO"],
    queryFn: async () => (await api.get<Booking[]>("/bookings?status=CONFIRMADO")).data,
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await api.get<Cliente[]>("/clientes")).data,
  });
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get<Usuario[]>("/usuarios")).data,
  });

  const bookingsDisponibles = bookingsConfirmados?.filter(b => !b.shipment);
  const sinBookings = bookingsDisponibles != null && bookingsDisponibles.length === 0;

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["shipments"] });
    qc.invalidateQueries({ queryKey: ['operaciones'] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ["reportes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const crear = useMutation({
    mutationFn: async () => {
      const b = bookingsConfirmados?.find((x) => x.id === bookingId);
      return api.post("/shipments", {
        bookingId,
        tipoOperacion,
        modalidad,
        consigneeId: b?.cotizacion.cliente.id,
        shipperNombre,
      });
    },
    onSuccess: () => {
      setMostrarForm(false);
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo crear el embarque")),
  });

  const cerrar = useMutation({
    mutationFn: async (s: Shipment) =>
      (
        await api.patch<{
          divergenciaMargen?: { alerta?: boolean; delta?: number | null; moneda?: string };
        }>(`/shipments/${s.id}/cerrar`, { version: s.version })
      ).data,
    onSuccess: (data) => {
      setErrorAccion(null);
      const d = data?.divergenciaMargen;
      setAvisoCierre(
        d?.alerta
          ? `Embarque cerrado. El margen real difiere del cotizado en ${d.delta?.toFixed(2)} ${
              d.moneda ?? ""
            }: revisalo en Finanzas antes de facturar.`
          : null
      );
      refrescar();
    },
    onError: (e) => setErrorAccion(mensajeError(e, "No se pudo cerrar el embarque")),
  });

  const guardarValorizacion = useMutation({
    mutationFn: async (payload: { valorizacionVenta: number; valorizacionCompra: number }) =>
      api.patch(`/shipments/${valorizar!.id}/valorizacion`, { ...payload, version: valorizar!.version }),
    onSuccess: () => {
      setValorizar(null);
      setErrorAccion(null);
      refrescar();
    },
    onError: (e) => setErrorAccion(mensajeError(e, "No se pudo confirmar la valorizacion")),
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

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/shipments/${editar!.id}`, { ...payload, version: editar!.version }),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const guardarDocumento = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/shipments/${documentar!.id}/documento`, { ...payload, version: documentar!.version }),
    onSuccess: () => {
      setDocumentar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudo guardar la documentacion")),
  });

  const confirmarCancelacion = useMutation({
    mutationFn: () => api.patch(`/shipments/${cancelar!.id}/cancelar`, { version: cancelar!.version, motivo }),
    onSuccess: () => { setCancelar(null); setMotivo(''); setErrorAccion(null); refrescar(); },
    onError: e => setErrorAccion(mensajeError(e, 'No se pudo cancelar el embarque')),
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingId || !shipperNombre) return;
    crear.mutate();
  }

  // Edicion operativa completa. Folio, booking y status quedan fuera a
  // proposito: los tres los mueve el sistema, no la captura.
  const CAMPOS_EMBARQUE: CampoFormulario[] = [
    {
      nombre: "tipoOperacion",
      label: "Tipo de operacion",
      tipo: "select",
      requerido: true,
      opciones: TIPOS_OPERACION.map((t) => ({ valor: t, label: t })),
    },
    {
      nombre: "modalidad",
      label: "Modalidad",
      tipo: "select",
      requerido: true,
      opciones: MODALIDADES.map((m) => ({ valor: m, label: m })),
    },
    {
      nombre: "consigneeId",
      label: "Consignee",
      tipo: "select",
      requerido: true,
      opciones: (clientes ?? []).map((c) => ({ valor: c.id, label: c.razonSocial })),
    },
    {
      nombre: "customerServiceId",
      label: "Customer service",
      tipo: "select",
      opciones: (usuarios ?? []).map((u) => ({ valor: u.id, label: u.nombre })),
    },
    { nombre: "shipperNombre", label: "Shipper", requerido: true, ancho: true },
    { nombre: "incoterm", label: "Incoterm" },
    {
      nombre: "estatusMaterial",
      label: "Estatus del material",
      tipo: "select",
      opciones: opcionesEstatusMaterial(editar?.modalidad, editar?.estatusMaterial),
    },
    { nombre: "poCliente", label: "PO / referencia del cliente", ancho: true },
    { nombre: "vessel", label: "Buque / unidad" },
    { nombre: "voyage", label: "Viaje / vuelo" },
    { nombre: "puertoOrigen", label: "Puerto / origen" },
    { nombre: "paisOrigen", label: "Pais de origen" },
    { nombre: "puertoDestino", label: "Puerto / destino" },
    { nombre: "destinoFinal", label: "Destino final" },
    { nombre: "etd", label: "ETD", tipo: "fecha" },
    { nombre: "eta", label: "ETA", tipo: "fecha" },
    { nombre: "fechaArriboReal", label: "Arribo real", tipo: "fecha" },
    { nombre: "fechaLiberacion", label: "Liberacion", tipo: "fecha" },
    { nombre: "grossWeight", label: "Peso bruto (kg)", tipo: "numero", paso: "0.01" },
    { nombre: "cbm", label: "Volumen (CBM)", tipo: "numero", paso: "0.001" },
    { nombre: "totalItems", label: "Total de bultos", tipo: "numero", paso: "1" },
    { nombre: "fechaRevalidacionNaviera", label: "Revalidacion ante naviera", tipo: "fecha" },
    { nombre: "fechaBlEndosadoEnviado", label: "Envio de BL endosado", tipo: "fecha" },
    { nombre: "blEndosadoEnviado", label: "BL endosado enviado al cliente", tipo: "checkbox" },
    { nombre: "expedienteFisico", label: "Expediente fisico abierto", tipo: "checkbox" },
  ];

  const CAMPOS_DOCUMENTO: CampoFormulario[] = [
    { nombre: "mbl", label: "MBL", hint: "Habilita la impresion del MBL" },
    { nombre: "hbl", label: "HBL", hint: "Habilita la impresion del HBL" },
    { nombre: "manifiesto", label: "Manifiesto" },
    {
      nombre: "estatusEmisionMbl",
      label: "Emision MBL",
      tipo: "select",
      opciones: EMISION_BL.map((v) => ({ valor: v, label: v })),
    },
    {
      nombre: "estatusEmisionHbl",
      label: "Emision HBL",
      tipo: "select",
      opciones: EMISION_BL.map((v) => ({ valor: v, label: v })),
    },
  ];

  const gruposDetalle = (s: Shipment): GrupoDetalle[] => [
    ...(s.motivoCancelacion ? [{ titulo: 'Cancelación', campos: [{ label: 'Motivo', valor: s.motivoCancelacion, ancho: true }, { label: 'Fecha', valor: fecha(s.canceladoEn) }] }] : []),
    { titulo: 'Historial del expediente (últimos 50 cambios)', campos: [{ label: 'Cambios registrados', ancho: true, valor: s.auditoria?.length ? <ul className="space-y-3">{s.auditoria.map(a => <li key={a.id} className="text-xs"><strong>{etiqueta(a.accion)}</strong> · {a.autorNombre} · {new Date(a.creadoEn).toLocaleString('es-MX')}<details><summary className="cursor-pointer text-teal-700 dark:text-teal-300">Ver cambio</summary><dl className="mt-2 space-y-1">{Object.entries(a.despues).filter(([campo]) => !['id', 'bookingId', 'consigneeId', 'customerServiceId', 'canceladoPorId'].includes(campo)).map(([campo, valor]) => <div key={campo}><dt className="font-medium">{etiqueta(campo.replace(/([A-Z])/g, ' $1'))}</dt><dd className="break-words">{a.antes ? `${a.antes[campo] == null ? 'Sin dato' : String(a.antes[campo])} → ` : ''}{valor == null ? 'Sin dato' : String(valor)}</dd></div>)}</dl></details></li>)}</ul> : 'Sin cambios registrados' }] },
    {
      titulo: "Embarque",
      campos: [
        { label: "Folio", valor: s.folio },
        { label: "Status", valor: <StatusBadge status={s.status} /> },
        { label: "Tipo de operacion", valor: etiqueta(s.tipoOperacion) },
        { label: "Modalidad", valor: s.modalidad },
        {
          label: "Estatus del material",
          valor: <ProgresoMaterial modalidad={s.modalidad} valor={s.estatusMaterial} />,
        },
        { label: "Incoterm", valor: texto(s.incoterm) },
        { label: "PO del cliente", valor: texto(s.poCliente), ancho: true },
        { label: "Abierto", valor: fecha(s.creadoEn) },
      ],
    },
    {
      titulo: "Partes",
      campos: [
        { label: "Consignee", valor: s.consignee?.razonSocial, ancho: true },
        { label: "Shipper", valor: texto(s.shipperNombre), ancho: true },
        { label: "Proveedor / carrier", valor: s.booking?.proveedor?.nombre },
        { label: "Booking del carrier", valor: texto(s.booking?.referencia) },
        { label: "Customer service", valor: texto(s.customerService?.nombre) },
      ],
    },
    {
      titulo: "Ruta y fechas",
      campos: [
        { label: "Buque / unidad", valor: texto(s.vessel) },
        { label: "Viaje / vuelo", valor: texto(s.voyage) },
        { label: "Origen", valor: texto([s.puertoOrigen, s.paisOrigen].filter(Boolean).join(", ")) },
        { label: "Destino", valor: texto(s.puertoDestino) },
        { label: "Destino final", valor: texto(s.destinoFinal), ancho: true },
        { label: "ETD", valor: fecha(s.etd) },
        { label: "ETA", valor: fecha(s.eta) },
        { label: "Arribo real", valor: fecha(s.fechaArriboReal) },
        { label: "Liberacion", valor: fecha(s.fechaLiberacion) },
      ],
    },
    {
      titulo: "Carga",
      campos: [
        {
          label: "Peso bruto",
          valor: s.grossWeight ? `${Number(s.grossWeight).toLocaleString("es-MX")} kg` : "—",
        },
        { label: "Volumen", valor: s.cbm ? `${s.cbm} CBM` : "—" },
        { label: "Total de bultos", valor: s.totalItems != null ? String(s.totalItems) : "—" },
        {
          label: "Contenedores",
          valor: s.contenedores?.length
            ? s.contenedores
                .map((c) => [c.numero, c.tipo, c.sello && `sello ${c.sello}`].filter(Boolean).join(" · "))
                .join(" | ")
            : "—",
          ancho: true,
        },
      ],
    },
    {
      titulo: "Documentacion",
      campos: [
        { label: "MBL", valor: texto(s.documento?.mbl) },
        { label: "HBL", valor: texto(s.documento?.hbl) },
        { label: "Manifiesto", valor: texto(s.documento?.manifiesto) },
        {
          label: "Emision MBL",
          valor: s.documento?.estatusEmisionMbl ? (
            <StatusBadge
              status={s.documento.estatusEmisionMbl}
              tono={s.documento.estatusEmisionMbl === "FINAL" ? "positivo" : "ambar"}
            />
          ) : (
            "—"
          ),
        },
        {
          label: "Emision HBL",
          valor: s.documento?.estatusEmisionHbl ? (
            <StatusBadge
              status={s.documento.estatusEmisionHbl}
              tono={s.documento.estatusEmisionHbl === "FINAL" ? "positivo" : "ambar"}
            />
          ) : (
            "—"
          ),
        },
      ],
    },
    {
      titulo: "Valorizacion y cierre",
      campos: [
        {
          label: "Valorizacion",
          valor: s.valorizacionConfirmada ? (
            <StatusBadge status="CONFIRMADA" tono="positivo" />
          ) : (
            <StatusBadge status="PENDIENTE" tono="ambar" />
          ),
        },
        { label: "Venta real", valor: s.valorizacionVenta != null ? String(s.valorizacionVenta) : "—" },
        { label: "Compra real", valor: s.valorizacionCompra != null ? String(s.valorizacionCompra) : "—" },
        { label: "Confirmada", valor: fecha(s.valorizacionConfirmadaEn) },
        { label: "Revalidacion naviera", valor: fecha(s.fechaRevalidacionNaviera) },
        {
          label: "BL endosado enviado",
          valor: s.blEndosadoEnviado ? `Si · ${fecha(s.fechaBlEndosadoEnviado)}` : "No",
        },
        { label: "Expediente fisico", valor: s.expedienteFisico ? "Si" : "No" },
      ],
    },
    {
      titulo: "Notificaciones al cliente",
      campos: [
        {
          label: "Enviadas",
          ancho: true,
          valor: s.notificaciones?.length ? (
            <ul className="space-y-1">
              {s.notificaciones.map((n) => (
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
        titulo="Embarques"
        icono={Ship}
        distintivo="Paso 5 de 6"
        descripcion="Nucleo operativo. El folio MGC26xxxxxx nace aqui, y solo a partir de un booking confirmado — nunca reservado por adelantado."
        accion={
          <Button
            icono={Plus}
            onClick={() => setMostrarForm(true)}
            disabled={sinBookings}
            motivoDeshabilitado="No hay bookings confirmados sin embarque asociado."
          >
            Nuevo embarque
          </Button>
        }
      />

      <CascadeStepper
        actual="embarques"
        nota="Exige booking CONFIRMADO (gate 5). Al cerrar el embarque pasa a PARA_FACTURAR y habilita Finanzas (requiere valorizacion confirmada, gate 6)."
      />

      {sinBookings && (
        <Aviso tono="bloqueo">
          No hay bookings confirmados sin embarque asociado. Confirma una nueva reserva para abrir otro embarque.
        </Aviso>
      )}
      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
      {avisoCierre && <Aviso tono="bloqueo">{avisoCierre}</Aviso>}

      <FiltrosEmbarques />
      <ResumenEmbarques filtros={filtros} />
      {errorLista && <Aviso tono="error">{mensajeError(errorLista, 'No se pudo cargar la lista.')} <Button variante="secondary" onClick={() => refetch()}>Reintentar</Button></Aviso>}
      {cargandoDetalle && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Abriendo expediente…</p>}
      <DataTable<Shipment>
        keyExtractor={(s) => s.id}
        filas={shipments}
        cargando={isLoading}
        vacioMensaje="Sin embarques con estos filtros"
        onVer={s => detalle(s, setVer)}
        onEditar={(s) => {
          setErrorEdicion(null);
          detalle(s, setEditar);
        }}
        edicionBloqueada={s => s.acciones.editar}
        accionesExtra={[
          { clave: 'cancelar', label: 'Cancelar embarque', icono: Ban, tono: 'peligro',
            deshabilitada: s => usuario?.rol !== 'ADMIN' ? 'Tu rol no tiene permiso para esta operacion' : s.acciones.cancelar,
            onClick: s => { setMotivo(''); setErrorAccion(null); setCancelar(s); } },
          {
            clave: "documentacion",
            label: "Capturar documentacion (MBL / HBL)",
            icono: FileText,
            deshabilitada: s => s.acciones.editar,
            onClick: (s) => {
              setErrorEdicion(null);
              detalle(s, setDocumentar);
            },
          },
          {
            clave: "notificar",
            label: "Registrar notificacion al cliente",
            icono: Bell,
            onClick: (s) => {
              setErrorAccion(null);
              detalle(s, setNotificar);
            },
          },
          {
            clave: "valorizar",
            label: "Confirmar valorizacion (costo y venta reales)",
            icono: Calculator,
            tono: "acento",
            deshabilitada: s => !['ADMIN', 'VENTAS'].includes(usuario?.rol ?? '') ? 'Tu rol no tiene permiso para esta operacion' : s.acciones.editar,
            onClick: (s) => {
              setErrorAccion(null);
              detalle(s, setValorizar);
            },
          },
          {
            clave: "carta",
            label: "Carta de instrucciones (imprimir)",
            icono: ScrollText,
            tono: "acento",
            deshabilitada: bloqueoCarta,
            onClick: (s) => navigate(rutaVistaDocumento("shipment", s.id, "CARTA_INSTRUCCIONES")),
          },
          {
            clave: "correo",
            label: "Enviar carta de instrucciones por correo",
            icono: Send,
            deshabilitada: bloqueoCarta,
            onClick: s => detalle(s, setEnviarCarta),
          },
          {
            clave: "cerrar",
            label: "Cerrar embarque (pasa a PARA_FACTURAR)",
            icono: Lock,
            deshabilitada: s => cerrar.isPending ? 'Cerrando embarque…' : s.acciones.cerrar,
            onClick: (s) => cerrar.mutate(s),
          },
        ]}
        columnas={[
          {
            header: "Folio",
            render: (s) => <span className="font-medium text-slate-900 dark:text-slate-100">{s.folio}</span>,
          },
          { header: "Consignee", render: (s) => s.consignee?.razonSocial },
          { header: "Responsable", render: (s) => s.customerService?.nombre ?? "Sin asignar" },
          { header: "Modalidad", render: (s) => s.modalidad },
          {
            header: "Material",
            render: (s) => <ProgresoMaterial modalidad={s.modalidad} valor={s.estatusMaterial} />,
          },
          { header: "ETA", alinear: "der", render: (s) => fecha(s.eta) },
          { header: "Status", render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>{pagina?.total ?? 0} embarques · Página {page} de {Math.max(pagina?.pages ?? 0, 1)}</span>
        <div className="flex gap-2">{[{ texto: 'Anterior', n: page - 1, disabled: page <= 1 }, { texto: 'Siguiente', n: page + 1, disabled: page >= (pagina?.pages ?? 0) }].map(b => <Button key={b.texto} variante="secondary" disabled={b.disabled || isLoading} onClick={() => { const p = new URLSearchParams(params); p.set('page', String(b.n)); setParams(p); }}>{b.texto}</Button>)}</div>
      </div>
      {cancelar && <Modal titulo={`Cancelar ${cancelar.folio}`} onClose={() => !confirmarCancelacion.isPending && setCancelar(null)}>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); confirmarCancelacion.mutate(); }}>
          <p className="text-sm text-slate-600 dark:text-slate-300">El embarque conservará su expediente e historial. La cancelación no se puede deshacer desde esta pantalla.</p>
          <Field label="Motivo de cancelación" requerido><TextInput autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} minLength={5} maxLength={2000} required /></Field>
          {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}
          <div className="flex justify-end gap-2"><Button variante="secondary" disabled={confirmarCancelacion.isPending} onClick={() => setCancelar(null)}>Volver</Button><Button type="submit" icono={Ban} disabled={confirmarCancelacion.isPending || motivo.trim().length < 5}>{confirmarCancelacion.isPending ? 'Cancelando…' : 'Confirmar cancelación'}</Button></div>
        </form>
      </Modal>}
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
            <>
              <Button
                variante="secondary"
                icono={ScrollText}
                disabled={!!bloqueoCarta(ver)}
                motivoDeshabilitado={bloqueoCarta(ver)}
                onClick={() =>
                  navigate(rutaVistaDocumento("shipment", ver.id, "CARTA_INSTRUCCIONES"))
                }
              >
                Carta de instrucciones
              </Button>
                <Button
                  variante="secondary"
                  disabled={!!ver.acciones.editar}
                  motivoDeshabilitado={ver.acciones.editar}
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
          titulo={`Editar ${editar.folio}`}
          descripcion="El folio, el booking de origen y el status no se editan: los mueve el sistema segun la cascada."
          campos={CAMPOS_EMBARQUE}
          valores={{
            tipoOperacion: editar.tipoOperacion,
            modalidad: editar.modalidad,
            consigneeId: editar.consigneeId ?? editar.consignee?.id ?? "",
            customerServiceId: editar.customerServiceId ?? "",
            shipperNombre: editar.shipperNombre,
            incoterm: editar.incoterm ?? "",
            estatusMaterial: editar.estatusMaterial ?? "",
            poCliente: editar.poCliente ?? "",
            vessel: editar.vessel ?? "",
            voyage: editar.voyage ?? "",
            puertoOrigen: editar.puertoOrigen ?? "",
            paisOrigen: editar.paisOrigen ?? "",
            puertoDestino: editar.puertoDestino ?? "",
            destinoFinal: editar.destinoFinal ?? "",
            etd: fechaInput(editar.etd),
            eta: fechaInput(editar.eta),
            fechaArriboReal: fechaInput(editar.fechaArriboReal),
            fechaLiberacion: fechaInput(editar.fechaLiberacion),
            grossWeight: numeroInput(editar.grossWeight),
            cbm: numeroInput(editar.cbm),
            totalItems: numeroInput(editar.totalItems),
            fechaRevalidacionNaviera: fechaInput(editar.fechaRevalidacionNaviera),
            fechaBlEndosadoEnviado: fechaInput(editar.fechaBlEndosadoEnviado),
            blEndosadoEnviado: !!editar.blEndosadoEnviado,
            expedienteFisico: !!editar.expedienteFisico,
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          maxWidth="max-w-3xl"
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {documentar && (
        <FormularioEdicion
          titulo={`Documentacion · ${documentar.folio}`}
          descripcion="Sin numero de MBL o HBL capturado no hay conocimiento que imprimir: es lo que habilita esos documentos."
          campos={CAMPOS_DOCUMENTO}
          valores={{
            mbl: documentar.documento?.mbl ?? "",
            hbl: documentar.documento?.hbl ?? "",
            manifiesto: documentar.documento?.manifiesto ?? "",
            estatusEmisionMbl: documentar.documento?.estatusEmisionMbl ?? "",
            estatusEmisionHbl: documentar.documento?.estatusEmisionHbl ?? "",
          }}
          error={errorEdicion}
          guardando={guardarDocumento.isPending}
          maxWidth="max-w-xl"
          textoGuardar="Guardar documentacion"
          onClose={() => setDocumentar(null)}
          onGuardar={(payload) => guardarDocumento.mutate(payload)}
        />
      )}

      {valorizar && (
        <ValorizacionModal
          error={errorAccion}
          shipment={valorizar}
          guardando={guardarValorizacion.isPending}
          onClose={() => setValorizar(null)}
          onConfirmar={(p) => guardarValorizacion.mutate(p)}
        />
      )}

      {notificar && (
        <NotificacionModal
          shipment={notificar}
          guardando={registrarNotificacion.isPending}
          onClose={() => setNotificar(null)}
          onRegistrar={(p) => registrarNotificacion.mutate(p)}
        />
      )}

      {enviarCarta && (
        <EnviarCorreoModal
          titulo={`Enviar carta de instrucciones · ${enviarCarta.folio}`}
          endpoint={`/reportes/shipment/${enviarCarta.id}/carta-instrucciones/enviar`}
          destinatarioInicial={enviarCarta.consignee?.contactoEmail}
          asuntoInicial={`Carta de instrucciones ${enviarCarta.folio} — Monsa Global Cargo`}
          cuerpoInicial={
            `Estimado cliente:\n\n` +
            `Adjuntamos la carta de instrucciones del embarque ${enviarCarta.folio} ` +
            `(${enviarCarta.modalidad}, ${texto(enviarCarta.puertoOrigen)} -> ${texto(
              enviarCarta.puertoDestino ?? enviarCarta.destinoFinal
            )}).\n\n` +
            `Cualquier cambio debe confirmarse por escrito con customer service antes del cierre documental.\n\n` +
            `Saludos cordiales,\nMonsa Global Cargo`
          }
          onClose={() => setEnviarCarta(null)}
        />
      )}

      {mostrarForm && (
        <Modal
          titulo="Nuevo embarque"
          descripcion="Solo bookings CONFIRMADOS. El folio se asigna automaticamente al crearlo."
          onClose={() => setMostrarForm(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="Booking confirmado" requerido>
              <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)} required>
                <option value="">Selecciona un booking</option>
                {bookingsDisponibles?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.cotizacion.cliente.razonSocial} — {b.proveedor.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de operacion">
                <Select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value)}>
                  {TIPOS_OPERACION.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Modalidad">
                <Select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Shipper" requerido>
              <TextInput
                value={shipperNombre}
                onChange={(e) => setShipperNombre(e.target.value)}
                required
              />
            </Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button type="button" variante="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending}>
                Crear embarque
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Valorizacion: Ventas confirma costo y venta reales antes de facturar (gate 6).
// Muestra el estimado de la cotizacion al lado para comparar.
function ValorizacionModal({
  shipment,
  guardando,
  error,
  onClose,
  onConfirmar,
}: {
  shipment: Shipment;
  guardando: boolean;
  onClose: () => void;
  onConfirmar: (p: { valorizacionVenta: number; valorizacionCompra: number }) => void;
  error?: string | null;
}) {
  const est = shipment.booking?.cotizacion;
  const [venta, setVenta] = useState(numeroInput(shipment.valorizacionVenta ?? est?.montoVenta));
  const [compra, setCompra] = useState(numeroInput(shipment.valorizacionCompra ?? est?.montoCompra));
  return (
    <Modal
      titulo={`Valorizacion · ${shipment.folio}`}
      descripcion="Costo y venta reales confirmados por Ventas. Es el paso previo a poder facturar (gate 6)."
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (venta && compra) onConfirmar({ valorizacionVenta: Number(venta), valorizacionCompra: Number(compra) });
        }}
        className="space-y-3"
      >
        {error && <Aviso tono="error">{error}</Aviso>}
        {est && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            Estimado en la cotizacion: venta {texto(est.montoVenta ? String(est.montoVenta) : null)} ·
            compra {texto(est.montoCompra ? String(est.montoCompra) : null)} {est.moneda ?? ""}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Venta real" requerido>
            <TextInput
              type="number"
              step="0.01"
              value={venta}
              onChange={(e) => setVenta(e.target.value)}
              required
            />
          </Field>
          <Field label="Compra real" requerido>
            <TextInput
              type="number"
              step="0.01"
              value={compra}
              onChange={(e) => setCompra(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            Confirmar valorizacion
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Registro de una notificacion puntual al cliente (cutoff, ETD, ETA, aviso de
// arribo, solicitud de factura...). Alimenta el log del embarque.
function NotificacionModal({
  shipment,
  guardando,
  onClose,
  onRegistrar,
}: {
  shipment: Shipment;
  guardando: boolean;
  onClose: () => void;
  onRegistrar: (p: { tipo: string; comentario?: string }) => void;
}) {
  const [tipo, setTipo] = useState(TIPOS_NOTIFICACION[0]);
  const [comentario, setComentario] = useState("");
  return (
    <Modal
      titulo={`Notificar al cliente · ${shipment.folio}`}
      descripcion="Queda registrado en el log del embarque con la fecha y quien lo envio."
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onRegistrar({ tipo, comentario: comentario || undefined });
        }}
        className="space-y-3"
      >
        <Field label="Tipo de notificacion" requerido>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_NOTIFICACION.map((t) => (
              <option key={t} value={t}>
                {etiqueta(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Comentario">
          <TextInput value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </Field>
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
