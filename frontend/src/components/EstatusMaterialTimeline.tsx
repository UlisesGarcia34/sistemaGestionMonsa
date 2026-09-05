import {
  Anchor,
  CheckCircle2,
  LucideIcon,
  PackageCheck,
  PackagePlus,
  Ship,
  Truck,
  Warehouse,
} from "lucide-react";
import { texto } from "@/lib/format";

// Etapas del estatus del material. El dato se guarda como texto libre
// (Shipment.estatusMaterial String?), esto es solo el control visual: define
// una progresion estandar y deja "Detalle / otro" para los casos que no
// encajan (EN ADUANA, DEMORADO EN ORIGEN, etc.).
//
// Cada etapa tiene su propio icono y su propio tono (dentro de la paleta de
// marca: navy/teal/ambar/violeta, mas emerald reservado para el cierre
// exitoso, CLAUDE.md seccion 4.2.1) para que la progresion se lea de un
// vistazo sin depender solo del orden.
interface EtapaDef {
  nombre: string;
  icono: LucideIcon;
  tono: "navy" | "teal" | "ambar" | "violeta" | "positivo";
}

const ETAPAS_MARITIMO: EtapaDef[] = [
  { nombre: "POR ZARPAR", icono: Anchor, tono: "navy" },
  { nombre: "EN TRANSITO", icono: Ship, tono: "teal" },
  { nombre: "EN PUERTO", icono: Warehouse, tono: "ambar" },
  { nombre: "LIBERADO", icono: PackageCheck, tono: "violeta" },
  { nombre: "ENTREGADO", icono: CheckCircle2, tono: "positivo" },
];

const ETAPAS_TERRESTRE: EtapaDef[] = [
  { nombre: "POR CARGAR", icono: PackagePlus, tono: "navy" },
  { nombre: "EN TRANSITO", icono: Truck, tono: "teal" },
  { nombre: "ENTREGADO", icono: CheckCircle2, tono: "positivo" },
];

// Cada tono siempre se ve a color (nunca gris, ni siquiera pendiente): lo que
// cambia con el avance es la intensidad (tinte suave -> degradado solido con
// sombra a color) y no el matiz, para que las 5 etapas se distingan de un
// vistazo y el control se sienta vivo, no una lista de checkboxes.
const TONOS: Record<
  EtapaDef["tono"],
  { degradado: string; sombra: string; suave: string; anillo: string; texto: string; linea: string }
> = {
  navy: {
    degradado: "bg-gradient-to-br from-navy-400 to-navy-600",
    sombra: "shadow-navy-500/40",
    suave: "bg-navy-50 text-navy-500",
    anillo: "ring-navy-300",
    texto: "text-navy-700",
    linea: "bg-navy-400",
  },
  teal: {
    degradado: "bg-gradient-to-br from-teal-400 to-teal-600",
    sombra: "shadow-teal-500/40",
    suave: "bg-teal-50 text-teal-500",
    anillo: "ring-teal-300",
    texto: "text-teal-700",
    linea: "bg-teal-400",
  },
  ambar: {
    degradado: "bg-gradient-to-br from-amber-300 to-amber-500",
    sombra: "shadow-amber-500/40",
    suave: "bg-amber-50 text-amber-600",
    anillo: "ring-amber-300",
    texto: "text-amber-700",
    linea: "bg-amber-400",
  },
  violeta: {
    degradado: "bg-gradient-to-br from-violet-400 to-violet-600",
    sombra: "shadow-violet-500/40",
    suave: "bg-violet-50 text-violet-500",
    anillo: "ring-violet-300",
    texto: "text-violet-700",
    linea: "bg-violet-400",
  },
  positivo: {
    degradado: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    sombra: "shadow-emerald-500/40",
    suave: "bg-emerald-50 text-emerald-500",
    anillo: "ring-emerald-300",
    texto: "text-emerald-700",
    linea: "bg-emerald-400",
  },
};

function definicionEtapas(modalidad?: string | null): EtapaDef[] {
  return ["TERRESTRE", "FTL", "LTL"].includes((modalidad ?? "").toUpperCase())
    ? ETAPAS_TERRESTRE
    : ETAPAS_MARITIMO;
}

