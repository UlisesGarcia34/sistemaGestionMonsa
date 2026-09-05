import { LogOut, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Tooltip } from "@/components/Tooltip";
import { etiquetaRol, useAuth } from "@/lib/auth";
import { enlaceActivo } from "@/lib/navegacion";
import { useTheme } from "@/lib/theme";

// Barra superior: breadcrumb del modulo activo a la izquierda, switch de
// tema + sesion (usuario + cerrar sesion) a la derecha. Antes la sesion vivia
// al fondo del Sidebar; aqui queda donde un usuario espera encontrarla.
export function Topbar() {
  const { usuario, cerrarSesion } = useAuth();
  const { tema, alternarTema } = useTheme();
  const { pathname } = useLocation();
  const activo = enlaceActivo(pathname);

  return (
    <header className="no-imprimir sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-sm">
        {activo?.grupo && (
          <>
            <span className="text-slate-400 dark:text-slate-500">{activo.grupo}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
          </>
        )}
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {activo?.enlace.label ?? "Monsa Global Cargo"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip texto={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
          <button
            type="button"
            onClick={alternarTema}
            aria-label="Cambiar tema"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {tema === "oscuro" ? (
              <Sun size={16} strokeWidth={2} aria-hidden />
            ) : (
              <Moon size={16} strokeWidth={2} aria-hidden />
            )}
          </button>
        </Tooltip>

        {usuario && (
          <>
            <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold uppercase text-white">
                {usuario.nombre.slice(0, 2)}
              </span>
              <div className="hidden min-w-0 leading-tight sm:block">
                <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                  {usuario.nombre}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {etiquetaRol(usuario.rol)}
                </p>
              </div>
            </div>
            <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <Tooltip texto="Cerrar sesion">
              <button
                type="button"
                onClick={cerrarSesion}
                aria-label="Cerrar sesion"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <LogOut size={16} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  );
}
