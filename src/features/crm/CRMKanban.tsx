import React from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Process, User } from '../../types';
import {
  Search,
  Filter,
  Calendar,
  User as UserIcon,
  MapPin,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  DollarSign,
  CheckSquare,
  TrendingUp,
  UserCheck,
  GripVertical,
  Check,
  X,
  Inbox,
  Wallet,
  Hourglass,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CRMKanbanProps {
  processes: Process[];
  clients: User[];
  onUpdateStatus: (processId: number, newStatus: Process['status']) => void;
  onSelectProcess: (process: Process) => void;
  user?: User | null;
}

type Stage = {
  id: Process['status'];
  label: string;
  hint: string;
  dot: string;
  text: string;
  soft: string;
  border: string;
};

const ALL_COLUMNS: Stage[] = [
  { id: 'started', label: 'Iniciado', hint: 'Processos recém-abertos', dot: 'bg-blue-500', text: 'text-blue-400', soft: 'bg-blue-500/10', border: 'border-blue-500/40' },
  { id: 'waiting_payment', label: 'Aguard. Pagamento', hint: 'Esperando o cliente pagar', dot: 'bg-amber-500', text: 'text-amber-400', soft: 'bg-amber-500/10', border: 'border-amber-500/40' },
  { id: 'payment_confirmed', label: 'Pgto Confirmado', hint: 'Pagamento recebido', dot: 'bg-emerald-500', text: 'text-emerald-400', soft: 'bg-emerald-500/10', border: 'border-emerald-500/40' },
  { id: 'analyzing', label: 'Em Análise', hint: 'Documentos em análise', dot: 'bg-purple-500', text: 'text-purple-400', soft: 'bg-purple-500/10', border: 'border-purple-500/40' },
  { id: 'final_phase', label: 'Fase Final', hint: 'Últimos passos do processo', dot: 'bg-indigo-500', text: 'text-indigo-400', soft: 'bg-indigo-500/10', border: 'border-indigo-500/40' },
  { id: 'completed', label: 'Concluído', hint: 'Processos finalizados', dot: 'bg-zinc-500', text: 'text-zinc-400', soft: 'bg-zinc-500/10', border: 'border-zinc-500/40' },
];

// Etapas visíveis por perfil
const CONSULTANT_STAGE_IDS: Process['status'][] = ['started', 'waiting_payment', 'payment_confirmed', 'analyzing'];
const ANALYST_STAGE_IDS: Process['status'][] = ['analyzing', 'final_phase', 'completed'];

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function getDaysInStage(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function getInactivityColor(days: number): string {
  if (days >= 14) return 'text-red-400 bg-red-500/10';
  if (days >= 7) return 'text-amber-400 bg-amber-500/10';
  return 'text-emerald-400 bg-emerald-500/10';
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

function getScoreBar(score: number): string {
  if (score >= 75) return 'from-emerald-500 to-emerald-400';
  if (score >= 50) return 'from-amber-500 to-amber-400';
  return 'from-red-500 to-red-400';
}

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-400' },
  proof_received: { label: 'Comprovante', className: 'bg-amber-500/10 text-amber-400' },
};
const PAYMENT_BADGE_DEFAULT = { label: 'Pendente', className: 'bg-zinc-500/10 text-zinc-400' };

const StatChip: React.FC<{ icon: React.ElementType; label: string; value: number | string; tone: string }> = ({
  icon: Icon,
  label,
  value,
  tone,
}) => (
  <div className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] py-1 pl-1 pr-3">
    <div className={`flex h-7 w-7 items-center justify-center rounded-full ${tone}`}>
      <Icon size={14} />
    </div>
    <span className="text-sm font-black text-[var(--text-main)]">{value}</span>
    <span className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</span>
  </div>
);

export const CRMKanban: React.FC<CRMKanbanProps> = ({
  processes,
  clients,
  onUpdateStatus,
  onSelectProcess,
  user,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterConsultant, setFilterConsultant] = React.useState('');
  const [filterPayment, setFilterPayment] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'normal' | 'simplified'>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [bulkTarget, setBulkTarget] = React.useState<Process['status'] | ''>('');
  const [showFilters, setShowFilters] = React.useState(false);
  const [assigningId, setAssigningId] = React.useState<number | null>(null);
  const [moveTarget, setMoveTarget] = React.useState<Process | null>(null);
  // Status aplicado de imediato na tela enquanto o servidor confirma a mudança
  const [overrides, setOverrides] = React.useState<Record<number, Process['status']>>({});

  React.useEffect(() => {
    setOverrides({});
  }, [processes]);

  // Colunas visíveis de acordo com o perfil do usuário logado
  const COLUMNS = React.useMemo(() => {
    if (user?.role === 'consultant') {
      return ALL_COLUMNS.filter((c) => CONSULTANT_STAGE_IDS.includes(c.id));
    }
    if (user?.role === 'analyst') {
      return ALL_COLUMNS.filter((c) => ANALYST_STAGE_IDS.includes(c.id));
    }
    return ALL_COLUMNS; // supervisor e master veem tudo
  }, [user]);

  // Etapas permitidas para movimentação (restringe por perfil)
  const allowedStageIds = React.useMemo(() => COLUMNS.map((c) => c.id), [COLUMNS]);

  const moveProcess = (processId: number, newStatus: Process['status']) => {
    if (!allowedStageIds.includes(newStatus)) return;
    const current = processes.find((p) => p.id === processId);
    if (!current || (overrides[processId] ?? current.status) === newStatus) return;
    setOverrides((prev) => ({ ...prev, [processId]: newStatus }));
    // Se o servidor não confirmar, volta ao estado real
    window.setTimeout(() => {
      setOverrides((prev) => {
        if (prev[processId] !== newStatus) return prev;
        const next = { ...prev };
        delete next[processId];
        return next;
      });
    }, 6000);
    onUpdateStatus(processId, newStatus);
  };

  // Assumir processo: atribui o usuário logado ao processo
  const handleAssume = async (e: React.MouseEvent, processId: number) => {
    e.stopPropagation();
    if (!user) return;
    setAssigningId(processId);
    try {
      await fetch(`${API_URL}/api/processes/${processId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to_user_id: user.id,
          role: user.role,
          agency_id: user.agency_id,
          changed_by_user_id: user.id,
        }),
      });
      // Recarregar página para refletir atribuição visível para todos do grupo
      window.location.reload();
    } catch {
      // falha silenciosa — estado volta ao normal
    } finally {
      setAssigningId(null);
    }
  };

  const consultants = React.useMemo(
    () => Array.from(new Set(processes.map((p) => p.consultant_name).filter(Boolean))),
    [processes]
  );

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    moveProcess(parseInt(draggableId), destination.droppableId as Process['status']);
  };

  const filtered = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return processes
      .map((p) => (overrides[p.id] ? { ...p, status: overrides[p.id] } : p))
      .filter((p) => {
        const matchSearch =
          p.client_name?.toLowerCase().includes(term) ||
          p.visa_name?.toLowerCase().includes(term) ||
          p.id.toString().includes(searchTerm);
        const matchConsultant = !filterConsultant || p.consultant_name === filterConsultant;
        const matchPayment = !filterPayment || p.payment_status === filterPayment;
        const matchType =
          filterType === 'all' || (filterType === 'simplified' ? p.process_type === 'simplified' : p.process_type !== 'simplified');
        return matchSearch && matchConsultant && matchPayment && matchType;
      });
  }, [processes, overrides, searchTerm, filterConsultant, filterPayment, filterType]);

  const stats = React.useMemo(() => {
    const visible = filtered.filter((p) => allowedStageIds.includes(p.status));
    const open = visible.filter((p) => p.status !== 'completed');
    return {
      total: visible.length,
      proofs: visible.filter((p) => p.payment_status === 'proof_received').length,
      late: open.filter((p) => getDaysInStage(p.created_at) >= 14).length,
      completed: visible.length - open.length,
    };
  }, [filtered, allowedStageIds]);

  const getClientName = (process: Process) => {
    if (process.client_name) return process.client_name;
    const client = clients.find((c) => c.id === process.client_id);
    return client ? client.name : 'Cliente';
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkMove = () => {
    if (!bulkTarget) return;
    selectedIds.forEach((id) => moveProcess(id, bulkTarget as Process['status']));
    setSelectedIds(new Set());
    setBulkTarget('');
  };

  React.useEffect(() => {
    if (!moveTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoveTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveTarget]);

  const renderResponsible = (process: Process) => {
    const inAnalysis = process.status === 'analyzing' || process.status === 'final_phase' || process.status === 'completed';

    const rows = [
      { key: 'consultant', label: 'Consultor', name: process.consultant_name, icon: UserIcon, tone: 'text-emerald-400', canAssume: !inAnalysis && user?.role === 'consultant' },
      { key: 'analyst', label: 'Analista', name: process.analyst_name, icon: UserCheck, tone: 'text-purple-400', canAssume: inAnalysis && user?.role === 'analyst' },
    ];

    return (
      <div className="space-y-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)]/60 px-3 py-2">
        {rows.map(({ key, label, name, icon: Icon, tone, canAssume }) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <Icon size={13} className={`flex-shrink-0 ${tone}`} />
            <span className="font-semibold text-[var(--text-muted)]">{label}:</span>
            {name ? (
              <span title={name} className="min-w-0 flex-1 truncate font-bold text-[var(--text-main)]">{name}</span>
            ) : (
              <span className="min-w-0 flex-1 truncate italic text-[var(--text-muted)]">Não atribuído</span>
            )}
            {!name && canAssume && (
              <button
                onClick={(e) => handleAssume(e, process.id)}
                disabled={assigningId === process.id}
                className={`flex-shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-all disabled:opacity-50 ${
                  key === 'analyst'
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                {assigningId === process.id ? 'Assumindo…' : 'Assumir'}
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCard = (process: Process, index: number, column: Stage) => {
    const days = getDaysInStage(process.created_at);
    const score = getClientScore(process);
    const isSelected = selectedIds.has(process.id);
    const payment = PAYMENT_BADGE[process.payment_status ?? ''] ?? PAYMENT_BADGE_DEFAULT;
    const stageIndex = COLUMNS.findIndex((c) => c.id === process.status);
    const prevStage = stageIndex > 0 ? COLUMNS[stageIndex - 1] : null;
    const nextStage = stageIndex >= 0 && stageIndex < COLUMNS.length - 1 ? COLUMNS[stageIndex + 1] : null;
    const price = Number(process.plan_price) || 0;
    const clientName = getClientName(process);

    return (
      <Draggable key={process.id.toString()} draggableId={process.id.toString()} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onSelectProcess(process)}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 pl-5 shadow-sm transition-all hover:shadow-lg ${
              snapshot.isDragging
                ? 'border-emerald-500 shadow-2xl ring-2 ring-emerald-500/20'
                : isSelected
                ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                : 'border-[var(--border-color)] hover:border-emerald-500/30'
            }`}
          >
            <span className={`absolute bottom-0 left-0 top-0 w-1 ${column.dot}`} />

            {process.payment_status === 'proof_received' && (
              <div
                title="Comprovante recebido — conferir pagamento"
                className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-amber-500 shadow-lg"
              >
                <AlertCircle size={14} className="text-white" />
              </div>
            )}

            <div className="space-y-3.5">
              {/* Cliente */}
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={isSelected ? 'Desmarcar processo' : 'Selecionar processo'}
                  onClick={(e) => toggleSelect(process.id, e)}
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500 text-black'
                      : 'border-[var(--border-color)] bg-[var(--bg-input)] text-transparent hover:border-emerald-500/60'
                  }`}
                >
                  <Check size={12} strokeWidth={3} />
                </button>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] text-sm font-black text-emerald-400">
                  {clientName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 title={clientName} className="truncate text-sm font-bold text-[var(--text-main)] transition-colors group-hover:text-emerald-400">
                    {clientName}
                  </h4>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-muted)]">Processo #{process.id}</p>
                </div>
                <GripVertical size={16} className="mt-1 flex-shrink-0 text-[var(--text-muted)] opacity-40 group-hover:opacity-100" />
              </div>

              {/* Visto */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="max-w-[200px] truncate">{process.visa_name || 'Visto'}</span>
                </div>
                {process.process_type === 'simplified' && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                    Simplificado
                  </div>
                )}
              </div>

              {/* Responsáveis */}
              {renderResponsible(process)}

              {/* Score */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="flex items-center gap-1 text-[var(--text-muted)]">
                    <TrendingUp size={12} />
                    Score do cliente
                  </span>
                  <span className="font-black text-[var(--text-main)]">{score}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r transition-all ${getScoreBar(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>

              {/* Informações */}
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] pt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  <Calendar size={12} />
                  {new Date(process.created_at).toLocaleDateString('pt-BR')}
                </div>
                <div
                  title="Dias desde a criação do processo"
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${getInactivityColor(days)}`}
                >
                  <Clock size={11} />
                  {days}d
                </div>
                <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${payment.className}`}>
                  <DollarSign size={11} />
                  {payment.label}
                </div>
                {price > 0 && (
                  <span className="ml-auto text-[11px] font-black text-[var(--text-main)]">{currency.format(price)}</span>
                )}
              </div>

              {/* Mover */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={!prevStage}
                  title={prevStage ? `Voltar para ${prevStage.label}` : 'Primeira etapa'}
                  aria-label={prevStage ? `Voltar para ${prevStage.label}` : 'Primeira etapa'}
                  onClick={() => prevStage && moveProcess(process.id, prevStage.id)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-muted)] transition-all hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setMoveTarget(process)}
                  className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all hover:brightness-125 ${column.soft} ${column.border} ${column.text}`}
                >
                  <ChevronsUpDown size={14} className="flex-shrink-0" />
                  <span className="truncate">Mover para…</span>
                </button>
                <button
                  type="button"
                  disabled={!nextStage}
                  title={nextStage ? `Avançar para ${nextStage.label}` : 'Última etapa'}
                  aria-label={nextStage ? `Avançar para ${nextStage.label}` : 'Última etapa'}
                  onClick={() => nextStage && moveProcess(process.id, nextStage.id)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-muted)] transition-all hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const moveTargetCurrent = moveTarget ? filtered.find((p) => p.id === moveTarget.id) ?? moveTarget : null;

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--bg-main)]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]/30 px-4 py-4 lg:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl shadow-lg">
              <TrendingUp className="text-black" size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight">Pipeline de Processos</h2>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Arraste os cards entre as etapas ou use o botão “Mover para…”
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder="Buscar por cliente, visto ou nº..."
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] py-2.5 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/50 sm:w-72"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                showFilters
                  ? 'brand-gradient border-transparent text-black'
                  : 'border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Filter size={15} />
              Filtros
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div className="flex flex-wrap gap-2">
          <StatChip icon={Inbox} label="no pipeline" value={stats.total} tone="bg-blue-500/10 text-blue-400" />
          <StatChip icon={Wallet} label="comprovantes a conferir" value={stats.proofs} tone="bg-amber-500/10 text-amber-400" />
          <StatChip icon={Hourglass} label="parados há 14+ dias" value={stats.late} tone="bg-red-500/10 text-red-400" />
          <StatChip icon={Check} label="concluídos" value={stats.completed} tone="bg-emerald-500/10 text-emerald-400" />
        </div>

        {/* Filtros expandidos */}
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-wrap gap-3">
            <select
              value={filterConsultant}
              onChange={(e) => setFilterConsultant(e.target.value)}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos consultores</option>
              {consultants.map((c) => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos pagamentos</option>
              <option value="pending">Pendente</option>
              <option value="proof_received">Comprovante</option>
              <option value="confirmed">Confirmado</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'normal' | 'simplified')}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="all">Todos os tipos</option>
              <option value="normal">Normais</option>
              <option value="simplified">Simplificados</option>
            </select>
            <button
              onClick={() => { setFilterConsultant(''); setFilterPayment(''); setFilterType('all'); }}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs font-bold text-[var(--text-muted)] transition-all hover:text-[var(--text-main)]"
            >
              Limpar
            </button>
          </motion.div>
        )}

        {/* Ações em lote */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
          >
            <CheckSquare size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value as Process['status'])}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-1.5 text-xs outline-none"
            >
              <option value="">Mover para...</option>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button
              onClick={applyBulkMove}
              disabled={!bulkTarget}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-40"
            >
              Aplicar
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Cancelar
            </button>
          </motion.div>
        )}
      </div>

      {/* Quadro Kanban */}
      <div className="kanban-scroll min-h-0 min-w-0 flex-1 overflow-auto p-4 lg:p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex min-h-full gap-4">
            {COLUMNS.map((column) => {
              const columnProcesses = filtered.filter((p) => p.status === column.id);
              const total = columnProcesses.reduce((sum, p) => sum + (Number(p.plan_price) || 0), 0);
              return (
                <div
                  key={column.id}
                  className="flex min-w-[320px] flex-1 flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]/40"
                >
                  <div className={`h-1 flex-shrink-0 rounded-t-2xl ${column.dot}`} />
                  <div className="flex-shrink-0 border-b border-[var(--border-color)] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-black text-[var(--text-main)]">{column.label}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${column.soft} ${column.text}`}>
                        {columnProcesses.length}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-muted)]">
                      {total > 0 ? `${column.hint} • ${currency.format(total)}` : column.hint}
                    </p>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 space-y-3 rounded-b-2xl p-3 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {columnProcesses.map((process, index) => renderCard(process, index, column))}
                        {provided.placeholder}
                        {columnProcesses.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)]">
                            <Inbox size={22} className="opacity-60" />
                            <span className="text-xs font-semibold">Nenhum processo nesta etapa</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Seletor de etapa */}
      {createPortal(
        <AnimatePresence>
          {moveTargetCurrent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm"
              onClick={() => setMoveTarget(null)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Mover processo"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] p-5">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-[var(--text-main)]">Mover processo</h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">
                      #{moveTargetCurrent.id} • {getClientName(moveTargetCurrent)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={() => setMoveTarget(null)}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-[var(--text-main)]"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-2 p-4">
                  {COLUMNS.map((stage) => {
                    const isCurrent = stage.id === moveTargetCurrent.status;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => {
                          moveProcess(moveTargetCurrent.id, stage.id);
                          setMoveTarget(null);
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                          isCurrent
                            ? `${stage.soft} ${stage.border} cursor-default`
                            : 'border-[var(--border-color)] bg-[var(--bg-input)] hover:border-emerald-500/40 hover:brightness-110'
                        }`}
                      >
                        <span className={`h-3 w-3 flex-shrink-0 rounded-full ${stage.dot}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[var(--text-main)]">{stage.label}</span>
                          <span className="block truncate text-[11px] font-medium text-[var(--text-muted)]">{stage.hint}</span>
                        </span>
                        {isCurrent ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${stage.text}`}>Etapa atual</span>
                        ) : (
                          <ChevronRight size={16} className="flex-shrink-0 text-[var(--text-muted)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
