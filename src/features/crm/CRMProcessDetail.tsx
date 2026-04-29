import React from 'react';
import { Process, User } from '../../types';
import {
  X,
  User as UserIcon,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CRMProcessDetailProps {
  process: Process | null;
  onClose: () => void;
}

function getDaysInStage(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function getClientScore(process: Process): number {
  let score = 50;
  if (process.payment_status === 'confirmed') score += 30;
  else if (process.payment_status === 'proof_received') score += 15;
  if (process.status === 'completed') score = 100;
  else if (process.status === 'final_phase') score += 15;
  else if (process.status === 'analyzing') score += 10;
  const days = getDaysInStage(process.created_at);
  if (days > 30) score -= 20;
  else if (days > 14) score -= 10;
  return Math.min(100, Math.max(0, score));
}

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'Alto Potencial';
  if (score >= 50) return 'Médio Potencial';
  return 'Atenção Necessária';
}

const STATUS_LABELS: Record<string, string> = {
  started: 'Iniciado',
  waiting_payment: 'Aguardando Pagamento',
  payment_confirmed: 'Pagamento Confirmado',
  analyzing: 'Em Análise',
  final_phase: 'Fase Final',
  completed: 'Concluído',
};

const INTERNAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  documents_requested: 'Docs Solicitados',
  reviewing: 'Em Revisão',
  submitted: 'Submetido',
  completed: 'Concluído',
};

const SectionTitle: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon size={14} className="text-emerald-400" />
    <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]/40 last:border-0">
    <span className="text-xs text-[var(--text-muted)]">{label}</span>
    <span className="text-xs font-bold text-[var(--text-main)]">{value || '—'}</span>
  </div>
);

export const CRMProcessDetail: React.FC<CRMProcessDetailProps> = ({ process, onClose }) => {
  if (!process) return null;

  const score = getClientScore(process);
  const days = getDaysInStage(process.created_at);

  return (
    <AnimatePresence>
      {process && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border-color)] z-50 flex flex-col shadow-2xl"
          >
            {/* Header do drawer */}
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)]/80">
              <div>
                <h2 className="text-lg font-black tracking-tighter">{process.client_name || 'Cliente'}</h2>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Processo #{process.id}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[var(--bg-input)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

              {/* 1. Score / Inteligência */}
              <div className="p-4 bg-[var(--bg-input)]/50 rounded-2xl border border-[var(--border-color)]">
                <SectionTitle icon={TrendingUp} title="Score do Cliente" />
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border-color)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke={score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="3"
                        strokeDasharray={`${(score / 100) * 87.96} 87.96`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${getScoreColor(score)}`}>
                      {score}
                    </span>
                  </div>
                  <div>
                    <p className={`text-sm font-black ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {days > 14
                        ? `⚠️ ${days} dias sem avanço — atenção necessária`
                        : `${days} dias nesta etapa`}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Dados do Cliente */}
              <div className="p-4 bg-[var(--bg-input)]/50 rounded-2xl border border-[var(--border-color)]">
                <SectionTitle icon={UserIcon} title="Dados do Cliente" />
                <InfoRow label="Cliente" value={process.client_name} />
                <InfoRow label="Tipo de Serviço" value={process.visa_name} />
                <InfoRow label="Destino" value={process.destination_name} />
                <InfoRow label="Consultor" value={process.consultant_name} />
                <InfoRow label="Analista" value={process.analyst_name} />
                <InfoRow label="Status Principal" value={STATUS_LABELS[process.status]} />
                <InfoRow label="Status Interno" value={INTERNAL_STATUS_LABELS[process.internal_status]} />
                <InfoRow
                  label="Data de Criação"
                  value={new Date(process.created_at).toLocaleDateString('pt-BR')}
                />
                {process.travel_date && (
                  <InfoRow
                    label="Data de Viagem"
                    value={new Date(process.travel_date).toLocaleDateString('pt-BR')}
                  />
                )}
              </div>

              {/* 3. Financeiro */}
              <div className="p-4 bg-[var(--bg-input)]/50 rounded-2xl border border-[var(--border-color)]">
                <SectionTitle icon={DollarSign} title="Financeiro" />
                <div className="flex items-center gap-3">
                  {process.payment_status === 'confirmed' ? (
                    <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                  ) : process.payment_status === 'proof_received' ? (
                    <AlertCircle size={18} className="text-amber-400 flex-shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-black text-[var(--text-main)]">
                      {process.payment_status === 'confirmed'
                        ? 'Pagamento Confirmado'
                        : process.payment_status === 'proof_received'
                        ? 'Comprovante Recebido — Pendente Validação'
                        : 'Pagamento Pendente'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {process.plan_name ? `Plano: ${process.plan_name}` : 'Plano não definido'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Formulários */}
              {process.process_forms && process.process_forms.length > 0 && (
                <div className="p-4 bg-[var(--bg-input)]/50 rounded-2xl border border-[var(--border-color)]">
                  <SectionTitle icon={FileText} title="Formulários" />
                  <div className="space-y-2">
                    {process.process_forms.map((form) => (
                      <div
                        key={form.id}
                        className="flex items-center justify-between p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]"
                      >
                        <div>
                          <p className="text-xs font-bold text-[var(--text-main)]">{form.form_title || `Formulário #${form.form_id}`}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {form.response_status === 'submitted'
                              ? 'Enviado'
                              : form.response_status === 'in_progress'
                              ? 'Em Progresso'
                              : 'Aberto'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {form.progress !== undefined && (
                            <div className="w-20 h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${form.progress}%` }}
                              />
                            </div>
                          )}
                          {form.progress !== undefined && (
                            <span className="text-[10px] font-bold text-emerald-400">{form.progress}%</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Dependentes */}
              {process.is_dependent && (
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <SectionTitle icon={UserIcon} title="Dependente" />
                  <p className="text-xs text-amber-400 font-bold">
                    Este processo é um dependente vinculado ao processo #{process.parent_process_id}
                  </p>
                </div>
              )}

              {/* 6. Metadados */}
              <div className="p-4 bg-[var(--bg-input)]/50 rounded-2xl border border-[var(--border-color)]">
                <SectionTitle icon={Clock} title="Linha do Tempo" />
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-[var(--text-main)]">Processo iniciado</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {new Date(process.created_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(process.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${process.status === 'completed' ? 'bg-emerald-500' : 'bg-[var(--border-color)]'}`} />
                    <div>
                      <p className="text-xs font-bold text-[var(--text-main)]">
                        Etapa atual: {STATUS_LABELS[process.status]}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{days} dia{days !== 1 ? 's' : ''} nesta etapa</p>
                    </div>
                  </div>
                  {process.finished_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-400">Processo concluído</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {new Date(process.finished_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card)]/80">
              <button
                onClick={onClose}
                className="w-full py-3 bg-[var(--bg-input)] hover:bg-[var(--bg-input)]/80 border border-[var(--border-color)] rounded-xl text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all flex items-center justify-center gap-2"
              >
                <X size={16} />
                Fechar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
