import { LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes } from "react";
import { Tooltip } from "@/components/Tooltip";

type Variante = "primary" | "secondary" | "ghost" | "danger" | "sutil";
type Tamano = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  icono?: LucideIcon;
  // Motivo por el que el boton esta deshabilitado. Se muestra como tooltip:
  // un gate de la cascada siempre se explica en vez de ocultar la accion.
  motivoDeshabilitado?: string | null;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";

const variantes: Record<Variante, string> = {
  primary:
    "bg-navy text-white shadow-tarjeta hover:bg-navy-700 active:bg-navy-800 disabled:hover:bg-navy",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-tarjeta hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  sutil: "bg-teal-50 text-teal-700 hover:bg-teal-100",
  danger: "bg-rose-600 text-white shadow-tarjeta hover:bg-rose-700",
};

const tamanos: Record<Tamano, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function Button({
  variante = "primary",
  tamano = "md",
  icono: Icono,
  motivoDeshabilitado,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const boton = (
    <button
      className={`${base} ${variantes[variante]} ${tamanos[tamano]} ${className}`}
      {...props}
    >
      {Icono && <Icono size={tamano === "sm" ? 14 : 16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );

  // El tooltip solo tiene sentido cuando el boton esta efectivamente bloqueado.
  return props.disabled && motivoDeshabilitado ? (
    <Tooltip texto={motivoDeshabilitado}>{boton}</Tooltip>
  ) : (
    boton
  );
}