export function etapasPara(modalidad?: string | null): string[] {
  return definicionEtapas(modalidad).map((e) => e.nombre);
}

// Opciones para un <select> declarativo: las etapas estandar + el valor actual
// si es uno personalizado que no esta en la lista (para no perderlo al editar).
export function opcionesEstatusMaterial(modalidad?: string | null, actual?: string | null) {
  const etapas = etapasPara(modalidad);
  const norm = (actual ?? "").trim().toUpperCase();
  const lista = norm && !etapas.includes(norm) ? [norm, ...etapas] : etapas;
  return lista.map((e) => ({ valor: e, label: e }));
}

// Sugerencia derivada de las fechas: no cambia nada, solo orienta.
export function sugerenciaEtapa(s: {
  etd?: string | null;
  fechaArriboReal?: string | null;
  fechaLiberacion?: string | null;
}): string | null {
  if (s.fechaLiberacion) return "LIBERADO";
  if (s.fechaArriboReal) return "EN PUERTO";
  if (s.etd) return "EN TRANSITO";
  return null;
}

interface Props {
  modalidad?: string | null;
  valor?: string | null;
  onChange: (v: string) => void;
  sugerencia?: string | null;
}

export function EstatusMaterialTimeline({ modalidad, valor, onChange, sugerencia }: Props) {
  const etapas = definicionEtapas(modalidad);
  const norm = (valor ?? "").trim().toUpperCase();
  const idx = etapas.findIndex((e) => e.nombre === norm);
  const personalizado = !!norm && idx < 0;

  return (
    <div className="space-y-2">
      <div className="flex items-start">
        {etapas.map((etapa, i) => {
          const completado = idx >= 0 && i < idx;
          const actual = i === idx;
          const alcanzado = completado || actual;
          const tono = TONOS[etapa.tono];
          const Icono = etapa.icono;
          return (
            <div key={etapa.nombre} className={`flex items-center ${i === 0 ? "" : "flex-1"}`}>
              {i > 0 && (
                <span
                  className={`-mr-px h-1 flex-1 rounded-full transition-colors duration-300 ${
                    completado || actual ? tono.linea : "bg-slate-200"
                  }`}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onChange(etapa.nombre)}
                aria-current={actual ? "step" : undefined}
                title={etapa.nombre}
                className="group flex flex-col items-center gap-1.5 px-0.5"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    alcanzado
                      ? `${tono.degradado} text-white shadow-lg ${tono.sombra}`
                      : `${tono.suave} group-hover:brightness-95`
                  } ${actual ? `scale-110 ring-4 ring-offset-2 ${tono.anillo}` : "group-hover:scale-105"}`}
                >
                  <Icono size={17} strokeWidth={2.2} aria-hidden />
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] leading-none transition-colors ${
                    actual ? `font-semibold ${tono.texto}` : alcanzado ? "font-medium text-slate-600" : `font-medium ${tono.texto} opacity-70`
                  }`}
                >
                  {etapa.nombre}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {personalizado && (
        <p className="text-xs text-slate-500">
          Estatus personalizado: <span className="font-medium text-navy-700">{valor}</span>
        </p>
      )}
      {sugerencia && sugerencia !== norm && (
        <p className="text-xs text-amber-700">
          Sugerencia por las fechas capturadas: <span className="font-medium">{sugerencia}</span>
        </p>
      )}
    </div>
  );
}

// Version de solo lectura para tablas/detalle: icono de la etapa + etiqueta.
export function ProgresoMaterial({
  modalidad,
  valor,
}: {
  modalidad?: string | null;
  valor?: string | null;
}) {
  const etapas = definicionEtapas(modalidad);
  const idx = etapas.findIndex((e) => e.nombre === (valor ?? "").trim().toUpperCase());
  if (idx < 0) return <span className="text-slate-600">{texto(valor)}</span>;
  const etapa = etapas[idx];
  const tono = TONOS[etapa.tono];
  const Icono = etapa.icono;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${tono.suave}`}>
        <Icono size={11} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="font-medium text-navy-700">{etapa.nombre}</span>
      <span className="text-slate-400">
        · {idx + 1}/{etapas.length}
      </span>
    </span>
  );
}
