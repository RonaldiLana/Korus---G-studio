import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Process, User } from '../../types';
import {
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  User as UserIcon,
  MapPin,
  AlertCircle,
  ChevronRight,
  Clock,
  DollarSign,
  CheckSquare,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';

interface CRMKanbanProps {
  processes: Process[];
  clients: User[];
  onUpdateStatus: (processId: number, newStatus: Process['status']) => void;
  onSelectProcess: (process: Process) => void;
}

const COLUMNS: { id: Process['status']; label: string; color: string }[] = [
  { id: 'started', label: 'Iniciado', color: 'bg-blue-500' },
  { id: 'waiting_payment', label: 'Aguard. Pagamento', color: 'bg-amber-500' },
  { id: 'payment_confirmed', label: 'Pgto Confirmado', color: 'bg-emerald-500' },
  { id: 'analyzing', label: 'Em Análise', color: 'bg-purple-500' },
  { id: 'final_phase', label: 'Fase Final', color: 'bg-indigo-500' },
  { id: 'completed', label: 'Concluído', color: 'bg-zinc-500' },
];

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

export const CRMKanban: React.FC<CRMKanbanProps> = ({
  processes,
  clients,
  onUpdateStatus,
  onSelectProcess,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterConsultant, setFilterConsultant] = React.useState('');
  const [filterPayment, setFilterPayment] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [bulkTarget, setBulkTarget] = React.useState<Process['status'] | ''>('');
  const [showFilters, setShowFilters] = React.useState(false);

  const consultants = React.useMemo(
    () => Array.from(new Set(processes.map((p) => p.consultant_name).filter(Boolean))),
    [processes]
  );

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const processId = parseInt(draggableId);
    const newStatus = destination.droppableId as Process['status'];
    onUpdateStatus(processId, newStatus);
  };

  const filtered = processes.filter((p) => {
    const matchSearch =
      p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.visa_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toString().includes(searchTerm);
    const matchConsultant = !filterConsultant || p.consultant_name === filterConsultant;
    const matchPayment = !filterPayment || p.payment_status === filterPayment;
    return matchSearch && matchConsultant && matchPayment;
  });

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
    selectedIds.forEach((id) => onUpdateStatus(id, bulkTarget as Process['status']));
    setSelectedIds(new Set());
    setBulkTarget('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)]">
      {/* Header */}
      <div className="p-6 flex flex-col gap-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="text-black" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Pipeline CRM</h2>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                {filtered.length} processo{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder="Buscar processo..."
                className="pl-11 pr-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm w-56"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${showFilters ? 'brand-gradient text-black border-transparent' : 'bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Filter size={15} />
              Filtros
            </button>
          </div>
        </div>

        {/* Filtros expandidos */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap gap-3"
          >
            <select
              value={filterConsultant}
              onChange={(e) => setFilterConsultant(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos consultores</option>
              {consultants.map((c) => (
                <option key={c} value={c!}>{c}</option>
              ))}
            </select>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos pagamentos</option>
              <option value="pending">Pendente</option>
              <option value="proof_received">Comprovante</option>
              <option value="confirmed">Confirmado</option>
            </select>
            <button
              onClick={() => { setFilterConsultant(''); setFilterPayment(''); }}
              className="px-3 py-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl transition-all"
            >
              Limpar
            </button>
          </motion.div>
        )}

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
          >
            <CheckSquare size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value as Process['status'])}
              className="px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-xs outline-none"
            >
              <option value="">Mover para...</option>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button
              onClick={applyBulkMove}
              disabled={!bulkTarget}
              className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-emerald-400 transition-all"
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6 scrollbar-hide">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 h-full min-w-max">
            {COLUMNS.map((column) => {
              const columnProcesses = filtered.filter((p) => p.status === column.id);
              return (
                <div
                  key={column.id}
                  className="flex flex-col w-80 bg-[var(--bg-card)]/20 rounded-3xl border border-[var(--border-color)] overflow-hidden"
                >
                  <div className="p-4 flex items-center justify-between border-b border-[var(--border-color)] bg-white/5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${column.color}`} />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]">
                        {column.label}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] text-[10px] font-bold">
                        {columnProcesses.length}
                      </span>
                    </div>
                    <button className="p-1 hover:bg-[var(--bg-input)] rounded-lg text-[var(--text-muted)] transition-colors">
                      <MoreHorizontal size={14} />
                    </button>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 p-3 space-y-3 overflow-y-auto scrollbar-hide transition-colors ${
                          snapshot.isDraggingOver ? 'bg-emerald-500/5' : ''
                        }`}
                      >
                        {columnProcesses.map((process, index) => {
                          const days = getDaysInStage(process.created_at);
                          const score = getClientScore(process);
                          const isSelected = selectedIds.has(process.id);

                          return (
                            <Draggable
                              key={process.id.toString()}
                              draggableId={process.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => onSelectProcess(process)}
                                  className={`group bg-[var(--bg-card)] border rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all cursor-pointer relative ${
                                    snapshot.isDragging
                                      ? 'shadow-2xl border-emerald-500 ring-2 ring-emerald-500/20'
                                      : isSelected
                                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                                      : 'border-[var(--border-color)] hover:border-emerald-500/30'
                                  }`}
                                >
                                  {/* Checkbox de seleção bulk */}
                                  <div
                                    onClick={(e) => toggleSelect(process.id, e)}
                                    className={`absolute top-3 left-3 w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-[var(--border-color)] bg-[var(--bg-input)] opacity-0 group-hover:opacity-100'
                                    }`}
                                  >
                                    {isSelected && <span className="text-black text-[8px] font-black">✓</span>}
                                  </div>

                                  {/* Badge de comprovante */}
                                  {process.payment_status === 'proof_received' && (
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg animate-pulse z-10">
                                      <AlertCircle size={14} className="text-white" />
                                    </div>
                                  )}

                                  <div className="space-y-3">
                                    {/* Nome + ID */}
                                    <div className="flex justify-between items-start pl-5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-[var(--bg-input)] rounded-lg flex items-center justify-center text-[10px] font-black text-emerald-400 border border-[var(--border-color)]">
                                          {getClientName(process).charAt(0)}
                                        </div>
                                        <div>
                                          <h4 className="text-xs font-black text-[var(--text-main)] group-hover:text-emerald-400 transition-colors line-clamp-1">
                                            {getClientName(process)}
                                          </h4>
                                          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                            #{process.id}
                                          </p>
                                        </div>
                                      </div>
                                      <ChevronRight
                                        size={14}
                                        className="text-[var(--text-muted)] group-hover:text-emerald-400 transition-all translate-x-0 group-hover:translate-x-1 flex-shrink-0"
                                      />
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1.5">
                                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                        <MapPin size={10} />
                                        {process.visa_name || 'Visto'}
                                      </div>
                                      {process.consultant_name && (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                          <UserIcon size={10} />
                                          {process.consultant_name.split(' ')[0]}
                                        </div>
                                      )}
                                    </div>

                                    {/* Score bar */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1">
                                          <TrendingUp size={9} />
                                          Score
                                        </span>
                                        <span className="text-[9px] font-black text-emerald-400">{score}%</span>
                                      </div>
                                      <div className="h-1 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                                          style={{ width: `${score}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Rodapé */}
                                    <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                        <Calendar size={10} />
                                        {new Date(process.created_at).toLocaleDateString('pt-BR')}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {/* Dias na etapa */}
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getInactivityColor(days)}`}>
                                          <Clock size={9} />
                                          {days}d
                                        </div>
                                        {/* Status pagamento */}
                                        <div
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                            process.payment_status === 'confirmed'
                                              ? 'bg-emerald-500/10 text-emerald-400'
                                              : process.payment_status === 'proof_received'
                                              ? 'bg-amber-500/10 text-amber-400'
                                              : 'bg-zinc-500/10 text-zinc-400'
                                          }`}
                                        >
                                          <DollarSign size={9} />
                                          {process.payment_status === 'confirmed'
                                            ? 'Pago'
                                            : process.payment_status === 'proof_received'
                                            ? 'Comprov.'
                                            : 'Pend.'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};
