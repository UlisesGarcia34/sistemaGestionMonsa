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

const CLAVE_CORREO_RECORDADO = "mgc.correoRecordado";

export default function Login() {
  const { usuario, cargando, iniciarSesion } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(() => localStorage.getItem(CLAVE_CORREO_RECORDADO) ?? "");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(() => !!localStorage.getItem(CLAVE_CORREO_RECORDADO));
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
    if (recordar) localStorage.setItem(CLAVE_CORREO_RECORDADO, email);
    else localStorage.removeItem(CLAVE_CORREO_RECORDADO);
    try {
      await iniciarSesion(email, password);
    } catch (err) {
      setError(mensajeError(err, "No se pudo iniciar sesion"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#F4F6FB] p-4 sm:p-8 dark:bg-slate-950">
      {/* Fondo de puntos: la textura discreta del patron de referencia. */}
      <div
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(11,61,92,0.10)_1px,transparent_1px)] [background-size:22px_22px] dark:[background-image:radial-gradient(circle,rgba(148,163,184,0.08)_1px,transparent_1px)]"
        aria-hidden
      />

      {/* Una sola tarjeta unificada: las dos mitades comparten borde y sombra,
          sin separacion visible entre el panel de marca y el formulario. */}
      <div className="relative z-10 grid w-full max-w-[1500px] items-stretch overflow-hidden rounded-3xl shadow-panel lg:min-h-[640px] lg:grid-cols-2">
        {/* Panel de marca. Se oculta en pantallas chicas para dejar la tarjeta
            del formulario a ancho completo. */}
        <div className="relative hidden bg-navy text-white lg:flex lg:flex-col">
          <img
            src={puertoNavy}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-navy-950/55" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/55"
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

            {/* Tarjeta flotante sobre la foto, eco del panel de marca. */}
            <div className="mt-auto flex items-center gap-2.5 self-start rounded-2xl border border-white/10 bg-navy-950/60 px-4 py-3 shadow-lg backdrop-blur-sm">
              <ShieldCheck size={16} strokeWidth={2} className="shrink-0 text-teal-300" aria-hidden />
              <span className="text-xs leading-relaxed text-white/85">
                Acceso restringido al personal de Monsa Global Cargo.
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta del formulario. */}
        <div className="mx-auto flex w-full max-w-md flex-col bg-white p-8 sm:p-10 lg:max-w-none lg:border-l lg:border-slate-200/70 dark:bg-slate-900 dark:lg:border-slate-800">
          <img src={logoMonsa} alt="Monsa Global Cargo" className="h-16 w-auto self-start object-contain" />

          <span className="mt-7 block h-1 w-12 rounded-full bg-teal-500" aria-hidden />
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-navy-800 dark:text-white">
            Bienvenidos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Ingresa con tu cuenta de Monsa Global Cargo para continuar.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300"
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

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
              />
              Recordarme
            </label>

            <Button
              type="submit"
              icono={LogIn}
              disabled={enviando}
              className="w-full justify-center rounded-xl py-3 text-[15px]"
            >
              {enviando ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-auto pt-10">
            <p className="border-t border-slate-100 pt-4 text-center text-xs leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Si no tienes acceso, pidele a administracion que te de de alta.
            </p>
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-4 flex shrink-0 items-center gap-1.5 text-center text-xs text-slate-400 dark:text-slate-600">
        <ShieldCheck size={13} strokeWidth={2} aria-hidden />© {new Date().getFullYear()} Monsa
        Global Cargo. Sistema interno de gestion.
      </p>
    </div>
  );
}
