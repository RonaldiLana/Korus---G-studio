import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Process, User } from '../types';
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
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';

interface PipefyPanelProps {
  processes: Process[];
  clients: User[];
  onUpdateStatus: (processId: number, newStatus: Process['status']) => void;
  onSelectProcess: (process: Process) => void;
}

const COLUMNS: { id: Process['status']; label: string; color: string }[] = [
  { id: 'started', label: 'Iniciado', color: 'bg-blue-500' },
  { id: 'waiting_payment', label: 'Aguardando Pagamento', color: 'bg-amber-500' },
  { id: 'payment_confirmed', label: 'Pagamento Confirmado', color: 'bg-emerald-500' },
  { id: 'analyzing', label: 'Em Análise', color: 'bg-purple-500' },
  { id: 'final_phase', label: 'Fase Final', color: 'bg-indigo-500' },
  { id: 'completed', label: 'Concluído', color: 'bg-zinc-500' },
];

export const PipefyPanel: React.FC<PipefyPanelProps> = ({ 
  processes, 
  clients, 
  onUpdateStatus,
  onSelectProcess 
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const processId = parseInt(draggableId);
    const newStatus = destination.droppableId as Process['status'];

    onUpdateStatus(processId, newStatus);
  };

  const filteredProcesses = processes.filter(p => 
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.visa_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toString().includes(searchTerm)
  );

  const getClientName = (process: Process) => {
    if (process.client_name) return process.client_name;
    const client = clients.find(c => c.id === process.client_id);
    return client ? client.name : 'Cliente Desconhecido';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)]">
      {/* Header do Painel */}
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Filter className="text-black" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Fluxo de Processos</h2>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Pipefy Profissional</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input 
              type="text"
              placeholder="Buscar processo..."
              className="pl-11 pr-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6 scrollbar-hide">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 h-full min-w-max">
            {COLUMNS.map((column) => (
              <div key={column.id} className="flex flex-col w-80 bg-[var(--bg-card)]/20 rounded-3xl border border-[var(--border-color)] overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-[var(--border-color)] bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]">
                      {column.label}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] text-[10px] font-bold">
                      {filteredProcesses.filter(p => p.status === column.id).length}
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
                      {filteredProcesses
                        .filter((p) => p.status === column.id)
                        .map((process, index) => (
                          <Draggable key={process.id.toString()} draggableId={process.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onSelectProcess(process)}
                                className={`group bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all cursor-pointer relative ${
                                  snapshot.isDragging ? 'shadow-2xl border-emerald-500 ring-2 ring-emerald-500/20' : ''
                                }`}
                              >
                                {process.payment_status === 'proof_received' && (
                                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg animate-pulse z-10">
                                    <AlertCircle size={14} className="text-white" />
                                  </div>
                                )}

                                <div className="space-y-3">
                                  <div className="flex justify-between items-start">
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
                                    <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-emerald-400 transition-all translate-x-0 group-hover:translate-x-1" />
                                  </div>

                                  <div className="flex flex-wrap gap-2">
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

                                  <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                      <Calendar size={10} />
                                      {new Date(process.created_at).toLocaleDateString('pt-BR')}
                                    </div>
                                    
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                      process.payment_status === 'confirmed' 
                                        ? 'bg-emerald-500/10 text-emerald-400' 
                                        : process.payment_status === 'proof_received'
                                        ? 'bg-amber-500/10 text-amber-400'
                                        : 'bg-zinc-500/10 text-zinc-400'
                                    }`}>
                                      {process.payment_status === 'confirmed' ? 'Pago' : process.payment_status === 'proof_received' ? 'Comprovante' : 'Pendente'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};
