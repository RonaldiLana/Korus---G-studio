import { Process } from '../../types';

export const EMPTY_VALUE = '—';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

export function formatDate(value?: string | null): string {
  if (!value) return EMPTY_VALUE;
  const iso = ISO_DATE.exec(value);
  // Usa a parte da data diretamente para evitar deslocamento de fuso horário
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function formatAnswer(value: unknown, type?: string): string {
  if (!hasValue(value)) return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map((v) => formatAnswer(v)).join(', ');
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>).filter(hasValue).map(String);
    return parts.length > 0 ? parts.join(' — ') : EMPTY_VALUE;
  }
  const text = String(value);
  if (text === 'true') return 'Sim';
  if (text === 'false') return 'Não';
  if (type === 'date' || ISO_DATE.test(text)) return formatDate(text);
  return text;
}

export function getInitials(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const STAGE_META: Record<Process['status'], { label: string; className: string }> = {
  started: { label: 'Iniciado', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  waiting_payment: { label: 'Aguard. pagamento', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  payment_confirmed: { label: 'Pagamento confirmado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  analyzing: { label: 'Em análise', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  final_phase: { label: 'Fase final', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  completed: { label: 'Concluído', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export const FORM_STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: 'Não iniciado', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  in_progress: { label: 'Em andamento', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  submitted: { label: 'Enviado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  locked: { label: 'Finalizado', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

export const DOCUMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  uploaded: { label: 'Enviado', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved: { label: 'Aprovado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected: { label: 'Rejeitado', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export const PAYMENT_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pagamento pendente', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  proof_received: { label: 'Comprovante recebido', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  confirmed: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};
