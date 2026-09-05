import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { DocumentoImprimible } from "@/components/DocumentoImprimible";
import { EnviarCorreoModal } from "@/components/EnviarCorreoModal";
import { abrirPdf, api, mensajeError } from "@/lib/api";
import {
  DocumentoRenderizable,
  EntidadDocumento,
  rutaApiDocumento,
  rutaPdfDocumento,
  tipoDesdeSlug,
} from "@/lib/documentos";

const ENTIDADES_VALIDAS: EntidadDocumento[] = ["booking", "shipment", "factura", "complemento-pago"];

// Vista de un documento a pantalla completa, fuera del layout de la app: la
// barra de acciones lleva .no-imprimir, asi que Ctrl+P (o el boton Imprimir)
// saca solo la hoja del documento.
export default function VistaDocumento() {
  const { entidad, id, tipo } = useParams();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);

  const tipoDoc = tipoDesdeSlug(tipo);
  const entidadDoc: EntidadDocumento = ENTIDADES_VALIDAS.includes(entidad as EntidadDocumento)
    ? (entidad as EntidadDocumento)
    : "shipment";

  const { data, isLoading, error } = useQuery({
    queryKey: ["documento", entidadDoc, id, tipoDoc],
    enabled: !!id && !!tipoDoc,
    retry: false,
    queryFn: async () =>
      (await api.get<DocumentoRenderizable>(rutaApiDocumento(entidadDoc, id!, tipoDoc!))).data,
  });

  if (!tipoDoc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Aviso tono="error">Tipo de documento desconocido: {tipo}</Aviso>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lienzo pb-16">
      <div className="no-imprimir sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Button variante="ghost" icono={ArrowLeft} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {data && tipoDoc === "CARTA_INSTRUCCIONES" && (
              <Button variante="secondary" icono={Send} onClick={() => setEnviando(true)}>
                Enviar por correo
              </Button>
            )}
            <Button
              variante="secondary"
              icono={Download}
              disabled={!data}
              onClick={() => abrirPdf(rutaPdfDocumento(entidadDoc, id!, tipoDoc))}
            >
              PDF
            </Button>
            <Button icono={Printer} disabled={!data} onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {isLoading && <p className="text-sm text-slate-400">Cargando documento...</p>}
        {error && (
          <Aviso tono="bloqueo">
            {mensajeError(error, "No se pudo generar el documento")}
          </Aviso>
        )}
        {data && <DocumentoImprimible documento={data} />}
      </div>

      {enviando && data && (
        <EnviarCorreoModal
          titulo="Enviar carta de instrucciones"
          endpoint={`/reportes/shipment/${id}/carta-instrucciones/enviar`}
          destinatarioInicial={data.destinatarioEmail}
          asuntoInicial={`Carta de instrucciones ${data.folio} — Monsa Global Cargo`}
          cuerpoInicial={
            `Estimado cliente:\n\n` +
            `Adjuntamos la carta de instrucciones del embarque ${data.folio}.\n` +
            `${data.subtitulo ?? ""}\n\n` +
            `Cualquier cambio debe confirmarse por escrito con customer service antes del cierre documental.\n\n` +
            `Saludos cordiales,\nMonsa Global Cargo`
          }
          onClose={() => setEnviando(false)}
        />
      )}
    </div>
  );
}
