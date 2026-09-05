import { CircleAlert, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import logoMonsa from "@/assets/LogoMonsaPNG.png";
import puertoNavy from "@/assets/puerto-navy.jpg";
import { Button } from "@/components/Button";
import { Field, TextInput } from "@/components/Field";
import { mensajeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// El recorrido completo del sistema que resume el panel de marca: la cascada
// operativa (CLAUDE.md seccion 2) con Pricing (seccion 4.5) y Operaciones
// (seccion 4.6) intercalados donde ocurren, para que la primera pantalla ya
// explique de que trata el sistema.
const FLUJO = [
  "Alta y homologacion de clientes y proveedores",
  "Pricing: tarifas de compra por proveedor y ruta",
  "Cotizacion con margen de venta vs compra",
  "Booking confirmado con el carrier",
  "Embarque con folio MGC26xxxxxx",
  "Operaciones: seguimiento de ETD/ETA, arribo y liberacion",
  "Facturacion, cobranza y pagos a proveedores",
];

export default function Login() {
  const { usuario, cargando, iniciarSesion } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  // Si ya hay sesion, se vuelve a donde el usuario queria ir antes del login.
  const destino = (location.state as { desde?: string } | null)?.desde ?? "/";
  if (!cargando && usuario) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesion"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#F4F6FB] px-4 py-10">
      {/* Fondo de puntos: la textura discreta del patron de referencia. */}
      <div
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(11,61,92,0.10)_1px,transparent_1px)] [background-size:22px_22px]"
        aria-hidden
      />

      <div className="relative z-10 grid w-full max-w-5xl items-stretch gap-6 lg:grid-cols-2">
        {/* Panel de marca. Se oculta en pantallas chicas para dejar la tarjeta
            del formulario a ancho completo. */}
        <div className="relative hidden overflow-hidden rounded-3xl bg-navy text-white shadow-panel lg:flex lg:flex-col">
          <img
            src={puertoNavy}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-navy-900/75" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/35 to-navy-900/70"
            aria-hidden
          />

          <div className="relative z-10 flex h-full flex-col p-10">
            <span className="h-1 w-12 rounded-full bg-amber-400" aria-hidden />

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Sistema de gestion operativa
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
              Toda la operatividad de Monsa Global Cargo en un solo flujo.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              Del alta del cliente a la cobranza: cotizacion con margen, pricing de tarifas,
              booking, embarque, seguimiento operativo y facturacion. Ningun paso avanza si el
              anterior no esta completo.
            </p>

            <ol className="mt-7 space-y-2.5">
              {FLUJO.map((paso, i) => (
                <li key={paso} className="flex items-start gap-3 text-sm leading-6 text-white/85">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white ring-1 ring-white/25">
                    {i + 1}
                  </span>
                  {paso}
                </li>
              ))}
            </ol>

            <p className="mt-auto flex items-center gap-2 pt-8 text-xs text-white/55">
              <ShieldCheck size={14} strokeWidth={2} aria-hidden />
              Acceso restringido al personal de Monsa Global Cargo.
            </p>
          </div>
        </div>

        {/* Tarjeta del formulario. */}
        <div className="mx-auto flex w-full max-w-md flex-col justify-center rounded-3xl border border-slate-200/70 bg-white p-8 shadow-panel sm:p-10 lg:max-w-none">
          <img
            src={logoMonsa}
            alt="Monsa Global Cargo"
            className="h-16 w-auto self-start object-contain"
          />

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-navy-800">Bienvenidos</h2>

          <form onSubmit={enviar} className="mt-7 space-y-4">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700"
              >
                <CircleAlert size={14} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <Field label="Correo" requerido>
              <div className="relative">
                <Mail
                  size={15}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@monsaglobalcargo.com"
                  autoComplete="username"
                  required
                  autoFocus
                  className="pl-9"
                />
              </div>
            </Field>

            <Field label="Contrasena" requerido>
              <div className="relative">
                <Lock
                  size={15}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <TextInput
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  aria-pressed={verPassword}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
                >
                  {verPassword ? (
                    <EyeOff size={16} strokeWidth={2} aria-hidden />
                  ) : (
                    <Eye size={16} strokeWidth={2} aria-hidden />
                  )}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              icono={LogIn}
              disabled={enviando}
              className="w-full justify-center rounded-xl py-3 text-[15px]"
            >
              {enviando ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            Si no tienes acceso, pidele a administracion que te de de alta.
          </p>
        </div>
      </div>
    </div>
  );
}
