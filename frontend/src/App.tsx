import { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth";
import Dashboard from "@/pages/Dashboard";
import Contactos from "@/pages/Contactos";
import Cotizaciones from "@/pages/Cotizaciones";
import Bookings from "@/pages/Bookings";
import Embarques from "@/pages/Embarques";
import Operaciones from "@/pages/Operaciones";
import Finanzas from "@/pages/Finanzas";
import Login from "@/pages/Login";
import Pricing from "@/pages/Pricing";
import Reportes from "@/pages/Reportes";
import VistaDocumento from "@/pages/reportes/VistaDocumento";

// Envuelve todo lo que exige sesion. Mientras se valida el token guardado se
// muestra un estado neutro: mandar al login antes de resolver haria que un
// simple refresh pareciera un cierre de sesion.
function RutaProtegida({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lienzo text-sm text-slate-400 dark:bg-slate-950 dark:text-slate-500">
        Validando sesion...
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  }
  return <>{children}</>;
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-lienzo dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Vista imprimible de un documento: va protegida pero SIN el layout de
          la app, para que al imprimir la hoja no arrastre el sidebar. */}
      <Route
        path="/documentos/:entidad/:id/:tipo"
        element={
          <RutaProtegida>
            <VistaDocumento />
          </RutaProtegida>
        }
      />

      <Route
        path="*"
        element={
          <RutaProtegida>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/cotizaciones" element={<Cotizaciones />} />
                <Route path="/bookings" element={<Bookings />} />
                <Route path="/embarques" element={<Embarques />} />
                <Route path="/operaciones" element={<Operaciones />} />
                <Route path="/finanzas" element={<Finanzas />} />
                <Route path="/finanzas/:submodulo" element={<Finanzas />} />
                <Route path="/reportes" element={<Reportes />} />

                {/* Redirecciones desde las rutas previas a la fusion de modulos */}
                <Route path="/clientes" element={<Navigate to="/contactos" replace />} />
                <Route
                  path="/proveedores"
                  element={<Navigate to="/contactos?tipo=proveedores" replace />}
                />
                <Route path="/shipments" element={<Navigate to="/embarques" replace />} />
                <Route
                  path="/facturacion"
                  element={<Navigate to="/finanzas/facturacion" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </RutaProtegida>
        }
      />
    </Routes>
  );
}
