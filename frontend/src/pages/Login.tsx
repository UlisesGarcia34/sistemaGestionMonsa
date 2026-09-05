import { CircleAlert, Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import logoMonsa from "@/assets/LogoMonsaPNG.png";
import puertoAtardecer from "@/assets/puerto-atardecer.png";
import { mensajeError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

  const inputClass =
    "h-[47px] w-full rounded-[10px] border border-[#b9c8db] bg-white pl-12 pr-4 text-[16px] text-[#10223d] shadow-[inset_0_1px_2px_rgba(11,61,92,0.035),0_0_0_1px_rgba(28,114,147,0.03)] outline-none transition placeholder:text-[#8ea0bb] focus:border-[#1c83b3] focus:ring-[3px] focus:ring-[#1c83b3]/10";

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f7fbff] text-[#0b1c36]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(40,98,137,0.13)_1px,transparent_1.25px)] [background-position:1px_1px] [background-size:24px_24px]"
      />

      <section className="relative z-10 mx-auto flex min-h-[100svh] w-full items-center justify-center px-4 py-16 sm:px-8 lg:px-0 lg:py-0">
        <div className="grid w-full max-w-[1544px] gap-4 lg:h-[min(798px,calc(100svh-143px))] lg:min-h-[680px] lg:w-[calc(100%-128px)] lg:grid-cols-[1.37fr_1fr]">
          <aside className="relative hidden overflow-hidden rounded-[23px] bg-[#05233b] text-white shadow-[0_18px_42px_-20px_rgba(6,46,74,0.38)] lg:block">
            <img
              src={puertoAtardecer}
              alt="Puerto de carga al atardecer"
              className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,28,48,0.78)_0%,rgba(3,28,48,0.56)_50%,rgba(3,28,48,0.23)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,30,50,0.45)_0%,rgba(4,30,50,0.06)_47%,rgba(4,30,50,0.30)_100%)]" />

            <div className="relative flex h-full flex-col px-[55px] py-[55px]">
              <span className="h-[5px] w-[60px] rounded-full bg-[#f5b638]" aria-hidden />

              <p className="mt-[27px] text-[14px] font-semibold uppercase tracking-[0.19em] text-[#ffc54a]">
                Sistema de gestion operativa
              </p>
              <h1 className="mt-[14px] text-[40px] font-bold leading-[1.14] tracking-[-0.025em] text-white">
                <span className="block">Toda la operatividad de</span>
                <span className="block">Monsa Global Cargo en</span>
                <span className="block">un solo flujo.</span>
              </h1>
              <p className="mt-[17px] text-[16px] leading-[1.42] text-white/90">
                <span className="block">Del alta del cliente a la cobranza: cotizacion con margen, pricing de</span>
                <span className="block">tarifas, booking, embarque, seguimiento operativo y facturacion. Ningun</span>
                <span className="block">paso avanza si el anterior no esta completo.</span>
              </p>

              <div className="mt-[24px] w-[452px] max-w-full rounded-[18px] border border-[#39a2d1]/60 bg-[#173d5b]/55 px-[26px] pb-[23px] pt-[22px] shadow-[0_12px_28px_rgba(2,21,36,0.20)] backdrop-blur-[9px]">
                <ol className="relative space-y-[4.5px] before:absolute before:bottom-[18px] before:left-[17px] before:top-[18px] before:w-px before:bg-white/30">
                  {FLUJO.map((paso, i) => (
                    <li key={paso} className="relative flex min-h-9 items-center gap-[20px] text-[13px] font-normal leading-[1.3] text-white/95">
                      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/20 to-[#237ca7]/45 text-[14px] font-medium text-white shadow-[0_2px_5px_rgba(1,19,32,0.22)]">
                        {i + 1}
                      </span>
                      <span>{paso}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-[18px] flex h-[52px] w-[411px] max-w-full items-center gap-[16px] rounded-[17px] border border-[#45a4d0]/55 bg-[#153a58]/65 px-[23px] shadow-[0_10px_24px_rgba(2,21,36,0.18)] backdrop-blur-[8px]">
                <ShieldCheck size={19} strokeWidth={1.8} className="shrink-0 text-[#56c7f1]" aria-hidden />
                <span className="text-[13px] leading-relaxed text-white/90">
                  Acceso restringido al personal de Monsa Global Cargo.
                </span>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] w-full flex-col rounded-[23px] bg-white px-6 py-10 shadow-[0_18px_44px_-22px_rgba(6,46,74,0.30)] sm:px-10 lg:min-h-0 lg:px-[42px] lg:py-[40px]">
            <img
              src={logoMonsa}
              alt="Monsa Global Cargo"
              className="h-[112px] w-[168px] object-contain object-left"
            />

            <span className="mt-[40px] block h-[5px] w-[61px] rounded-full bg-[#08799b]" aria-hidden />
            <h2 className="mt-[22px] text-[40px] font-bold leading-none tracking-[-0.025em] text-[#071a34]">
              Bienvenidos
            </h2>
            <p className="mt-[15px] text-[16px] leading-5 text-[#7387a7]">
              Ingresa con tu cuenta de Monsa Global Cargo para continuar.
            </p>

            <form onSubmit={enviar} className="mt-[44px]">
              {error && (
                <p
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] leading-relaxed text-rose-700"
                >
                  <CircleAlert size={15} strokeWidth={2} className="mt-px shrink-0" aria-hidden />
                  {error}
                </p>
              )}

              <label className="block">
                <span className="mb-[5px] block text-[15px] font-medium leading-5 text-[#132440]">
                  Correo <span className="text-[#f04444]">*</span>
                </span>
                <span className="relative block">
                  <Mail
                    size={20}
                    strokeWidth={1.8}
                    className="pointer-events-none absolute left-[17px] top-1/2 -translate-y-1/2 text-[#92a5bf]"
                    aria-hidden
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@monsaglobalcargo.com"
                    autoComplete="username"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </span>
              </label>

              <label className="mt-[22px] block">
                <span className="mb-[5px] block text-[15px] font-medium leading-5 text-[#132440]">
                  Contrasena <span className="text-[#f04444]">*</span>
                </span>
                <span className="relative block">
                  <LockKeyhole
                    size={20}
                    strokeWidth={1.8}
                    className="pointer-events-none absolute left-[17px] top-1/2 -translate-y-1/2 text-[#92a5bf]"
                    aria-hidden
                  />
                  <input
                    type={verPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((visible) => !visible)}
                    aria-label={verPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    aria-pressed={verPassword}
                    className="absolute right-[13px] top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8ca0bd] transition hover:text-[#40617e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c83b3]/25"
                  >
                    {verPassword ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
                  </button>
                </span>
              </label>

              <label className="mt-[27px] flex w-fit cursor-pointer items-center gap-[11px] text-[15px] text-[#1b2d49]">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="h-[23px] w-[23px] cursor-pointer rounded-[4px] border-[#8090a5] text-[#08799b] focus:ring-[#1c83b3]/25"
                />
                Recordarme
              </label>

              <button
                type="submit"
                disabled={enviando}
                className="mt-[29px] flex h-[56px] w-full items-center justify-center gap-[11px] rounded-[19px] bg-gradient-to-r from-[#075074] to-[#0b4668] text-[19px] font-semibold text-white shadow-[0_7px_15px_rgba(7,69,102,0.13)] transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1c83b3]/20 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <LogIn size={24} strokeWidth={2} aria-hidden />
                {enviando ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="mb-[14px] mt-auto border-t border-[#e2e8f0] pt-[22px]">
              <p className="text-center text-[13px] leading-5 text-[#8295b3]">
                Si no tienes acceso, pidelo a administracion que te de de alta.
              </p>
            </div>
          </section>
        </div>
      </section>

      <p className="absolute bottom-[35px] left-1/2 z-20 hidden -translate-x-1/2 items-center gap-[6px] whitespace-nowrap text-[12px] text-[#9aaac1] lg:flex">
        <ShieldCheck size={14} strokeWidth={1.8} aria-hidden />
        © {new Date().getFullYear()} Monsa Global Cargo. Sistema interno de gestion.
      </p>
    </main>
  );
}
