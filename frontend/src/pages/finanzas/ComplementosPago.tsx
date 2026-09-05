import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Send, Stamp, Wallet } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { CancelarCfdiModal } from "@/components/CancelarCfdiModal";
import { DataTable } from "@/components/DataTable";
import { DetalleDrawer, GrupoDetalle } from "@/components/DetalleDrawer";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { api, mensajeError } from "@/lib/api";
import { rutaVistaDocumento } from "@/lib/documentos";
import { Button } from "@/components/Button";
import { dinero, fecha, texto } from "@/lib/format";

interface ComplementoPago {
  id: string;
  folio: string;
  fechaPago: string;
  monto: string | number;
  moneda: string;
  tipoCambio?: string | number | null;
  formaPago: string;
  numOperacion?: string | null;
  saldoAnterior: string | number;
  saldoInsoluto: string | number;
  estatus: string;
  cfdiUuid?: string | null;
  fechaTimbrado?: string | null;
  motivoCancelacion?: string | null;
  fechaCancelacion?: string | null;
  factura: { numeroFactura: string; shipment: { folio: string; consignee: { razonSocial: string } } };
}

const TONO_ESTATUS: Record<string, "gris" | "ambar" | "positivo" | "rojo"> = {
  BORRADOR: "gris",
  PENDIENTE_TIMBRADO: "ambar",
  TIMBRADA: "positivo",
  CANCELADA: "rojo",
};

// Nacen solos: cxc.service.registrarCobro crea uno cuando el cobro es contra
// una factura FINAL + TIMBRADA + metodoPago PPD. Aqui solo se revisan y se
// mandan a timbrar (simulado) — no hay alta manual.
export default function ComplementosPago() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<ComplementoPago | null>(null);
  const [cancelar, setCancelar] = useState<ComplementoPago | null>(null);

  const { data: complementos, isLoading } = useQuery({
    queryKey: ["complementos-pago"],
    queryFn: async () => (await api.get<ComplementoPago[]>("/complementos-pago")).data,
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["complementos-pago"] });

  const enviarATimbrado = useMutation({
    mutationFn: async (id: string) => api.patch(`/complementos-pago/${id}/enviar-timbrado`),
    onSuccess: refrescar,
    onError: (e) => setError(mensajeError(e, "No se pudo enviar a timbrado")),
  });
  const timbrar = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/complementos-pago/${id}/timbrar`, { cfdiUuid: `SIMULADO-${id.slice(0, 8)}` }),
    onSuccess: refrescar,
    onError: (e) => setError(mensajeError(e, "No se pudo timbrar")),
  });
  const cancelarComplemento = useMutation({
    mutationFn: async (payload: { motivoCancelacion: string; folioSustitucionUuid?: string }) =>
      api.patch(`/complementos-pago/${cancelar!.id}/cancelar`, payload),
    onSuccess: () => {
      setCancelar(null);
      refrescar();
    },
  });

  const gruposDetalle = (c: ComplementoPago): GrupoDetalle[] => [
    {
      titulo: "Pago",
      campos: [
        { label: "Folio", valor: c.folio },
        { label: "Estatus", valor: <StatusBadge status={c.estatus} tono={TONO_ESTATUS[c.estatus]} /> },
        { label: "Fecha de pago", valor: fecha(c.fechaPago) },
        { label: "Monto", valor: dinero(c.monto, c.moneda) },
        { label: "Forma de pago", valor: c.formaPago },
        { label: "Num. de operacion", valor: texto(c.numOperacion) },
        { label: "Saldo anterior", valor: dinero(c.saldoAnterior, c.moneda) },
        { label: "Saldo insoluto", valor: dinero(c.saldoInsoluto, c.moneda) },
        { label: "UUID fiscal", valor: texto(c.cfdiUuid), ancho: true },
        ...(c.estatus === "CANCELADA"
          ? [
              { label: "Motivo de cancelacion", valor: texto(c.motivoCancelacion) },
              { label: "Fecha de cancelacion", valor: fecha(c.fechaCancelacion) },
            ]
          : []),
      ],
    },
    {
      titulo: "Factura relacionada",
      campos: [
        { label: "Folio", valor: c.factura.numeroFactura },
        { label: "Embarque", valor: c.factura.shipment.folio },
        { label: "Cliente", valor: c.factura.shipment.consignee.razonSocial, ancho: true },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Complementos de pago"
        icono={Wallet}
        descripcion="El REP de pagos. Nace solo al registrar un cobro contra una factura FINAL timbrada con metodo de pago PPD — no se da de alta a mano."
      />

      {error && <Aviso tono="error">{error}</Aviso>}

      <DataTable<ComplementoPago>
        keyExtractor={(c) => c.id}
        filas={complementos}
        cargando={isLoading}
        vacioMensaje="Sin complementos de pago todavia — nacen al registrar un cobro PPD."
        onVer={setVer}
        accionesExtra={[
          {
            clave: "enviar-timbrado",
            label: "Enviar a timbrado",
            icono: Send,
            tono: "acento",
            oculta: (c) => c.estatus !== "BORRADOR",
            onClick: (c) => enviarATimbrado.mutate(c.id),
          },
          {
            clave: "timbrar",
            label: "Timbrar (simulado)",
            icono: Stamp,
            tono: "acento",
            oculta: (c) => c.estatus === "TIMBRADA" || c.estatus === "CANCELADA",
            deshabilitada: (c) =>
              c.estatus === "BORRADOR" ? "Primero envialo a timbrado." : null,
            onClick: (c) => timbrar.mutate(c.id),
          },
          {
            clave: "cancelar",
            label: "Cancelar CFDI",
            icono: Ban,
            tono: "peligro",
            oculta: (c) => c.estatus !== "TIMBRADA",
            onClick: (c) => setCancelar(c),
          },
        ]}
        columnas={[
          { header: "Folio", render: (c) => <span className="font-medium text-slate-900">{c.folio}</span> },
          { header: "Factura", render: (c) => c.factura.numeroFactura },
          { header: "Cliente", render: (c) => c.factura.shipment.consignee.razonSocial },
          { header: "Fecha de pago", render: (c) => fecha(c.fechaPago) },
          { header: "Monto", alinear: "der", render: (c) => dinero(c.monto, c.moneda) },
          { header: "Estatus", render: (c) => <StatusBadge status={c.estatus} tono={TONO_ESTATUS[c.estatus]} /> },
        ]}
      />

      {ver && (
        <DetalleDrawer
          titulo={ver.folio}
          subtitulo={<StatusBadge status={ver.estatus} tono={TONO_ESTATUS[ver.estatus]} />}
          grupos={gruposDetalle(ver)}
          onClose={() => setVer(null)}
          acciones={
            <Button
              variante="secondary"
              onClick={() =>
                window.open(rutaVistaDocumento("complemento-pago", ver.id, "COMPLEMENTO_PAGO"), "_blank")
              }
            >
              Ver documento
            </Button>
          }
        />
      )}

      {cancelar && (
        <CancelarCfdiModal
          titulo="complemento de pago"
          folio={cancelar.folio}
          guardando={cancelarComplemento.isPending}
          error={cancelarComplemento.error}
          onCancelar={(payload) => cancelarComplemento.mutate(payload)}
          onClose={() => setCancelar(null)}
        />
      )}
    </div>
  );
}
