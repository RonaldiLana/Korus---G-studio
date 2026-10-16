import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  ClipboardList,
  User as UserIcon,
  Users,
  Search,
  ExternalLink,
  Paperclip,
  AlertCircle,
  Loader2,
  ChevronRight,
  Plane,
  Wallet,
  Pencil,
} from 'lucide-react';
import { ClientOverview, ClientProfile, ClientProfileAnswer, ClientProfileProcess } from '../../types';
import { AnswerEditor, EditValues } from './AnswerEditor';
import {
  DOCUMENT_STATUS_META,
  EMPTY_VALUE,
  FORM_STATUS_META,
  PAYMENT_STATUS_META,
  STAGE_META,
  formatAnswer,
  formatDate,
  getInitials,
  hasValue,
} from './clientFormat';

type Tab = 'data' | 'forms' | 'documents';

interface ClientProfileDrawerProps {
  client: ClientOverview | null;
  apiUrl: string;
  token: string | null;
  canEdit?: boolean;
  resolveFileUrl: (url: string | null | undefined) => string;
  onClose: () => void;
  onOpenProcess: (processId: number) => void;
  onClientUpdated?: () => void;
  notify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const Pill: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>
);

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; count?: number; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  count,
  action,
}) => (
  <div className="mb-3 flex items-center gap-2">
    <Icon size={15} className="text-emerald-400" />
    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</h4>
    {count !== undefined && (
      <span className="rounded-full bg-[var(--bg-input)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-muted)]">{count}</span>
    )}
    {action && <div className="ml-auto">{action}</div>}
  </div>
);

const EditButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Editar' }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold text-blue-400 transition-all hover:bg-blue-500/20"
  >
    <Pencil size={12} />
    {label}
  </button>
);

const FieldGrid: React.FC<{ items: ClientProfileAnswer[]; query: string }> = ({ items, query }) => {
  const visible = items.filter((item) => {
    if (!query) return true;
    return `${item.label} ${formatAnswer(item.value, item.type)}`.toLowerCase().includes(query);
  });
  if (visible.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--text-muted)]">Nenhuma informação encontrada.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/30 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((item, index) => {
        const answered = hasValue(item.value);
        return (
          <div key={`${item.label}-${index}`} className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {item.label}
              {item.required && <span className="ml-1 text-red-400">*</span>}
            </dt>
            <dd className={`mt-1 break-words text-sm ${answered ? 'font-semibold text-[var(--text-main)]' : 'italic text-[var(--text-muted)]'}`}>
              {answered ? formatAnswer(item.value, item.type) : 'Não respondido'}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};

