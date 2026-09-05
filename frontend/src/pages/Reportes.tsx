import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileCheck2,
  FileText,
  Files,
  Lock,
  Printer,
  Receipt,
  ScrollText,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso } from "@/components/Aviso";
import { DataTable } from "@/components/DataTable";
import { KpiCard } from "@/components/KpiCard";
import { PageHeader } from "@/components/PageHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusBadge } from "@/components/StatusBadge";
import { abrirPdf, api } from "@/lib/api";
import {
  DisponibilidadDocumento,
  TipoDocumento,
  rutaPdfDocumento,
  rutaVistaDocumento,
} from "@/lib/documentos";

type Filtro = "todos" | TipoDocumento;

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "CONFIRMACION_BOOKING", label: "Confirmaciones" },
  { valor: "CARTA_INSTRUCCIONES", label: "Cartas" },
  { valor: "HBL", label: "HBL" },
  { valor: "MBL", label: "MBL" },
  { valor: "FACTURA", label: "Facturas" },
  { valor: "COMPLEMENTO_PAGO", label: "Complementos de pago" },
];

const ICONO_TIPO: Record<TipoDocumento, typeof FileText> = {
  CONFIRMACION_BOOKING: FileCheck2,
  CARTA_INSTRUCCIONES: ScrollText,
  HBL: FileText,
  MBL: FileText,
  FACTURA: Receipt,
  COMPLEMENTO_PAGO: Wallet,
};

// Modulo de Reportes: catalogo de todo lo que el sistema puede emitir, con su
// disponibilidad segun la cascada. Una fila bloqueada NO se oculta: se muestra
// con el motivo, igual que el resto de los gates de la UI.
export default function Reportes() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["reportes", "catalogo"],
    queryFn: async () => (await api.get<DisponibilidadDocumento[]>("/reportes")).data,
  });

  const filas = useMemo(
    () => (filtro === "todos" ? documentos : documentos?.filter((d) => d.tipo === filtro)),
    [documentos, filtro]
  );

  const disponibles = documentos?.filter((d) => d.disponible).length ?? 0;
  const bloqueados = (documentos?.length ?? 0) - disponibles;
  const sinConocimiento =
    documentos?.filter((d) => (d.tipo === "HBL" || d.tipo === "MBL") && !d.disponible).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Reportes y documentos"
        icono={Files}
        descripcion="Confirmaciones de booking, cartas de instrucciones y conocimientos de embarque. Un documento solo se genera cuando el dato que representa ya existe en el sistema."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          etiqueta="Documentos generables"
          valor={disponibles}
          icono={FileCheck2}
          acento="teal"
          detalle="Listos para imprimir o descargar en PDF"
        />
        <KpiCard
          etiqueta="Bloqueados por la cascada"
          valor={bloqueados}
          icono={Lock}
          acento={bloqueados ? "amber" : "navy"}
          detalle="Falta completar el paso previo"
        />
        <KpiCard
          etiqueta="Sin HBL / MBL capturado"
          valor={sinConocimiento}
          icono={FileText}
          acento={sinConocimiento ? "amber" : "navy"}
          detalle="Capturalos desde el detalle del embarque"
          alerta={
            sinConocimiento
              ? `${sinConocimiento} conocimiento(s) sin numero`
              : null
          }
        />
        <KpiCard
          etiqueta="Total en catalogo"
          valor={documentos?.length ?? "—"}
          icono={Files}
          acento="navy"
          detalle="Documentos posibles sobre los registros actuales"
        />
      </div>

      <Aviso tono="info">
        Todos los documentos se imprimen directamente desde el navegador (boton{" "}
        <strong className="font-semibold">Imprimir</strong>) y ademas se pueden descargar en PDF.
        La carta de instrucciones se puede enviar por correo al cliente desde su propia vista.
      </Aviso>

      <SegmentedControl<Filtro> valor={filtro} onChange={setFiltro} opciones={FILTROS} />

      <DataTable<DisponibilidadDocumento>
        keyExtractor={(d) => `${d.tipo}-${d.entidadId}`}
        filas={filas}
        cargando={isLoading}
        vacioMensaje="Sin documentos en esta categoria"
        columnas={[
          {
            header: "Documento",
            render: (d) => {
              const Icono = ICONO_TIPO[d.tipo];
              return (
                <span className="flex items-center gap-2">
                  <Icono size={15} strokeWidth={1.9} className="shrink-0 text-slate-400" />
                  <span className="font-medium text-slate-900">{d.titulo}</span>
                </span>
              );
            },
          },
          { header: "Referencia", render: (d) => d.referencia },
          { header: "Cliente", render: (d) => d.cliente },
          {
            header: "Estado",
            render: (d) =>
              d.disponible ? (
                <StatusBadge status="DISPONIBLE" tono="positivo" />
              ) : (
                <StatusBadge status="BLOQUEADO" tono="ambar" />
              ),
          },
          {
            header: "Motivo del bloqueo",
            render: (d) => (
              <span className="text-xs text-slate-500">{d.motivoBloqueo ?? "—"}</span>
            ),
          },
        ]}
        accionesExtra={[
          {
            clave: "imprimir",
            label: "Abrir vista imprimible",
            icono: Printer,
            tono: "acento",
            deshabilitada: (d) => d.motivoBloqueo,
            onClick: (d) => navigate(rutaVistaDocumento(d.entidad, d.entidadId, d.tipo)),
          },
          {
            clave: "pdf",
            label: "Descargar PDF",
            icono: Download,
            deshabilitada: (d) => d.motivoBloqueo,
            onClick: (d) => abrirPdf(rutaPdfDocumento(d.entidad, d.entidadId, d.tipo)),
          },
        ]}
      />
    </div>
  );
}
