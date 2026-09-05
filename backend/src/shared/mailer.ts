import nodemailer, { Transporter } from "nodemailer";
import { ReglaDeNegocioError } from "@/shared/middleware/errorHandler";

// Envio de correo saliente (hoy solo la carta de instrucciones al cliente).
//
// NO hay credenciales en el repo ni un fallback silencioso a una cuenta de
// pruebas: si las variables SMTP no estan configuradas, el envio falla con un
// mensaje explicito que el frontend muestra tal cual. Preferimos un error
// legible a un "enviado" que en realidad no salio a ningun lado -- es
// exactamente la clase de fallo silencioso que el Excel original tenia.

interface ConfigSmtp {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

const VARIABLES = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];

function leerConfig(): ConfigSmtp | { faltantes: string[] } {
  const faltantes = VARIABLES.filter((v) => !process.env[v]?.trim());
  if (faltantes.length) return { faltantes };
  return {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER!,
    password: process.env.SMTP_PASSWORD!,
    from: process.env.SMTP_FROM!,
    // 465 = SMTPS implicito; 587/25 = STARTTLS, que nodemailer negocia solo.
    secure: Number(process.env.SMTP_PORT) === 465,
  };
}

// El frontend consulta esto para avisar de antemano que el envio no esta
// configurado, en vez de dejar al usuario descubrirlo al dar clic en Enviar.
export function correoConfigurado() {
  const config = leerConfig();
  if ("faltantes" in config) {
    return { configurado: false as const, faltantes: config.faltantes };
  }
  return { configurado: true as const, remitente: config.from };
}

let transporter: Transporter | null = null;

function obtenerTransporter(config: ConfigSmtp) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
  }
  return transporter;
}

export interface CorreoSaliente {
  para: string;
  copia?: string[];
  asunto: string;
  cuerpo: string;
  adjuntos?: { nombre: string; contenido: Buffer; tipo: string }[];
}

export async function enviarCorreo(correo: CorreoSaliente) {
  const config = leerConfig();
  if ("faltantes" in config) {
    throw new ReglaDeNegocioError(
      `Envio de correo no configurado. Falta definir ${config.faltantes.join(", ")} en backend/.env (ver .env.example).`,
      503
    );
  }

  try {
    const info = await obtenerTransporter(config).sendMail({
      from: config.from,
      to: correo.para,
      cc: correo.copia?.length ? correo.copia : undefined,
      subject: correo.asunto,
      text: correo.cuerpo,
      attachments: correo.adjuntos?.map((a) => ({
        filename: a.nombre,
        content: a.contenido,
        contentType: a.tipo,
      })),
    });
    return { enviado: true, messageId: info.messageId, para: correo.para };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    throw new ReglaDeNegocioError(`El servidor SMTP rechazo el envio: ${detalle}`, 502);
  }
}
