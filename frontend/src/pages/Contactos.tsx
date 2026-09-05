import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, Plus, Ship, Tag, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { CascadeStepper } from "@/components/CascadeStepper";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { dinero, etiqueta, fecha, numeroInput, texto } from "@/lib/format";

// ---------------------------------------------------------------------------
// Modulo unico de terceros. Cliente y Proveedor siguen siendo entidades
// separadas en el backend; esto es solo una decision de UI para que el equipo
// tenga un unico lugar donde dar de alta terceros (CLAUDE.md seccion 4.3).
// ---------------------------------------------------------------------------

type Vista = "clientes" | "proveedores";

interface Cliente {
  id: string;
  razonSocial: string;
  alias?: string | null;
  rfc?: string | null;
  estatus: string;
  diasCredito?: number | null;
  limiteCredito?: string | number | null;
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  contactoTel?: string | null;
  // Datos fiscales del receptor: se copian a la Factura al emitirla (CLAUDE.md
  // seccion 5.3).
  regimenFiscal?: string | null;
  usoCfdi?: string | null;
  codigoPostal?: string | null;
  creadoEn?: string;
  actualizadoEn?: string;
}

interface Tarifa {
  id: string;
  origen: string;
  destino: string;
  modalidad: string;
  montoCompra: string | number;
  moneda?: string;
  vigenteDesde?: string;
  vigenteHasta?: string | null;
}

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
  estatus: string;
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  contactoTel?: string | null;
  creadoEn?: string;
  tarifas: Tarifa[];
}

const TIPOS_PROVEEDOR = [
  "NAVIERA",
  "AEROLINEA",
  "COLOADER",
  "AGENTE_ADUANAL",
  "TRANSPORTISTA",
  "ALMACEN",
  "SEGURO",
  "OTRO",
];
const MODALIDADES = ["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"];

interface CatalogoSat {
  clave: string;
  descripcion: string;
}

export default function Contactos() {
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get("tipo") === "proveedores" ? "proveedores" : "clientes";
  const setVista = (v: Vista) => setParams(v === "proveedores" ? { tipo: "proveedores" } : {});

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contactos"
        icono={Users}
        distintivo="Paso 1 de 6"
        descripcion="Alta y homologacion de terceros. Un cliente opera en firme solo con KYC y credito aprobados; un proveedor, solo con al menos una tarifa vigente."
      />

      <CascadeStepper
        actual="contactos"
        nota="Sin un cliente ACTIVO no hay cotizacion en firme; sin un proveedor ACTIVO no hay booking."
      />

      <SegmentedControl<Vista>
        valor={vista}
        onChange={setVista}
        opciones={[
          { valor: "clientes", label: "Clientes", icono: Building2 },
          { valor: "proveedores", label: "Proveedores", icono: Ship },
        ]}
      />

      {vista === "clientes" ? <PanelClientes /> : <PanelProveedores />}
    </div>
  );
}

// --------------------------- Clientes ---------------------------

// Campos editables de un cliente. El estatus no esta: se mueve por el flujo de
// activacion (gate 1), no escribiendolo a mano — igual que en el backend.
// Regimen fiscal y uso CFDI salen de los catalogos oficiales del SAT
// (modules/catalogos-sat), importados por prisma/importarCatalogosSat.ts.
function camposCliente(regimenes: CatalogoSat[], usosCfdi: CatalogoSat[]): CampoFormulario[] {
  return [
    { nombre: "razonSocial", label: "Razon social", requerido: true, ancho: true },
    { nombre: "alias", label: "Alias" },
    { nombre: "rfc", label: "RFC" },
    { nombre: "contactoNombre", label: "Contacto" },
    { nombre: "contactoEmail", label: "Correo de contacto" },
    { nombre: "contactoTel", label: "Telefono" },
    { nombre: "limiteCredito", label: "Limite de credito (USD)", tipo: "numero", paso: "0.01" },
    {
      nombre: "diasCredito",
      label: "Dias de credito",
      tipo: "numero",
      paso: "1",
      hint: "Vacio = cliente de contado",
    },
    {
      nombre: "regimenFiscal",
      label: "Regimen fiscal",
      tipo: "select",
      opciones: regimenes.map((r) => ({ valor: r.clave, label: `${r.clave} — ${r.descripcion}` })),
      hint: "Para el CFDI al facturar",
    },
    {
      nombre: "usoCfdi",
      label: "Uso CFDI",
      tipo: "select",
      opciones: usosCfdi.map((u) => ({ valor: u.clave, label: `${u.clave} — ${u.descripcion}` })),
    },
    { nombre: "codigoPostal", label: "Codigo postal (domicilio fiscal)" },
  ];
}

