import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { Field, Select, TextInput } from "@/components/Field";
import { CampoFormulario, FormularioEdicion } from "@/components/FormularioEdicion";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { dinero, etiqueta, fecha, fechaInput, texto } from "@/lib/format";

// Modulo Pricing: catalogo transversal de las tarifas de compra (buy rates).
// El modelo Tarifa y su gate (proveedor ACTIVO exige >= 1 tarifa vigente) ya
// existian; esto es el lugar para verlas y mantenerlas todas juntas.

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
  estatus: string;
}

interface Tarifa {
  id: string;
  proveedorId: string;
  origen: string;
  destino: string;
  modalidad: string;
  tipo: string;
  montoCompra: string | number;
  moneda: string;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  vigente: boolean;
  proveedor: Proveedor;
}

const MODALIDADES = ["FCL", "LCL", "AEREO", "TERRESTRE", "FTL", "LTL", "SEGURO"];

// Tipo de tarifa negociada por Pricing (contrato / spot / basket).
const TIPOS_TARIFA = ["CONTRATO", "SPOT", "BASKET"];
const TONO_TIPO: Record<string, "teal" | "ambar" | "navy"> = {
  CONTRATO: "teal",
  SPOT: "ambar",
  BASKET: "navy",
};

// VIGENTE si hoy cae dentro de la vigencia; PROGRAMADA si aun no empieza;
// VENCIDA si ya termino. El backend ya manda `vigente`; el matiz PROGRAMADA se
// resuelve aqui con la fecha de inicio.
function estadoTarifa(t: Tarifa): string {
  if (t.vigente) return "VIGENTE";
  if (new Date(t.vigenteDesde) > new Date()) return "PROGRAMADA";
  return "VENCIDA";
}
const TONO_ESTADO: Record<string, "positivo" | "navy" | "rojo"> = {
  VIGENTE: "positivo",
  PROGRAMADA: "navy",
  VENCIDA: "rojo",
};

const CAMPOS_TARIFA: CampoFormulario[] = [
  { nombre: "origen", label: "Origen", requerido: true },
  { nombre: "destino", label: "Destino", requerido: true },
  {
    nombre: "modalidad",
    label: "Modalidad",
    tipo: "select",
    requerido: true,
    opciones: MODALIDADES.map((m) => ({ valor: m, label: m })),
  },
  {
    nombre: "tipo",
    label: "Tipo de tarifa",
    tipo: "select",
    requerido: true,
    opciones: TIPOS_TARIFA.map((t) => ({ valor: t, label: etiqueta(t) })),
  },
  { nombre: "montoCompra", label: "Monto de compra", tipo: "numero", paso: "0.01", requerido: true },
  { nombre: "moneda", label: "Moneda", requerido: true },
  { nombre: "vigenteDesde", label: "Vigente desde", tipo: "fecha", requerido: true },
  { nombre: "vigenteHasta", label: "Vigente hasta", tipo: "fecha", hint: "Vacio = tarifa abierta" },
];

