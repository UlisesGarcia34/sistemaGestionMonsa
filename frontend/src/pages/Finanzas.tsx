import { Banknote, FileSpreadsheet, HandCoins, Receipt, Wallet } from "lucide-react";
import { NavLink, useParams } from "react-router-dom";
import { CascadeStepper } from "@/components/CascadeStepper";
import { PageHeader } from "@/components/PageHeader";
import ComplementosPago from "@/pages/finanzas/ComplementosPago";
import CuentasPorCobrar from "@/pages/finanzas/CuentasPorCobrar";
import CuentasPorPagar from "@/pages/finanzas/CuentasPorPagar";
import FacturacionPanel from "@/pages/finanzas/FacturacionPanel";

// Modulo Finanzas: un solo modulo coherente con 4 submodulos y navegacion
// interna. Sustituye al modulo suelto "Facturacion" (CLAUDE.md seccion 4.4).
const SUBMODULOS = [
  { slug: "cuentas-por-pagar", label: "Cuentas por pagar", icono: HandCoins },
  { slug: "cuentas-por-cobrar", label: "Cuentas por cobrar", icono: Banknote },
  { slug: "facturacion", label: "Facturacion", icono: Receipt },
  { slug: "complementos-pago", label: "Complementos de pago", icono: Wallet },
] as const;

export default function Finanzas() {
  const { submodulo } = useParams();
  const activo = SUBMODULOS.find((s) => s.slug === submodulo)?.slug ?? "cuentas-por-pagar";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Finanzas"
        icono={FileSpreadsheet}
        distintivo="Paso 6 de 6"
        descripcion="Cuentas por pagar a proveedores, cuentas por cobrar a clientes y emision de facturas — el cierre de la cascada operativa."
      />

      <CascadeStepper
        actual="finanzas"
        nota="Una factura FINAL exige embarque cerrado (gate 7) y valorizacion confirmada (gate 6); nace junto con su cuenta por cobrar. Una proforma se pide antes, durante el seguimiento."
      />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-6">
          {SUBMODULOS.map((s) => (
            <NavLink
              key={s.slug}
              to={`/finanzas/${s.slug}`}
              className={() =>
                `flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
                  activo === s.slug
                    ? "border-navy text-navy-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`
              }
            >
              <s.icono size={15} strokeWidth={1.9} aria-hidden />
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {activo === "cuentas-por-pagar" && <CuentasPorPagar />}
      {activo === "cuentas-por-cobrar" && <CuentasPorCobrar />}
      {activo === "facturacion" && <FacturacionPanel />}
      {activo === "complementos-pago" && <ComplementosPago />}
    </div>
  );
}