function PanelClientes() {
  const qc = useQueryClient();
  const [razonSocial, setRazonSocial] = useState("");
  const [activar, setActivar] = useState<Cliente | null>(null);
  const [ver, setVer] = useState<Cliente | null>(null);
  const [editar, setEditar] = useState<Cliente | null>(null);
  const [rfc, setRfc] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");
  const [diasCredito, setDiasCredito] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await api.get<Cliente[]>("/clientes")).data,
  });
  const { data: regimenes } = useQuery({
    queryKey: ["catalogos-sat", "regimen-fiscal"],
    queryFn: async () => (await api.get<CatalogoSat[]>("/catalogos-sat/regimen-fiscal")).data,
  });
  const { data: usosCfdi } = useQuery({
    queryKey: ["catalogos-sat", "uso-cfdi"],
    queryFn: async () => (await api.get<CatalogoSat[]>("/catalogos-sat/uso-cfdi")).data,
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["clientes"] });

  const crear = useMutation({
    mutationFn: async () => api.post("/clientes", { razonSocial }),
    onSuccess: () => {
      setRazonSocial("");
      refrescar();
    },
  });

  const activarCliente = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/clientes/${id}/activar`, {
        rfc,
        limiteCredito: Number(limiteCredito),
        diasCredito: Number(diasCredito),
      }),
    onSuccess: () => {
      setActivar(null);
      setRfc("");
      setLimiteCredito("");
      setDiasCredito("");
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo activar el cliente")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/clientes/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const gruposDetalle = (c: Cliente): GrupoDetalle[] => [
    {
      titulo: "Identificacion",
      campos: [
        { label: "Razon social", valor: c.razonSocial, ancho: true },
        { label: "Alias", valor: texto(c.alias) },
        { label: "RFC", valor: texto(c.rfc) },
        { label: "Estatus", valor: <StatusBadge status={c.estatus} /> },
        { label: "ID interno", valor: <span className="text-xs text-slate-400">{c.id}</span> },
      ],
    },
    {
      titulo: "Credito",
      campos: [
        {
          label: "Limite de credito",
          valor: c.limiteCredito != null ? dinero(c.limiteCredito) : "—",
        },
        {
          label: "Dias de credito",
          valor: c.diasCredito != null ? `${c.diasCredito} dias` : "De contado",
        },
      ],
    },
    {
      titulo: "Contacto",
      campos: [
        { label: "Nombre", valor: texto(c.contactoNombre) },
        { label: "Telefono", valor: texto(c.contactoTel) },
        { label: "Correo", valor: texto(c.contactoEmail), ancho: true },
      ],
    },
    {
      titulo: "Datos fiscales (CFDI)",
      campos: [
        { label: "Regimen fiscal", valor: texto(c.regimenFiscal) },
        { label: "Uso CFDI", valor: texto(c.usoCfdi) },
        { label: "Codigo postal", valor: texto(c.codigoPostal) },
      ],
    },
    {
      titulo: "Trazabilidad",
      campos: [
        { label: "Alta", valor: fecha(c.creadoEn) },
        { label: "Ultima actualizacion", valor: fecha(c.actualizadoEn) },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (razonSocial.trim()) crear.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="min-w-[16rem] flex-1">
          <Field label="Alta rapida de prospecto">
            <TextInput
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Razon social"
            />
          </Field>
        </div>
        <Button type="submit" icono={Plus} disabled={crear.isPending}>
          Agregar prospecto
        </Button>
      </form>

      <DataTable<Cliente>
        keyExtractor={(c) => c.id}
        filas={clientes}
        cargando={isLoading}
        vacioMensaje="Sin clientes todavia"
        onVer={setVer}
        onEditar={(c) => {
          setErrorEdicion(null);
          setEditar(c);
        }}
        accionesExtra={[
          {
            clave: "activar",
            label: "Activar (KYC)",
            icono: BadgeCheck,
            tono: "acento",
            oculta: (c) => c.estatus === "ACTIVO",
            onClick: (c) => {
              setError(null);
              setRfc(c.rfc ?? "");
              setLimiteCredito(numeroInput(c.limiteCredito));
              setDiasCredito(numeroInput(c.diasCredito));
              setActivar(c);
            },
          },
        ]}
        columnas={[
          {
            header: "Razon social",
            render: (c) => (
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">{c.razonSocial}</p>
                {c.alias && <p className="text-xs text-slate-400">{c.alias}</p>}
              </div>
            ),
          },
          { header: "RFC", render: (c) => texto(c.rfc) },
          {
            header: "Credito",
            render: (c) =>
              c.diasCredito != null ? (
                <span className="tabular text-slate-600 dark:text-slate-300">
                  {c.diasCredito} d · {dinero(c.limiteCredito ?? 0)}
                </span>
              ) : (
                <span className="text-slate-400">De contado</span>
              ),
          },
          { header: "Estatus", render: (c) => <StatusBadge status={c.estatus} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.razonSocial}
          subtitulo={<StatusBadge status={ver.estatus} />}
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            <Button
              variante="secondary"
              onClick={() => {
                setEditar(ver);
                setVer(null);
              }}
            >
              Editar cliente
            </Button>
          }
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar ${editar.razonSocial}`}
          descripcion="El estatus del cliente no se edita aqui: se mueve al completar el KYC (gate 1)."
          campos={camposCliente(regimenes ?? [], usosCfdi ?? [])}
          valores={{
            razonSocial: editar.razonSocial,
            alias: editar.alias ?? "",
            rfc: editar.rfc ?? "",
            contactoNombre: editar.contactoNombre ?? "",
            contactoEmail: editar.contactoEmail ?? "",
            contactoTel: editar.contactoTel ?? "",
            limiteCredito: numeroInput(editar.limiteCredito),
            diasCredito: numeroInput(editar.diasCredito),
            regimenFiscal: editar.regimenFiscal ?? "",
            usoCfdi: editar.usoCfdi ?? "",
            codigoPostal: editar.codigoPostal ?? "",
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {activar && (
        <Modal
          titulo={`Activar ${activar.razonSocial}`}
          descripcion="Completa el KYC minimo para desbloquear cotizaciones en firme (gate 1)."
          onClose={() => setActivar(null)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              activarCliente.mutate(activar.id);
            }}
            className="space-y-3"
          >
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="RFC" requerido>
              <TextInput value={rfc} onChange={(e) => setRfc(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Limite de credito (USD)" requerido>
                <TextInput
                  type="number"
                  step="0.01"
                  value={limiteCredito}
                  onChange={(e) => setLimiteCredito(e.target.value)}
                  required
                />
              </Field>
              <Field label="Dias de credito" requerido>
                <TextInput
                  type="number"
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button type="button" variante="ghost" onClick={() => setActivar(null)}>
                Cancelar
              </Button>
              <Button type="submit" icono={BadgeCheck} disabled={activarCliente.isPending}>
                Activar cliente
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// --------------------------- Proveedores ---------------------------

const CAMPOS_PROVEEDOR: CampoFormulario[] = [
  { nombre: "nombre", label: "Nombre", requerido: true, ancho: true },
  {
    nombre: "tipo",
    label: "Tipo",
    tipo: "select",
    requerido: true,
    opciones: TIPOS_PROVEEDOR.map((t) => ({ valor: t, label: t.replaceAll("_", " ") })),
  },
  { nombre: "contactoNombre", label: "Contacto" },
  { nombre: "contactoEmail", label: "Correo de contacto" },
  { nombre: "contactoTel", label: "Telefono" },
];

function PanelProveedores() {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS_PROVEEDOR[0]);
  const [tarifaDe, setTarifaDe] = useState<Proveedor | null>(null);
  const [ver, setVer] = useState<Proveedor | null>(null);
  const [editar, setEditar] = useState<Proveedor | null>(null);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [modalidad, setModalidad] = useState(MODALIDADES[0]);
  const [montoCompra, setMontoCompra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await api.get<Proveedor[]>("/proveedores")).data,
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["proveedores"] });

  const crear = useMutation({
    mutationFn: async () => api.post("/proveedores", { nombre, tipo }),
    onSuccess: () => {
      setNombre("");
      refrescar();
    },
  });

  const agregarTarifa = useMutation({
    mutationFn: async (id: string) =>
      api.post(`/proveedores/${id}/tarifas`, {
        origen,
        destino,
        modalidad,
        montoCompra: Number(montoCompra),
        moneda: "USD",
        vigenteDesde: new Date().toISOString(),
      }),
    onSuccess: () => {
      setTarifaDe(null);
      setOrigen("");
      setDestino("");
      setMontoCompra("");
      refrescar();
    },
  });

  const activar = useMutation({
    mutationFn: async (id: string) => api.patch(`/proveedores/${id}/activar`),
    onSuccess: () => {
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo activar el proveedor")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/proveedores/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const gruposDetalle = (p: Proveedor): GrupoDetalle[] => [
    {
      titulo: "Identificacion",
      campos: [
        { label: "Nombre", valor: p.nombre, ancho: true },
        { label: "Tipo", valor: etiqueta(p.tipo) },
        { label: "Estatus", valor: <StatusBadge status={p.estatus} /> },
        { label: "Alta", valor: fecha(p.creadoEn) },
        { label: "ID interno", valor: <span className="text-xs text-slate-400">{p.id}</span> },
      ],
    },
    {
      titulo: "Contacto",
      campos: [
        { label: "Nombre", valor: texto(p.contactoNombre) },
        { label: "Telefono", valor: texto(p.contactoTel) },
        { label: "Correo", valor: texto(p.contactoEmail), ancho: true },
      ],
    },
    {
      titulo: `Tarifas vigentes (${p.tarifas?.length ?? 0})`,
      campos: p.tarifas?.length
        ? p.tarifas.map((t) => ({
            label: `${t.origen} → ${t.destino}`,
            valor: `${t.modalidad} · ${dinero(t.montoCompra, t.moneda ?? "USD")}`,
            ancho: true,
          }))
        : [
            {
              label: "Sin tarifas",
              valor: "Carga al menos una tarifa para poder activar este proveedor (gate 4).",
              ancho: true,
            },
          ],
    },
  ];

  return (
    <div className="space-y-4">
      {error && <Aviso tono="error">{error}</Aviso>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (nombre.trim()) crear.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="min-w-[14rem] flex-1">
          <Field label="Nombre">
            <TextInput
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. HAPAG-LLOYD"
            />
          </Field>
        </div>
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PROVEEDOR.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" icono={Plus} disabled={crear.isPending}>
          Agregar proveedor
        </Button>
      </form>

      <DataTable<Proveedor>
        keyExtractor={(p) => p.id}
        filas={proveedores}
        cargando={isLoading}
        vacioMensaje="Sin proveedores todavia"
        onVer={setVer}
        onEditar={(p) => {
          setErrorEdicion(null);
          setEditar(p);
        }}
        accionesExtra={[
          {
            clave: "tarifa",
            label: "Agregar tarifa",
            icono: Tag,
            onClick: setTarifaDe,
          },
          {
            clave: "activar",
            label: "Activar proveedor",
            icono: BadgeCheck,
            tono: "acento",
            oculta: (p) => p.estatus === "ACTIVO",
            deshabilitada: (p) =>
              p.tarifas?.length
                ? null
                : "Sin tarifas cargadas. Un proveedor se activa solo con al menos una tarifa vigente (gate 4).",
            onClick: (p) => activar.mutate(p.id),
          },
        ]}
        renderDetalle={(p) =>
          p.tarifas?.length ? (
            <div className="space-y-1.5">
              <p className="text-etiqueta font-semibold uppercase text-slate-500">
                Tarifas vigentes
              </p>
              <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {p.tarifas.map((t) => (
                  <li key={t.id} className="tabular">
                    {t.origen} → {t.destino} · {t.modalidad} ·{" "}
                    <span className="font-medium text-slate-800 dark:text-slate-200">{dinero(t.montoCompra)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-amber-700">
              Sin tarifas. Carga al menos una para poder activar este proveedor.
            </p>
          )
        }
        columnas={[
          {
            header: "Nombre",
            render: (p) => <span className="font-medium text-slate-900 dark:text-slate-100">{p.nombre}</span>,
          },
          { header: "Tipo", render: (p) => etiqueta(p.tipo) },
          { header: "Tarifas", alinear: "der", render: (p) => p.tarifas?.length ?? 0 },
          { header: "Estatus", render: (p) => <StatusBadge status={p.estatus} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.nombre}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={ver.estatus} />
              <span className="text-xs text-slate-400">{etiqueta(ver.tipo)}</span>
            </span>
          }
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            <Button
              variante="secondary"
              onClick={() => {
                setEditar(ver);
                setVer(null);
              }}
            >
              Editar proveedor
            </Button>
          }
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar ${editar.nombre}`}
          descripcion="El estatus no se edita aqui: un proveedor pasa a ACTIVO cuando tiene tarifa vigente (gate 4)."
          campos={CAMPOS_PROVEEDOR}
          valores={{
            nombre: editar.nombre,
            tipo: editar.tipo,
            contactoNombre: editar.contactoNombre ?? "",
            contactoEmail: editar.contactoEmail ?? "",
            contactoTel: editar.contactoTel ?? "",
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {tarifaDe && (
        <Modal
          titulo={`Nueva tarifa · ${tarifaDe.nombre}`}
          descripcion="El proveedor se puede activar en cuanto tenga al menos una tarifa vigente."
          onClose={() => setTarifaDe(null)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              agregarTarifa.mutate(tarifaDe.id);
            }}
            className="space-y-3"
          >
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
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button type="button" variante="ghost" onClick={() => setTarifaDe(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={agregarTarifa.isPending}>
                Guardar tarifa
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