export default function Pricing() {
  const qc = useQueryClient();
  const [proveedorId, setProveedorId] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [tipo, setTipo] = useState("");
  const [soloVigentes, setSoloVigentes] = useState(false);

  const [nueva, setNueva] = useState(false);
  const [editar, setEditar] = useState<Tarifa | null>(null);
  const [ver, setVer] = useState<Tarifa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  // Alta
  const [nProveedor, setNProveedor] = useState("");
  const [nOrigen, setNOrigen] = useState("");
  const [nDestino, setNDestino] = useState("");
  const [nModalidad, setNModalidad] = useState(MODALIDADES[0]);
  const [nTipo, setNTipo] = useState(TIPOS_TARIFA[0]);
  const [nMonto, setNMonto] = useState("");
  const [nMoneda, setNMoneda] = useState("USD");
  const [nDesde, setNDesde] = useState(fechaInput(new Date()));
  const [nHasta, setNHasta] = useState("");

  const { data: proveedores } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => (await api.get<Proveedor[]>("/proveedores")).data,
  });

  const filtros = { proveedorId, modalidad, tipo, soloVigentes };
  const { data: tarifas, isLoading } = useQuery({
    queryKey: ["tarifas", filtros],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (proveedorId) p.set("proveedorId", proveedorId);
      if (modalidad) p.set("modalidad", modalidad);
      if (tipo) p.set("tipo", tipo);
      if (soloVigentes) p.set("soloVigentes", "true");
      return (await api.get<Tarifa[]>(`/tarifas?${p.toString()}`)).data;
    },
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["tarifas"] });
    qc.invalidateQueries({ queryKey: ["proveedores"] });
  };

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/tarifas", {
        proveedorId: nProveedor,
        origen: nOrigen,
        destino: nDestino,
        modalidad: nModalidad,
        tipo: nTipo,
        montoCompra: Number(nMonto),
        moneda: nMoneda,
        vigenteDesde: nDesde,
        vigenteHasta: nHasta || null,
      }),
    onSuccess: () => {
      setNueva(false);
      setError(null);
      setNProveedor("");
      setNOrigen("");
      setNDestino("");
      setNMonto("");
      setNHasta("");
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo crear la tarifa")),
  });

  const guardar = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      api.patch(`/tarifas/${editar!.id}`, payload),
    onSuccess: () => {
      setEditar(null);
      setErrorEdicion(null);
      refrescar();
    },
    onError: (e) => setErrorEdicion(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/tarifas/${id}`),
    onSuccess: () => {
      setError(null);
      refrescar();
    },
    onError: (e) => setError(mensajeError(e, "No se pudo eliminar la tarifa")),
  });

  const gruposDetalle = (t: Tarifa): GrupoDetalle[] => [
    {
      titulo: "Tarifa",
      campos: [
        { label: "Proveedor", valor: t.proveedor?.nombre, ancho: true },
        { label: "Tipo de proveedor", valor: etiqueta(t.proveedor?.tipo) },
        { label: "Ruta", valor: `${t.origen} → ${t.destino}`, ancho: true },
        { label: "Modalidad", valor: t.modalidad },
        { label: "Tipo de tarifa", valor: <StatusBadge status={t.tipo} tono={TONO_TIPO[t.tipo]} /> },
        { label: "Monto de compra", valor: dinero(t.montoCompra, t.moneda) },
        { label: "Estado", valor: <StatusBadge status={estadoTarifa(t)} tono={TONO_ESTADO[estadoTarifa(t)]} /> },
      ],
    },
    {
      titulo: "Vigencia",
      campos: [
        { label: "Desde", valor: fecha(t.vigenteDesde) },
        { label: "Hasta", valor: t.vigenteHasta ? fecha(t.vigenteHasta) : "Abierta" },
      ],
    },
  ];

  const opcionesProveedor = useMemo(
    () => (proveedores ?? []).map((p) => ({ id: p.id, label: p.nombre })),
    [proveedores]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Pricing"
        icono={Tags}
        distintivo="Referencia"
        descripcion="Catalogo de tarifas de compra por proveedor y ruta. Una tarifa vigente es lo que habilita activar un proveedor (gate 4) y sostiene el margen de la cotizacion."
        accion={
          <Button icono={Plus} onClick={() => setNueva(true)}>
            Nueva tarifa
          </Button>
        }
      />

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-tarjeta dark:border-slate-800 dark:bg-slate-900">
        <Field label="Proveedor" className="min-w-[12rem]">
          <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Todos</option>
            {opcionesProveedor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Modalidad" className="min-w-[9rem]">
          <Select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
            <option value="">Todas</option>
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de tarifa" className="min-w-[9rem]">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_TARIFA.map((t) => (
              <option key={t} value={t}>
                {etiqueta(t)}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={soloVigentes}
            onChange={(e) => setSoloVigentes(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30"
          />
          Solo vigentes hoy
        </label>
      </div>

      <DataTable<Tarifa>
        keyExtractor={(t) => t.id}
        filas={tarifas}
        cargando={isLoading}
        vacioMensaje="Sin tarifas con estos filtros"
        onVer={setVer}
        onEditar={(t) => {
          setErrorEdicion(null);
          setEditar(t);
        }}
        accionesExtra={[
          {
            clave: "eliminar",
            label: "Eliminar tarifa",
            icono: Trash2,
            tono: "peligro",
            onClick: (t) => {
              if (
                window.confirm(
                  `Eliminar la tarifa ${t.origen} → ${t.destino} de ${t.proveedor?.nombre}?`
                )
              ) {
                eliminar.mutate(t.id);
              }
            },
          },
        ]}
        renderDetalle={(t) => (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Proveedor</dt>
              <dd className="text-slate-700 dark:text-slate-300">{t.proveedor?.nombre}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ruta</dt>
              <dd className="text-slate-700 dark:text-slate-300">
                {t.origen} → {t.destino}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Compra</dt>
              <dd className="text-slate-700 dark:text-slate-300">{dinero(t.montoCompra, t.moneda)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Vigencia</dt>
              <dd className="text-slate-700 dark:text-slate-300">
                {fecha(t.vigenteDesde)} — {t.vigenteHasta ? fecha(t.vigenteHasta) : "abierta"}
              </dd>
            </div>
          </dl>
        )}
        columnas={[
          {
            header: "Proveedor",
            render: (t) => (
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">{t.proveedor?.nombre}</p>
                <p className="text-xs text-slate-400">{etiqueta(t.proveedor?.tipo)}</p>
              </div>
            ),
          },
          {
            header: "Ruta",
            render: (t) => (
              <span className="text-slate-700 dark:text-slate-300">
                {t.origen} <span className="text-slate-400">→</span> {t.destino}
              </span>
            ),
          },
          { header: "Modalidad", render: (t) => t.modalidad },
          {
            header: "Tipo",
            render: (t) => <StatusBadge status={t.tipo} tono={TONO_TIPO[t.tipo]} />,
          },
          {
            header: "Compra",
            alinear: "der",
            render: (t) => dinero(t.montoCompra, t.moneda),
          },
          {
            header: "Vigencia",
            render: (t) => (
              <span className="tabular text-xs text-slate-500">
                {fecha(t.vigenteDesde)} — {t.vigenteHasta ? fecha(t.vigenteHasta) : "abierta"}
              </span>
            ),
          },
          {
            header: "Estado",
            render: (t) => (
              <StatusBadge status={estadoTarifa(t)} tono={TONO_ESTADO[estadoTarifa(t)]} />
            ),
          },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={`${ver.origen} → ${ver.destino}`}
          subtitulo={
            <span className="flex items-center gap-2">
              <StatusBadge status={estadoTarifa(ver)} tono={TONO_ESTADO[estadoTarifa(ver)]} />
              <span className="text-xs text-slate-400">{ver.proveedor?.nombre}</span>
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
              Editar tarifa
            </Button>
          }
        />
      )}

      {editar && (
        <FormularioEdicion
          titulo={`Editar tarifa · ${editar.proveedor?.nombre}`}
          descripcion="El proveedor no se reapunta: una tarifa pertenece a quien la cotiza."
          campos={CAMPOS_TARIFA}
          valores={{
            origen: editar.origen,
            destino: editar.destino,
            modalidad: editar.modalidad,
            tipo: editar.tipo,
            montoCompra: String(editar.montoCompra ?? ""),
            moneda: editar.moneda ?? "USD",
            vigenteDesde: fechaInput(editar.vigenteDesde),
            vigenteHasta: fechaInput(editar.vigenteHasta),
          }}
          error={errorEdicion}
          guardando={guardar.isPending}
          onClose={() => setEditar(null)}
          onGuardar={(payload) => guardar.mutate(payload)}
        />
      )}

      {nueva && (
        <Modal
          titulo="Nueva tarifa de compra"
          descripcion="Se registra contra un proveedor. Con al menos una tarifa vigente el proveedor ya se puede activar (gate 4)."
          onClose={() => setNueva(false)}
        >
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (nProveedor && nOrigen && nDestino && nMonto) crear.mutate();
            }}
            className="space-y-3"
          >
            {error && <Aviso tono="error">{error}</Aviso>}
            <Field label="Proveedor" requerido>
              <Select value={nProveedor} onChange={(e) => setNProveedor(e.target.value)} required>
                <option value="">Selecciona un proveedor</option>
                {opcionesProveedor.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Origen" requerido>
                <TextInput value={nOrigen} onChange={(e) => setNOrigen(e.target.value)} required />
              </Field>
              <Field label="Destino" requerido>
                <TextInput value={nDestino} onChange={(e) => setNDestino(e.target.value)} required />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Modalidad">
                <Select value={nModalidad} onChange={(e) => setNModalidad(e.target.value)}>
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de tarifa">
                <Select value={nTipo} onChange={(e) => setNTipo(e.target.value)}>
                  {TIPOS_TARIFA.map((t) => (
                    <option key={t} value={t}>
                      {etiqueta(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Moneda">
                <TextInput value={nMoneda} onChange={(e) => setNMoneda(e.target.value)} />
              </Field>
            </div>
            <Field label="Monto de compra" requerido>
              <TextInput
                type="number"
                step="0.01"
                value={nMonto}
                onChange={(e) => setNMonto(e.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vigente desde" requerido>
                <TextInput
                  type="date"
                  value={nDesde}
                  onChange={(e) => setNDesde(e.target.value)}
                  required
                />
              </Field>
              <Field label="Vigente hasta" hint="Vacio = abierta">
                <TextInput type="date" value={nHasta} onChange={(e) => setNHasta(e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button type="button" variante="ghost" onClick={() => setNueva(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={crear.isPending}>
                Guardar tarifa
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
