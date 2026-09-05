import {
  Banknote,
  CalendarCheck,
  Check,
  ClipboardList,
  FileText,
  Info,
  Ship,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

// Los pasos de la cascada operativa (CLAUDE.md seccion 2), en orden. El Routing
// Order vive dentro de la pagina de Cotizaciones pero es un paso propio: es el
// gate 3 (un booking no se crea sin el Routing Order del cliente RECIBIDO).
export const PASOS_CASCADA = [
  { clave: "contactos", label: "Contactos", to: "/contactos", icono: Users },
  { clave: "cotizaciones", label: "Cotizacion", to: "/cotizaciones", icono: FileText },
  { clave: "routing-order", label: "Routing Order", to: "/cotizaciones", icono: ClipboardList },
  { clave: "bookings", label: "Booking", to: "/bookings", icono: CalendarCheck },
  { clave: "embarques", label: "Embarque", to: "/embarques", icono: Ship },
  { clave: "finanzas", label: "Finanzas", to: "/finanzas", icono: Banknote },
] as const;

type ClavePaso = (typeof PASOS_CASCADA)[number]["clave"];

interface CascadeStepperProps {
  actual: ClavePaso;
  // Texto corto que explica que hace falta para avanzar al siguiente paso.
  nota?: string;
}

// Refuerza visualmente en que paso de la cascada esta parado el usuario y que
// pasos ya quedaron atras. No sustituye a los gates del backend: los acompana.
export function CascadeStepper({ actual, nota }: CascadeStepperProps) {
  const idxActual = PASOS_CASCADA.findIndex((p) => p.clave === actual);

  return (
    <div className="no-imprimir overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-tarjeta dark:border-slate-800 dark:bg-slate-900">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 text-xs font-medium">
        {PASOS_CASCADA.map((paso, i) => {
          const completado = i < idxActual;
          const esActual = i === idxActual;
          return (
            <li key={paso.clave} className="flex items-center gap-1">
              <Link
                to={paso.to}
                aria-current={esActual ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 transition-colors ${
                  esActual
                    ? "bg-navy text-white shadow-tarjeta"
                    : completado
                      ? "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/40 dark:text-teal-300 dark:hover:bg-teal-900/60"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    esActual
                      ? "bg-white/20 text-white"
                      : completado
                        ? "bg-teal-500 text-white"
                        : "bg-white text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {completado ? (
                    <Check size={11} strokeWidth={3} aria-hidden />
                  ) : (
                    <paso.icono size={11} strokeWidth={2.2} aria-hidden />
                  )}
                </span>
                {paso.label}
              </Link>
              {i < PASOS_CASCADA.length - 1 && (
                <span
                  className={`h-px w-4 ${completado ? "bg-teal-300 dark:bg-teal-700" : "bg-slate-200 dark:bg-slate-700"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      {nota && (
        <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
          <Info size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          {nota}
        </p>
      )}
    </div>
  );
}
