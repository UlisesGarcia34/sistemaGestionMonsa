import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Field, TextArea, TextInput } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { api, mensajeError } from "@/lib/api";

interface EstadoCorreo {
  configurado: boolean;
  faltantes?: string[];
  remitente?: string;
}

interface EnviarCorreoModalProps {
  titulo: string;
  // Endpoint POST que hace el envio (el backend vuelve a correr el gate del
  // documento antes de mandar nada).
  endpoint: string;
  destinatarioInicial?: string | null;
  asuntoInicial: string;
  cuerpoInicial: string;
  onClose: () => void;
}

// Modal de confirmacion de envio: destinatario prellenado con el correo del
// cliente, asunto y cuerpo editables. Antes de habilitar el boton consulta si
// el SMTP esta configurado, para avisar de entrada en vez de dejar que el
// usuario descubra el problema al dar clic.
export function EnviarCorreoModal({
  titulo,
  endpoint,
  destinatarioInicial,
  asuntoInicial,
  cuerpoInicial,
  onClose,
}: EnviarCorreoModalProps) {
  const [para, setPara] = useState(destinatarioInicial ?? "");
  const [asunto, setAsunto] = useState(asuntoInicial);
  const [cuerpo, setCuerpo] = useState(cuerpoInicial);
  const [adjuntarPdf, setAdjuntarPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);

  const { data: estado } = useQuery({
    queryKey: ["reportes", "estado-correo"],
    queryFn: async () => (await api.get<EstadoCorreo>("/reportes/estado-correo")).data,
  });

  const enviar = useMutation({
    mutationFn: async () =>
      (await api.post<{ para: string }>(endpoint, { para, asunto, cuerpo, adjuntarPdf })).data,
    onSuccess: (data) => {
      setError(null);
      setEnviado(data.para);
    },
    onError: (e) => setError(mensajeError(e, "No se pudo enviar el correo")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (para.trim()) enviar.mutate();
  }

  if (enviado) {
    return (
      <Modal titulo="Correo enviado" onClose={onClose} maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
            <Check size={16} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden />
            El documento se envio a <strong className="font-semibold">{enviado}</strong>.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const smtpApagado = estado && !estado.configurado;

  return (
    <Modal
      titulo={titulo}
      descripcion="Revisa el destinatario y el mensaje antes de enviar. El documento va adjunto en PDF."
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {smtpApagado && (
          <Aviso tono="bloqueo">
            El envio de correo no esta configurado en este servidor. Falta definir{" "}
            <strong className="font-semibold">{estado?.faltantes?.join(", ")}</strong> en{" "}
            <code className="rounded bg-amber-100 px-1">backend/.env</code>. Puedes descargar el
            PDF e enviarlo manualmente mientras tanto.
          </Aviso>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}

        <Field label="Para" requerido>
          <TextInput
            type="email"
            value={para}
            onChange={(e) => setPara(e.target.value)}
            placeholder="contacto@cliente.com"
            required
          />
        </Field>

        <Field label="Asunto" requerido>
          <TextInput value={asunto} onChange={(e) => setAsunto(e.target.value)} required />
        </Field>

        <Field label="Mensaje" requerido>
          <TextArea
            rows={7}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
          />
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={adjuntarPdf}
            onChange={(e) => setAdjuntarPdf(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30"
          />
          Adjuntar el documento en PDF
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variante="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icono={Send} disabled={enviar.isPending}>
            {enviar.isPending ? "Enviando..." : "Enviar por correo"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
