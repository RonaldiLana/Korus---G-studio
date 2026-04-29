import React from 'react';
import { Process } from '../../types';
import { Bell, AlertTriangle, Clock, CheckCircle, ChevronRight, Filter } from 'lucide-react';
import { motion } from 'motion/react';

interface CRMFollowUpProps {
  processes: Process[];
  onSelectProcess: (process: Process) => void;
}

const STATUS_LABELS: Record<string, string> = {
  started: 'Iniciado',
  waiting_payment: 'Aguard. Pagamento',
  payment_confirmed: 'Pgto Confirmado',
  analyzing: 'Em Análise',
  final_phase: 'Fase Final',
  completed: 'Concluído',
};

function getDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function getRiskScore(process: Process, days: number): 'high' | 'medium' | 'low' {
  if (days >= 21 && process.payment_status !== 'confirmed') return 'high';
  if (days >= 14) return 'medium';
  return 'low';
}

const RISK_CONFIG = {
  high: {
    label: 'Risco Alto',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  medium: {
    label: 'Risco Médio',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Risco Baixo',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
};

export const CRMFollowUp: React.FC<CRMFollowUpProps> = ({ processes, onSelectProcess }) => {
  const [inactivityThreshold, setInactivityThreshold] = React.useState(7);
  const [filterRisk, setFilterRisk] = React.useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [contacted, setContacted] = React.useState<Set<number>>(new Set());

  const inactiveProcesses = React.useMemo(() => {
    return processes
      .filter((p) => {
        if (p.status === 'completed') return false;
        const days = getDays(p.created_at);
        return days >= inactivityThreshold;
      })
      .map((p) => {
        const days = getDays(p.created_at);
        const risk = getRiskScore(p, days);
        return { ...p, days, risk };
      })
      .sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.risk] - riskOrder[b.risk] || b.days - a.days;
      });
  }, [processes, inactivityThreshold]);

  const filtered = filterRisk === 'all'
    ? inactiveProcesses
    : inactiveProcesses.filter((p) => p.risk === filterRisk);

  const highCount = inactiveProcesses.filter((p) => p.risk === 'high').length;
  const mediumCount = inactiveProcesses.filter((p) => p.risk === 'medium').length;

  const markContacted = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setContacted((prev) => new Set([...prev, id]));
    // Remove da lista após 2s (UX: feedback visual)
    setTimeout(() => {
      setContacted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Bell className="text-black" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Follow-up Inteligente</h2>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              {filtered.length} processo{filtered.length !== 1 ? 's' : ''} precisando de atenção
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl">
            <Clock size={14} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Inativo há mais de</span>
            <input
              type="number"
              min="1"
              max="90"
              value={inactivityThreshold}
              onChange={(e) => setInactivityThreshold(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-10 bg-transparent text-sm font-black text-[var(--text-main)] outline-none text-center"
            />
            <span className="text-xs text-[var(--text-muted)]">dias</span>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl">
            {(['all', 'high', 'medium', 'low'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterRisk === r
                    ? 'brand-gradient text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {r === 'all' ? 'Todos' : r === 'high' ? 'Alto' : r === 'medium' ? 'Médio' : 'Baixo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo de risco */}
      {inactiveProcesses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
            <p className="text-2xl font-black text-red-400">{highCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400/70 mt-0.5">Risco Alto</p>
          </div>
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center">
            <p className="text-2xl font-black text-amber-400">{mediumCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/70 mt-0.5">Risco Médio</p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
            <p className="text-2xl font-black text-emerald-400">{inactiveProcesses.length - highCount - mediumCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70 mt-0.5">Risco Baixo</p>
          </div>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 mx-auto bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-[var(--text-main)]">
            {processes.filter((p) => p.status !== 'completed').length === 0
              ? 'Nenhum processo em andamento'
              : `Nenhum processo inativo por mais de ${inactivityThreshold} dias`}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Todos os processos estão dentro do prazo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((process) => {
            const riskCfg = RISK_CONFIG[process.risk];
            const isContacted = contacted.has(process.id);

            return (
              <motion.div
                key={process.id}
                layout
                onClick={() => onSelectProcess(process)}
                className={`group p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-lg ${riskCfg.bg} ${riskCfg.border} hover:border-opacity-50`}
              >
                <div className="flex items-start gap-4">
                  {/* Indicador de risco */}
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-3 h-3 rounded-full ${riskCfg.dot} ${process.risk === 'high' ? 'animate-pulse' : ''}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[var(--text-main)] group-hover:text-emerald-400 transition-colors">
                          {process.client_name || `Cliente #${process.client_id}`}
                        </h3>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                          #{process.id} · {process.visa_name || 'Serviço'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${riskCfg.bg} ${riskCfg.color} border ${riskCfg.border}`}>
                          {riskCfg.label}
                        </span>
                        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-emerald-400 transition-all translate-x-0 group-hover:translate-x-1" />
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)]">
                        <Clock size={11} />
                        <span className={riskCfg.color}>{process.days} dias</span> sem avanço
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)]">
                        <AlertTriangle size={11} />
                        Etapa: {STATUS_LABELS[process.status]}
                      </div>
                      {process.consultant_name && (
                        <div className="text-[10px] font-bold text-[var(--text-muted)]">
                          Consultor: {process.consultant_name.split(' ')[0]}
                        </div>
                      )}
                    </div>

                    {/* Ação rápida */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={(e) => markContacted(process.id, e)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                          isContacted
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            : 'bg-[var(--bg-card)]/60 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-emerald-500/30'
                        }`}
                      >
                        {isContacted ? '✓ Contato Registrado' : 'Registrar Contato'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
