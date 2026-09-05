import {
  Banknote,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  LucideIcon,
  Navigation,
  Ship,
  Tags,
  Users,
} from "lucide-react";

export interface EnlaceNav {
  to: string;
  label: string;
  icono: LucideIcon;
}

export interface GrupoNav {
  titulo: string | null;
  links: EnlaceNav[];
}

// Unica fuente de la navegacion: la usan Sidebar (menu) y Topbar (breadcrumb),
// para que ninguno de los dos se desincronice del otro. El orden de los
// grupos y de los links YA es el orden de la cascada operativa (CLAUDE.md
// seccion 2) -- por eso no se numeran los pasos, alcanza con el orden y el
// agrupado "Operacion" / "Administracion".
export const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: null,
    links: [{ to: "/", label: "Dashboard", icono: LayoutDashboard }],
  },
  {
    titulo: "Operacion",
    links: [
      { to: "/contactos", label: "Contactos", icono: Users },
      { to: "/pricing", label: "Pricing", icono: Tags },
      { to: "/cotizaciones", label: "Cotizaciones", icono: FileText },
      { to: "/bookings", label: "Bookings", icono: CalendarCheck },
      { to: "/embarques", label: "Embarques", icono: Ship },
      { to: "/operaciones", label: "Operaciones", icono: Navigation },
    ],
  },
  {
    titulo: "Administracion",
    links: [
      { to: "/finanzas", label: "Finanzas", icono: Banknote },
      { to: "/reportes", label: "Reportes", icono: FileText },
    ],
  },
];

// Para el breadcrumb del Topbar: dado un pathname, encuentra el link activo
// (por prefijo, asi /finanzas/facturacion resuelve a "Finanzas") y el titulo
// de su grupo.
export function enlaceActivo(pathname: string): { grupo: string | null; enlace: EnlaceNav } | null {
  let mejor: { grupo: string | null; enlace: EnlaceNav } | null = null;
  for (const grupo of GRUPOS_NAV) {
    for (const enlace of grupo.links) {
      const coincide =
        enlace.to === "/" ? pathname === "/" : pathname.startsWith(enlace.to);
      if (coincide && (!mejor || enlace.to.length > mejor.enlace.to.length)) {
        mejor = { grupo: grupo.titulo, enlace };
      }
    }
  }
  return mejor;
}