export const ClientProfileDrawer: React.FC<ClientProfileDrawerProps> = ({
  client,
  apiUrl,
  token,
  canEdit = true,
  resolveFileUrl,
  onClose,
  onOpenProcess,
  onClientUpdated,
  notify,
}) => {
  const [profile, setProfile] = React.useState<ClientProfile | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedProcessId, setSelectedProcessId] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<Tab>('data');
  const [query, setQuery] = React.useState('');

  const [editing, setEditing] = React.useState<string | null>(null);

  const clientId = client?.id ?? null;
  const authHeaders = React.useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }),
    [token]
  );

  const loadProfile = React.useCallback(
    async (id: number, isCancelled: () => boolean = () => false, resetView = false) => {
      if (resetView) {
        setProfile(null);
        setError(null);
        setLoading(true);
        setTab('data');
        setQuery('');
        setSelectedProcessId(null);
        setEditing(null);
      }
      try {
        const res = await fetch(`${apiUrl}/api/client-profile/${id}`, { headers: authHeaders });
        if (!res.ok) throw new Error(res.status === 403 ? 'Você não tem acesso a este cliente.' : 'Não foi possível carregar a ficha do cliente.');
        const data: ClientProfile = await res.json();
        if (isCancelled()) return;
        setProfile(data);
        setSelectedProcessId((current) =>
          current !== null && data.processes.some((p) => p.id === current) ? current : data.processes[0]?.id ?? null
        );
      } catch (err: any) {
        if (!isCancelled()) setError(err?.message || 'Não foi possível carregar a ficha do cliente.');
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [apiUrl, authHeaders]
  );

  React.useEffect(() => {
    if (clientId === null) return;
    let cancelled = false;
    loadProfile(clientId, () => cancelled, true);
    return () => {
      cancelled = true;
    };
  }, [clientId, loadProfile]);

  // Envia a correção ao servidor, recarrega a ficha e avisa a lista; devolve o erro (se houver) para o editor
  const submitEdit = async (url: string, body: unknown, successMessage: string): Promise<string | null> => {
    try {
      const res = await fetch(`${apiUrl}${url}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return data?.error || 'Não foi possível salvar as alterações.';
      }
      if (clientId !== null) await loadProfile(clientId);
      setEditing(null);
      onClientUpdated?.();
      notify?.(successMessage, 'success');
      return null;
    } catch {
      return 'Erro de conexão. Tente novamente.';
    }
  };

  React.useEffect(() => {
    setEditing(null);
  }, [tab, selectedProcessId]);

  React.useEffect(() => {
    if (!client) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [client, onClose]);

  const process: ClientProfileProcess | null =
    profile?.processes.find((p) => p.id === selectedProcessId) ?? profile?.processes[0] ?? null;
  const q = query.trim().toLowerCase();

  const totals = React.useMemo(() => {
    const processes = profile?.processes ?? [];
    return {
      processes: processes.length,
      forms: processes.reduce((sum, p) => sum + p.forms.length, 0),
      submitted: processes.reduce((sum, p) => sum + p.forms.filter((f) => f.status === 'submitted' || f.status === 'locked').length, 0),
      documents: processes.reduce((sum, p) => sum + p.documents.length, 0),
    };
  }, [profile]);

  const registrationItems: ClientProfileAnswer[] = profile
    ? [
        { key: 'name', label: 'Nome completo', type: 'text', required: true, value: profile.client.name },
        { key: 'email', label: 'E-mail', type: 'email', required: true, value: profile.client.email },
        { key: 'phone', label: 'Telefone', type: 'phone', value: profile.client.phone },
        { key: 'city', label: 'Cidade', type: 'text', value: profile.client.city },
        { key: 'state', label: 'Estado', type: 'text', value: profile.client.state },
      ]
    : [];

  const registrationSection = (
    <section>
      <SectionTitle
        icon={UserIcon}
        title="Dados cadastrais"
        action={canEdit && profile && editing !== 'registration' ? <EditButton onClick={() => setEditing('registration')} /> : undefined}
      />
      {editing === 'registration' && profile ? (
        <AnswerEditor
          items={registrationItems}
          note="Atenção: o e-mail é usado no login do cliente. Ao alterá-lo, o cliente passa a acessar com o novo e-mail."
          onCancel={() => setEditing(null)}
          onSave={(values) => submitEdit(`/api/client-profile/${profile.client.id}`, values, 'Cadastro do cliente atualizado!')}
        />
      ) : (
        <FieldGrid items={[...registrationItems, { label: 'Cliente desde', value: profile?.client.created_at, type: 'date' }]} query={q} />
      )}
    </section>
  );

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; count: number }> = [
    { id: 'data', label: 'Dados', icon: UserIcon, count: (process?.pre_form.length ?? 0) + (process?.simplified_answers.length ?? 0) },
    { id: 'forms', label: 'Formulários', icon: ClipboardList, count: process?.forms.length ?? 0 },
    { id: 'documents', label: 'Documentos', icon: Paperclip, count: process?.documents.length ?? 0 },
  ];

  const displayName = profile?.client.name ?? client?.name ?? '';
  const displayEmail = profile?.client.email ?? client?.email;
  const displayPhone = profile?.client.phone ?? client?.phone;
  const location = [profile?.client.city ?? client?.city, profile?.client.state ?? client?.state].filter(Boolean).join(' / ');

  return createPortal(
    <AnimatePresence>
      {client && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex justify-end bg-[var(--bg-overlay)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Ficha de ${displayName}`}
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="flex h-full w-full flex-col border-l border-[var(--border-color)] bg-[var(--bg-main)] shadow-2xl sm:w-[94vw] xl:w-[min(1320px,92vw)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <header className="flex-shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-card)]/60 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="brand-gradient flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-black text-black shadow-lg">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-black tracking-tight text-[var(--text-main)]">{displayName}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-[var(--text-muted)]">
                    {displayEmail && (
                      <a href={`mailto:${displayEmail}`} className="flex items-center gap-1.5 hover:text-emerald-400">
                        <Mail size={13} />
                        {displayEmail}
                      </a>
                    )}
                    {displayPhone && (
                      <a href={`tel:${displayPhone}`} className="flex items-center gap-1.5 hover:text-emerald-400">
                        <Phone size={13} />
                        {displayPhone}
                      </a>
                    )}
                    {location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} />
                        {location}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      Cliente desde {formatDate(profile?.client.created_at ?? client.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar ficha"
                  onClick={onClose}
                  className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-[var(--text-main)]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
                {[
                  { label: 'processos', value: totals.processes, icon: Plane },
                  { label: 'formulários', value: totals.forms, icon: ClipboardList },
                  { label: 'enviados', value: totals.submitted, icon: FileText },
                  { label: 'documentos', value: totals.documents, icon: Paperclip },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] py-1.5 pl-3 pr-4">
                    <Icon size={14} className="text-emerald-400" />
                    <span className="text-sm font-black text-[var(--text-main)]">{loading ? '–' : value}</span>
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</span>
                  </div>
                ))}
              </div>
            </header>

            {/* Corpo */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && (
                <div className="flex h-64 items-center justify-center gap-3 text-sm font-semibold text-[var(--text-muted)]">
                  <Loader2 size={18} className="animate-spin" />
                  Carregando informações do cliente…
                </div>
              )}

              {!loading && error && (
                <div className="m-6 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-400">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {!loading && !error && profile && (
                <div className="space-y-6 p-5 sm:p-6">
                  {/* Seletor de processo */}
                  {profile.processes.length === 0 ? (
                    <>
                      <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-6 text-center">
                        <Plane className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" size={28} />
                        <p className="text-sm font-bold text-[var(--text-main)]">Este cliente ainda não possui processos</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Os formulários e documentos aparecerão aqui assim que um processo for iniciado.</p>
                      </div>
                      {registrationSection}
                    </>
                  ) : (
                    <>
                      {profile.processes.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 kanban-scroll">
                          {profile.processes.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedProcessId(p.id)}
                              className={`flex-shrink-0 rounded-xl border px-3.5 py-2 text-left transition-all ${
                                p.id === process?.id
                                  ? 'border-emerald-500/50 bg-emerald-500/10'
                                  : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-emerald-500/30'
                              }`}
                            >
                              <p className="text-xs font-black text-[var(--text-main)]">#{p.id} · {p.visa_name || 'Processo'}</p>
                              <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                {STAGE_META[p.status]?.label ?? p.status} · {formatDate(p.created_at)}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}

                      {process && (
                        <>
                          {/* Resumo do processo */}
                          <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-black text-[var(--text-main)]">Processo #{process.id}</h3>
                                <Pill className={STAGE_META[process.status]?.className ?? ''}>{STAGE_META[process.status]?.label ?? process.status}</Pill>
                                {process.process_type === 'simplified' && (
                                  <Pill className="border-blue-500/20 bg-blue-500/10 text-blue-400">Simplificado</Pill>
                                )}
                                {process.financial && (
                                  <Pill className={PAYMENT_STATUS_META[process.financial.status]?.className ?? PAYMENT_STATUS_META.pending.className}>
                                    {PAYMENT_STATUS_META[process.financial.status]?.label ?? process.financial.status}
                                  </Pill>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenProcess(process.id)}
                                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
                              >
                                Abrir processo
                                <ChevronRight size={14} />
                              </button>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                              {[
                                { label: 'Visto', value: process.visa_name },
                                { label: 'Destino', value: process.destination_name },
                                { label: 'Plano', value: process.plan_name },
                                { label: 'Consultor', value: process.consultant_name },
                                { label: 'Analista', value: process.analyst_name },
                                { label: 'Viagem', value: process.travel_date ? formatDate(process.travel_date) : null },
                              ].map(({ label, value }) => (
                                <div key={label} className="min-w-0">
                                  <p className="font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
                                  <p className="mt-0.5 truncate font-semibold text-[var(--text-main)]">{value || EMPTY_VALUE}</p>
                                </div>
                              ))}
                            </div>
                            {process.financial && process.financial.amount > 0 && (
                              <p className="mt-4 flex items-center gap-2 border-t border-[var(--border-color)] pt-3 text-xs font-semibold text-[var(--text-muted)]">
                                <Wallet size={13} />
                                Valor do processo: <span className="font-black text-[var(--text-main)]">{currency.format(process.financial.amount)}</span>
                              </p>
                            )}
                          </section>

                          {/* Abas + busca */}
                          <div className="sticky -top-5 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-main)] px-5 sm:-top-6 sm:-mx-6 sm:px-6">
                            <nav className="kanban-scroll flex min-w-0 max-w-full gap-1 overflow-x-auto">
                              {tabs.map(({ id, label, icon: Icon, count }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setTab(id)}
                                  className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-3 text-xs font-bold transition-all sm:px-3 ${
                                    tab === id
                                      ? 'border-emerald-500 text-emerald-400'
                                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                  }`}
                                >
                                  <Icon size={14} className="hidden sm:block" />
                                  {label}
                                  <span className="rounded-full bg-[var(--bg-input)] px-2 py-0.5 text-[10px] font-black">{count}</span>
                                </button>
                              ))}
                            </nav>
                            {tab !== 'documents' && (
                              <div className="relative mb-2 w-full sm:w-56">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                <input
                                  type="text"
                                  value={query}
                                  onChange={(e) => setQuery(e.target.value)}
                                  placeholder="Buscar nas informações..."
                                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                              </div>
                            )}
                          </div>

                          {/* Aba: Dados */}
                          {tab === 'data' && (
                            <div className="space-y-6">
                              {registrationSection}
                              {process.pre_form.length > 0 && (
                                <section>
                                  <SectionTitle
                                    icon={ClipboardList}
                                    title="Pré-formulário"
                                    count={process.pre_form.length}
                                    action={canEdit && editing !== `pre:${process.id}` ? <EditButton onClick={() => setEditing(`pre:${process.id}`)} /> : undefined}
                                  />
                                  {editing === `pre:${process.id}` ? (
                                    <AnswerEditor
                                      key={`pre-${process.id}`}
                                      items={process.pre_form}
                                      onCancel={() => setEditing(null)}
                                      onSave={(values) =>
                                        submitEdit(
                                          `/api/client-profile/${profile.client.id}/processes/${process.id}/pre-form`,
                                          { values },
                                          'Pré-formulário atualizado!'
                                        )
                                      }
                                    />
                                  ) : (
                                    <FieldGrid items={process.pre_form} query={q} />
                                  )}
                                </section>
                              )}
                              {process.simplified_answers.length > 0 && (
                                <section>
                                  <SectionTitle icon={FileText} title="Ficha cadastral (processo simplificado)" count={process.simplified_answers.length} />
                                  <FieldGrid items={process.simplified_answers} query={q} />
                                </section>
                              )}
                              {process.dependents.length > 0 && (
                                <section>
                                  <SectionTitle icon={Users} title="Dependentes" count={process.dependents.length} />
                                  <div className="space-y-2">
                                    {process.dependents.map((d, index) => (
                                      <div key={`${d.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                                        <div>
                                          <p className="text-sm font-bold text-[var(--text-main)]">{d.name}</p>
                                          <p className="text-xs text-[var(--text-muted)]">{d.relationship || 'Dependente'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                                          {d.birth_date && <span>Nasc.: <b className="text-[var(--text-main)]">{formatDate(d.birth_date)}</b></span>}
                                          {d.age !== null && d.age !== undefined && !d.birth_date && <span>Idade: <b className="text-[var(--text-main)]">{d.age}</b></span>}
                                          {d.passport && <span>Passaporte: <b className="text-[var(--text-main)]">{d.passport}</b></span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              )}
                              {process.pre_form.length === 0 && process.simplified_answers.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--text-muted)]">
                                  Este processo ainda não tem pré-formulário preenchido.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Aba: Formulários */}
                          {tab === 'forms' && (
                            <div className="space-y-6">
                              {process.forms.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-muted)]">
                                  Nenhum formulário foi vinculado a este processo.
                                </p>
                              )}
                              {process.forms.map((form) => {
                                const meta = FORM_STATUS_META[form.status] ?? FORM_STATUS_META.open;
                                return (
                                  <section key={form.response_id} className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <ClipboardList size={15} className="flex-shrink-0 text-emerald-400" />
                                        <h4 className="truncate text-sm font-black text-[var(--text-main)]">{form.title}</h4>
                                        <Pill className={meta.className}>{meta.label}</Pill>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[var(--text-muted)]">
                                        <span>Atualizado em {formatDate(form.updated_at)}</span>
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-input)]">
                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${form.progress}%` }} />
                                          </div>
                                          <span className="font-black text-[var(--text-main)]">{form.progress}%</span>
                                        </div>
                                        {canEdit && editing !== `form:${form.response_id}` && (
                                          <EditButton label="Editar respostas" onClick={() => setEditing(`form:${form.response_id}`)} />
                                        )}
                                      </div>
                                    </div>
                                    {editing === `form:${form.response_id}` ? (
                                      <AnswerEditor
                                        key={`form-${form.response_id}`}
                                        items={form.answers}
                                        onCancel={() => setEditing(null)}
                                        onSave={(values) =>
                                          submitEdit(
                                            `/api/client-profile/${profile.client.id}/forms/${form.response_id}`,
                                            { values },
                                            'Respostas do formulário atualizadas!'
                                          )
                                        }
                                      />
                                    ) : (
                                      <FieldGrid items={form.answers} query={q} />
                                    )}
                                  </section>
                                );
                              })}
                            </div>
                          )}

                          {/* Aba: Documentos */}
                          {tab === 'documents' && (
                            <div className="grid gap-2 lg:grid-cols-2">
                              {process.documents.length === 0 && (
                                <p className="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-muted)] lg:col-span-2">
                                  Nenhum documento enviado neste processo.
                                </p>
                              )}
                              {process.documents.map((doc) => {
                                const meta = DOCUMENT_STATUS_META[doc.status] ?? DOCUMENT_STATUS_META.uploaded;
                                const href = resolveFileUrl(doc.url);
                                return (
                                  <div key={doc.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-input)] text-emerald-400">
                                      <Paperclip size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-[var(--text-main)]" title={doc.name}>{doc.name}</p>
                                      <p className="text-[11px] text-[var(--text-muted)]">
                                        {doc.category && doc.category !== 'general' ? `${doc.category} · ` : ''}Enviado em {formatDate(doc.uploaded_at)}
                                      </p>
                                      {doc.status === 'rejected' && doc.rejection_reason && (
                                        <p className="mt-1 text-[11px] font-semibold text-red-400">Motivo: {doc.rejection_reason}</p>
                                      )}
                                    </div>
                                    <Pill className={meta.className}>{meta.label}</Pill>
                                    {href && (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-emerald-400"
                                        title="Abrir documento"
                                      >
                                        <ExternalLink size={16} />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
