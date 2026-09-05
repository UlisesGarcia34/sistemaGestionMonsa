import { NavLink } from "react-router-dom";
import logoMonsa from "@/assets/LogoMonsaTransparente.png";
import { GRUPOS_NAV } from "@/lib/navegacion";

// Sidebar minimalista: logo grande y centrado + navegacion agrupada. El orden
// de lib/navegacion.ts YA es el orden de la cascada operativa (CLAUDE.md
// seccion 2) -- no se numeran los pasos, el agrupado "Operacion"/
// "Administracion" y el orden dentro de cada grupo alcanzan para comunicar el
// flujo. La sesion (usuario + cerrar sesion) vive en el Topbar, no aqui.
export function Sidebar() {
  return (
    <aside className="no-imprimir sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex justify-center px-4 py-6">
        <img
          src={logoMonsa}
          alt="Monsa Global Cargo"
          className="h-20 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {GRUPOS_NAV.map((grupo, i) => (
          <div key={grupo.titulo ?? i}>
            {grupo.titulo && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {grupo.titulo}
              </p>
            )}
            <div className="space-y-0.5">
              {grupo.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <link.icono
                        size={16}
                        strokeWidth={2}
                        className={
                          isActive
                            ? "text-teal-600 dark:text-teal-300"
                            : "text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-400"
                        }
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{link.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500 dark:bg-teal-400" aria-hidden />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
