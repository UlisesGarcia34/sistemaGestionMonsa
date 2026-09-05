import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Button } from "@/components/Button";
import { Field, Select, TextInput } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { api, mensajeError } from "@/lib/api";

interface MotivoCancelacion {
  clave: string;
  descripcion: string;
  requiereFolioSustitucion: boolean;
}

interface Props {
  titulo: string;
  folio: string;
  avisoExtra?: string;
  guardando: boolean;
  error: unknown;
  onCancelar: (payload: { motivoCancelacion: string; folioSustitucionUuid?: string }) => void;
  onClose: () => void;
}

// Modal de cancelacion de CFDI, compartido por Factura y ComplementoPago
// (ambos son documentos fiscales con el mismo ciclo de cancelacion). El
// catalogo de motivos viene de GET /api/catalogos-sat/motivo-cancelacion
// (4 claves oficiales del SAT, ver backend/prisma/importarCatalogosSat.ts).
export function CancelarCfdiModal({
  titulo,
  folio,
  avisoExtra,
  guardando,
  error,
  onCancelar,
  onClose,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [folioSustitucionUuid, setFolioSustitucionUuid] = useState("");

  const { data: motivos } = useQuery({
    queryKey: ["catalogos-sat", "motivo-cancelacion"],
    queryFn: async () =>
      (await api.get<MotivoCancelacion[]>("/catalogos-sat/motivo-cancelacion")).data,
  });

  const motivoSeleccionado = motivos?.find((m) => m.clave === motivo);

  return (
    <Modal
      titulo={`Cancelar ${titulo} · ${folio}`}
      descripcion="La cancelacion queda registrada con motivo y fecha. No revierte cobros ya registrados: eso se revisa a mano en cartera."
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!motivo) return;
          onCancelar({ motivoCancelacion: motivo, folioSustitucionUuid: folioSustitucionUuid || undefined });
        }}
        className="space-y-3"
      >
        {!!error && <Aviso tono="error">{mensajeError(error, "No se pudo cancelar")}</Aviso>}
        {avisoExtra && <Aviso tono="bloqueo">{avisoExtra}</Aviso>}

        <Field label="Motivo de cancelacion (SAT)" requerido>
          <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
            <option value="">Selecciona un motivo</option>
            {motivos?.map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.clave} — {m.descripcion}
              </option>
            ))}
          </Select>
        </Field>

        {motivoSeleccionado?.requiereFolioSustitucion && (
          <Field
            label="UUID del CFDI que sustituye a este"
            hint="Obligatorio para este motivo"
            requerido
          >
            <TextInput
              value={folioSustitucionUuid}
              onChange={(e) => setFolioSustitucionUuid(e.target.value)}
              required
            />
          </Field>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variante="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" variante="danger" disabled={guardando || !motivo}>
            {guardando ? "Cancelando..." : "Cancelar CFDI"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
