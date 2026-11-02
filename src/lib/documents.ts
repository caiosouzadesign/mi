import type { DocumentKind, SignatureStatus } from "@/db/schema";
import type { ContractStage } from "./contract";

export const KIND_LABEL: Record<DocumentKind, string> = {
  contrato: "Contrato",
  aditivo: "Aditivo",
  vistoria: "Vistoria",
  outro: "Documento",
};

export const SIGNATURE_LABEL: Record<SignatureStatus, string | null> = {
  none: null,
  pending: "Aguardando assinatura",
  signed: "Assinado",
  refused: "Recusado",
};

export const STAGE_LABEL: Record<ContractStage, string> = {
  ativo: "Em vigor",
  atencao: "Termina em breve",
  urgente: "Termina este mês",
  vencido: "Encerrado",
};
