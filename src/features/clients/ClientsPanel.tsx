import React from 'react';
import {
  Search,
  Users,
  Plus,
  Pencil,
  Eye,
  Mail,
  Phone,
  MapPin,
  ClipboardList,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Contact,
  X,
} from 'lucide-react';
import { ClientOverview } from '../../types';
import { ClientProfileDrawer } from './ClientProfileDrawer';
import { EMPTY_VALUE, STAGE_META, formatDate, getInitials } from './clientFormat';

type Filter = 'all' | 'active' | 'no_process' | 'pending_forms';

interface ClientsPanelProps {
  leads: ClientOverview[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  apiUrl: string;
  token: string | null;
  resolveFileUrl: (url: string | null | undefined) => string;
  onStartProcess: (client: ClientOverview) => void;
  onEditProcess: (processId: number) => void;
  onOpenProcess: (processId: number) => void;
  onClientUpdated?: () => void;
  notify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PAGE_SIZE = 25;

const digitsOnly = (s: string) => (s || '').replace(/\D/g, '');

const pendingForms = (c: ClientOverview) => Math.max(0, (c.forms_total ?? 0) - (c.forms_submitted ?? 0));

export const ClientsPanel: React.FC<ClientsPanelProps> = ({
  leads,
  searchTerm,
  onSearchChange,
  apiUrl,
  token,
  resolveFileUrl,
  onStartProcess,
  onEditProcess,
  onOpenProcess,
  onClientUpdated,
  notify,
}) => {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [page, setPage] = React.useState(1);
  const [openClient, setOpenClient] = React.useState<ClientOverview | null>(null);

  const closeDrawer = React.useCallback(() => setOpenClient(null), []);

  const counts = React.useMemo(
    () => ({
      all: leads.length,
      active: leads.filter((c) => c.process_id).length,
      no_process: leads.filter((c) => !c.process_id).length,
      pending_forms: leads.filter((c) => pendingForms(c) > 0).length,
    }),
    [leads]
  );

  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leads.filter((c) => {
      if (filter === 'active' && !c.process_id) return false;
      if (filter === 'no_process' && c.process_id) return false;
      if (filter === 'pending_forms' && pendingForms(c) === 0) return false;
      if (!term) return true;
      const phoneTerm = digitsOnly(term);
      return (
        (c.name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (phoneTerm !== '' && digitsOnly(c.phone || '').includes(phoneTerm))
      );
    });
  }, [leads, filter, searchTerm]);

  React.useEffect(() => {
    setPage(1);
  }, [filter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filters: Array<{ id: Filter; label: string; icon: React.ElementType }> = [
    { id: 'all', label: 'Todos', icon: Users },
    { id: 'active', label: 'Com processo', icon: UserCheck },
    { id: 'no_process', label: 'Sem processo', icon: UserX },
    { id: 'pending_forms', label: 'Formulário pendente', icon: ClipboardList },
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h3 className="text-2xl font-black tracking-tight">Clientes da agência</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Todas as informações do cadastro, dos formulários e dos documentos de cada cliente em um só lugar.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] py-2.5 pl-11 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/50"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {filters.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
              filter === id
                ? 'brand-gradient border-transparent text-black'
                : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Icon size={14} />
            {label}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${filter === id ? 'bg-black/10' : 'bg-[var(--bg-input)]'}`}>
              {counts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)]/50">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-5 py-4">Cliente</th>
                <th className="px-5 py-4">Contato</th>
                <th className="px-5 py-4">Processo</th>
                <th className="px-5 py-4">Formulários</th>
                <th className="px-5 py-4">Responsável</th>
                <th className="px-5 py-4">Cadastro</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Contact className="mx-auto mb-4 text-[var(--text-muted)] opacity-20" size={48} />
                    <p className="font-bold text-[var(--text-muted)]">Nenhum cliente cadastrado.</p>
                  </td>
                </tr>
              )}
              {leads.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Search className="mx-auto mb-4 text-[var(--text-muted)] opacity-20" size={48} />
                    <p className="font-bold text-[var(--text-muted)]">Nenhum cliente encontrado com os filtros atuais.</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Tente buscar por nome, e-mail ou telefone.</p>
                  </td>
                </tr>
              )}
              {pageItems.map((lead) => {
                const stage = lead.process_status ? STAGE_META[lead.process_status] : null;
                const total = lead.forms_total ?? 0;
                const submitted = lead.forms_submitted ?? 0;
                const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;
                const location = [lead.city, lead.state].filter(Boolean).join(' / ');
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setOpenClient(lead)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--bg-input)]/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="brand-gradient flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black text-black">
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-sm font-bold text-[var(--text-main)] group-hover:text-emerald-400" title={lead.name}>
                            {lead.name}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--text-muted)]">
                            {(lead.processes_total ?? 0) > 0
                              ? `${lead.processes_total} processo${lead.processes_total === 1 ? '' : 's'}`
                              : 'Sem processos'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1 text-xs text-[var(--text-muted)]">
                        <p className="flex items-center gap-1.5">
                          <Mail size={12} className="flex-shrink-0" />
                          <span className="max-w-[210px] truncate" title={lead.email}>{lead.email}</span>
                        </p>
                        <p className="flex items-center gap-1.5" data-testid={`lead-phone-${lead.id}`}>
                          <Phone size={12} className="flex-shrink-0" />
                          {lead.phone || EMPTY_VALUE}
                        </p>
                        {location && (
                          <p className="flex items-center gap-1.5">
                            <MapPin size={12} className="flex-shrink-0" />
                            {location}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {stage ? (
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${stage.className}`}>{stage.label}</span>
                          <p className="max-w-[160px] truncate text-[11px] font-medium text-[var(--text-muted)]">{lead.process_visa_name || 'Visto'}</p>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                          Não iniciado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {total > 0 ? (
                        <div className="w-36 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-[var(--text-muted)]">{submitted}/{total} enviados</span>
                            <span className="font-black text-[var(--text-main)]">{percent}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-input)]">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${percent}%` }} />
                          </div>
                          {lead.latest_form_title && (
                            <p className="truncate text-[11px] text-[var(--text-muted)]" title={lead.latest_form_title}>
                              {lead.latest_form_title}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">Sem formulários</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-[var(--text-main)]">
                      {lead.process_consultant_name || <span className="font-medium text-[var(--text-muted)]">{EMPTY_VALUE}</span>}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-[var(--text-muted)]">{formatDate(lead.created_at)}</td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setOpenClient(lead)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
                        >
                          <Eye size={14} />
                          Ficha
                        </button>
                        {lead.process_id ? (
                          <button
                            type="button"
                            onClick={() => onEditProcess(lead.process_id as number)}
                            className="rounded-lg p-2 text-blue-400 transition-all hover:bg-blue-500/20"
                            title="Editar processo"
                            aria-label="Editar processo"
                          >
                            <Pencil size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStartProcess(lead)}
                            className="rounded-lg p-2 text-emerald-400 transition-all hover:bg-emerald-500/20"
                            title="Iniciar processo"
                            aria-label="Iniciar processo"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista em cartões (celular) */}
        <div className="divide-y divide-[var(--border-color)] md:hidden">
          {filtered.length === 0 && (
            <p className="px-6 py-12 text-center text-sm font-bold text-[var(--text-muted)]">
              {leads.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado com os filtros atuais.'}
            </p>
          )}
          {pageItems.map((lead) => {
            const stage = lead.process_status ? STAGE_META[lead.process_status] : null;
            const total = lead.forms_total ?? 0;
            const submitted = lead.forms_submitted ?? 0;
            return (
              <div key={lead.id} className="space-y-3 p-4">
                <button type="button" onClick={() => setOpenClient(lead)} className="flex w-full items-center gap-3 text-left">
                  <div className="brand-gradient flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black text-black">
                    {getInitials(lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--text-main)]">{lead.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{lead.email}</p>
                  </div>
                  {stage ? (
                    <span className={`flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${stage.className}`}>{stage.label}</span>
                  ) : (
                    <span className="flex-shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-400">Não iniciado</span>
                  )}
                </button>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5"><Phone size={12} />{lead.phone || EMPTY_VALUE}</span>
                  <span className="flex items-center gap-1.5"><ClipboardList size={12} />{total > 0 ? `${submitted}/${total} formulários enviados` : 'Sem formulários'}</span>
                  {lead.process_consultant_name && <span className="flex items-center gap-1.5"><UserCheck size={12} />{lead.process_consultant_name}</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenClient(lead)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-400"
                  >
                    <Eye size={14} />
                    Ver ficha
                  </button>
                  {lead.process_id ? (
                    <button
                      type="button"
                      onClick={() => onEditProcess(lead.process_id as number)}
                      className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400"
                    >
                      <Pencil size={14} />
                      Processo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onStartProcess(lead)}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400"
                    >
                      <Plus size={14} />
                      Iniciar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-5 py-3 text-xs font-semibold text-[var(--text-muted)]">
            <span>
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} cliente{filtered.length === 1 ? '' : 's'}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Página anterior"
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-1.5 transition-all hover:text-[var(--text-main)] disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Próxima página"
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-1.5 transition-all hover:text-[var(--text-main)] disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ClientProfileDrawer
        client={openClient}
        apiUrl={apiUrl}
        token={token}
        resolveFileUrl={resolveFileUrl}
        onClose={closeDrawer}
        onClientUpdated={onClientUpdated}
        notify={notify}
        onOpenProcess={(processId) => {
          closeDrawer();
          onOpenProcess(processId);
        }}
      />
    </div>
  );
};
