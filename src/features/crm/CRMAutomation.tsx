import React from 'react';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Edit3, X, Check, Bell, Mail, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AutomationRule {
  id: number;
  agency_id: number;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  created_at: string;
}

interface EmailLog {
  id: number;
  process_id: number | null;
  rule_id: number | null;
  rule_name: string;
  to_email: string;
  subject: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string;
}

interface CRMAutomationProps {
  agencyId: number;
  token: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

const TRIGGER_OPTIONS = [
  { value: 'stage_change', label: 'Mudança de Etapa' },
  { value: 'payment_confirmed', label: 'Pagamento Confirmado' },
  { value: 'document_sent', label: 'Documento Enviado' },
  { value: 'inactivity', label: 'Inatividade por N dias' },
];

const INTERNAL_ACTION_OPTIONS = [
  { value: 'notify_team', label: 'Notificar Equipe (Pop-up)' },
  { value: 'advance_stage', label: 'Avançar Etapa' },
  { value: 'create_task', label: 'Criar Tarefa' },
];

const STAGE_OPTIONS = [
  { value: 'started', label: 'Iniciado' },
  { value: 'waiting_payment', label: 'Aguard. Pagamento' },
  { value: 'payment_confirmed', label: 'Pgto Confirmado' },
  { value: 'analyzing', label: 'Em Análise' },
  { value: 'final_phase', label: 'Fase Final' },
  { value: 'completed', label: 'Concluído' },
];

const TRIGGER_LABELS: Record<string, string> = {
  stage_change: 'Mudança de Etapa',
  payment_confirmed: 'Pgto Confirmado',
  document_sent: 'Doc Enviado',
  inactivity: 'Inatividade',
};

const ACTION_LABELS: Record<string, string> = {
  notify_team: 'Notif. Equipe',
  advance_stage: 'Avançar Etapa',
  create_task: 'Criar Tarefa',
  email_client: 'E-mail ao Cliente',
};

const emptyForm = {
  name: '',
  trigger_type: 'stage_change',
  trigger_from: '',
  trigger_to: '',
  trigger_days: '7',
  action_type: 'notify_team',
  action_message: '',
  action_stage: '',
  action_task: '',
  action_subject: '',
  action_from_name: '',
  action_email_body: '',
};

export const CRMAutomation: React.FC<CRMAutomationProps> = ({ agencyId, token }) => {
  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AutomationRule | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');
  const [activeSection, setActiveSection] = React.useState<'internal' | 'email' | 'logs'>('internal');
  const [emailLogs, setEmailLogs] = React.useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  const headers = React.useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchRules = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/crm-automation-rules?agency_id=${agencyId}`, { headers });
      if (res.ok) setRules(await res.json());
    } catch {
      setError('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  }, [agencyId, headers]);

  const fetchEmailLogs = React.useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/email-logs?agency_id=${agencyId}&limit=100`, { headers });
      if (res.ok) setEmailLogs(await res.json());
    } catch {
      // silencioso
    } finally {
      setLogsLoading(false);
    }
  }, [agencyId, headers]);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  React.useEffect(() => {
    if (activeSection === 'logs') fetchEmailLogs();
  }, [activeSection, fetchEmailLogs]);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...emptyForm, action_type: activeSection === 'email' ? 'email_client' : 'notify_team' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      trigger_type: rule.trigger_type,
      trigger_from: rule.trigger_config?.from_stage || '',
      trigger_to: rule.trigger_config?.to_stage || '',
      trigger_days: rule.trigger_config?.days?.toString() || '7',
      action_type: rule.action_type,
      action_message: rule.action_config?.message || '',
      action_stage: rule.action_config?.stage || '',
      action_task: rule.action_config?.task_title || '',
      action_subject: rule.action_config?.subject || '',
      action_from_name: rule.action_config?.from_name || '',
      action_email_body: rule.action_config?.body || '',
    });
    setError('');
    setShowModal(true);
  };

  const buildPayload = () => ({
    agency_id: agencyId,
    name: form.name.trim(),
    trigger_type: form.trigger_type,
    trigger_config:
      form.trigger_type === 'stage_change'
        ? { from_stage: form.trigger_from, to_stage: form.trigger_to }
        : form.trigger_type === 'inactivity'
        ? { days: parseInt(form.trigger_days) || 7 }
        : {},
    action_type: form.action_type,
    action_config:
      form.action_type === 'notify_team'
        ? { message: form.action_message }
        : form.action_type === 'advance_stage'
        ? { stage: form.action_stage }
        : form.action_type === 'create_task'
        ? { task_title: form.action_task }
        : form.action_type === 'email_client'
        ? { subject: form.action_subject, from_name: form.action_from_name, body: form.action_email_body }
        : {},
  });

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome da regra é obrigatório'); return; }
    if (form.action_type === 'email_client' && !form.action_subject.trim()) {
      setError('Assunto do e-mail é obrigatório');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      const url = editingRule
        ? `${API_URL}/api/crm-automation-rules/${editingRule.id}`
        : `${API_URL}/api/crm-automation-rules`;
      const method = editingRule ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        await fetchRules();
        setShowModal(false);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Erro ao salvar regra');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await fetch(`${API_URL}/api/crm-automation-rules/${rule.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ agency_id: agencyId, is_active: !rule.is_active }),
      });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch {
      setError('Erro ao alternar regra');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/crm-automation-rules/${id}?agency_id=${agencyId}`, {
        method: 'DELETE',
        headers,
      });
      setRules((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    } catch {
      setError('Erro ao remover regra');
    }
  };

  const filteredRules = rules.filter((r) =>
    activeSection === 'email' ? r.action_type === 'email_client' : r.action_type !== 'email_client'
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="text-black" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Automações</h2>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              {filteredRules.length} regra{filteredRules.length !== 1 ? 's' : ''} configurada{filteredRules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className={`brand-gradient text-black px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold hover:opacity-90 transition-all brand-shadow text-sm ${activeSection === 'logs' ? 'invisible' : ''}`}
        >
          <Plus size={16} />
          Nova Regra
        </button>
      </div>

      {/* Section switcher */}
      <div className="flex gap-1 p-1 bg-[var(--bg-input)] rounded-2xl">
        <button
          onClick={() => setActiveSection('internal')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            activeSection === 'internal'
              ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Bell size={12} />
          Notif. Interna
        </button>
        <button
          onClick={() => setActiveSection('email')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            activeSection === 'email'
              ? 'bg-[var(--bg-card)] text-violet-400 shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Mail size={12} />
          E-mail Cliente
        </button>
        <button
          onClick={() => setActiveSection('logs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            activeSection === 'logs'
              ? 'bg-[var(--bg-card)] text-amber-400 shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <History size={12} />
          Histórico
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold">
          {error}
        </div>
      )}

      {/* Histórico de E-mails */}
      {activeSection === 'logs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Últimos 100 envios automáticos</p>
            <button
              onClick={fetchEmailLogs}
              className="text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
            >
              Atualizar
            </button>
          </div>
          {logsLoading ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
          ) : emailLogs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 mx-auto bg-[var(--bg-input)] rounded-2xl flex items-center justify-center">
                <History size={28} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-bold text-[var(--text-muted)]">Nenhum e-mail enviado ainda</p>
              <p className="text-xs text-[var(--text-muted)]">Os envios automáticos aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emailLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border ${
                    log.status === 'sent'
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {log.status === 'sent' ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-[var(--text-main)] truncate">{log.subject}</span>
                        {log.process_id && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[var(--bg-input)] text-[var(--text-muted)] rounded">
                            #{log.process_id}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Para: <span className="text-[var(--text-main)]">{log.to_email}</span>
                        {' · '}
                        Regra: <span className="text-[var(--text-main)]">{log.rule_name}</span>
                      </p>
                      {log.status === 'failed' && log.error_message && (
                        <p className="text-[10px] text-red-400 mt-0.5">Erro: {log.error_message}</p>
                      )}
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
                        {new Date(log.sent_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de regras */}
      {activeSection !== 'logs' && loading ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
      ) : activeSection !== 'logs' && filteredRules.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 mx-auto bg-[var(--bg-input)] rounded-2xl flex items-center justify-center">
            {activeSection === 'email'
              ? <Mail size={28} className="text-[var(--text-muted)]" />
              : <Zap size={28} className="text-[var(--text-muted)]" />}
          </div>
          <p className="text-sm font-bold text-[var(--text-muted)]">
            {activeSection === 'email' ? 'Nenhuma regra de e-mail configurada' : 'Nenhuma regra interna configurada'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {activeSection === 'email'
              ? 'Crie regras para notificar clientes automaticamente por e-mail'
              : 'Crie regras para notificar a equipe automaticamente'}
          </p>
          <button onClick={openCreate} className="mt-2 brand-gradient text-black px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all">
            Criar primeira regra
          </button>
        </div>
      ) : activeSection !== 'logs' ? (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <motion.div
              key={rule.id}
              layout
              className={`p-4 rounded-2xl border transition-all ${
                rule.is_active
                  ? 'bg-[var(--bg-card)]/60 border-[var(--border-color)] hover:border-emerald-500/30'
                  : 'bg-[var(--bg-input)]/30 border-[var(--border-color)]/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Toggle */}
                <button onClick={() => handleToggle(rule)} className="mt-0.5 flex-shrink-0 transition-colors">
                  {rule.is_active ? (
                    <ToggleRight size={24} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={24} className="text-[var(--text-muted)]" />
                  )}
                </button>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-[var(--text-main)]">{rule.name}</h3>
                    {!rule.is_active && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-[var(--bg-input)] text-[var(--text-muted)] rounded">
                        Inativa
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                      <Zap size={10} />
                      {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs">→</span>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      rule.action_type === 'email_client'
                        ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                      {rule.action_type === 'email_client' ? <Mail size={10} /> : <Check size={10} />}
                      {ACTION_LABELS[rule.action_type] || rule.action_type}
                    </span>
                  </div>
                  {/* Config resumida */}
                  {rule.trigger_type === 'stage_change' && rule.trigger_config?.from_stage && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      De: {rule.trigger_config.from_stage} → Para: {rule.trigger_config.to_stage}
                    </p>
                  )}
                  {rule.trigger_type === 'inactivity' && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Após {rule.trigger_config?.days || 7} dias sem atividade
                    </p>
                  )}
                  {rule.action_type === 'email_client' && rule.action_config?.subject && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Assunto: {rule.action_config.subject}
                    </p>
                  )}
                  {rule.action_type === 'email_client' && rule.action_config?.from_name && (
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Remetente: {rule.action_config.from_name}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-2 hover:bg-[var(--bg-input)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  >
                    <Edit3 size={15} />
                  </button>
                  {deleteConfirm === rule.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-400 transition-all"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="p-1.5 hover:bg-[var(--bg-input)] rounded-lg text-[var(--text-muted)] transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(rule.id)}
                      className="p-2 hover:bg-[var(--bg-input)] rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}

      {/* Modal criar/editar */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden">
                {/* Modal header */}
                <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black tracking-tighter">
                      {editingRule ? 'Editar Regra' : 'Nova Regra de Automação'}
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                      {form.action_type === 'email_client' ? 'Notificação de Cliente (E-mail)' : 'Notificação Interna (Pop-up)'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-[var(--bg-input)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold">
                      {error}
                    </div>
                  )}

                  {/* Nome */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Nome da Regra *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Notificar equipe ao mudar etapa"
                      className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                  </div>

                  {/* Gatilho */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Gatilho (Quando?)
                    </label>
                    <select
                      value={form.trigger_type}
                      onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      {TRIGGER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Config do gatilho */}
                  {form.trigger_type === 'stage_change' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">De (Etapa)</label>
                        <select
                          value={form.trigger_from}
                          onChange={(e) => setForm({ ...form, trigger_from: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="">Qualquer</option>
                          {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Para (Etapa)</label>
                        <select
                          value={form.trigger_to}
                          onChange={(e) => setForm({ ...form, trigger_to: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="">Qualquer</option>
                          {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {form.trigger_type === 'inactivity' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        Dias de Inatividade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.trigger_days}
                        onChange={(e) => setForm({ ...form, trigger_days: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  )}

                  {/* Ação - apenas para regras internas */}
                  {form.action_type !== 'email_client' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          Ação (O quê?)
                        </label>
                        <select
                          value={form.action_type}
                          onChange={(e) => setForm({ ...form, action_type: e.target.value })}
                          className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          {INTERNAL_ACTION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {form.action_type === 'notify_team' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Mensagem</label>
                          <textarea
                            value={form.action_message}
                            onChange={(e) => setForm({ ...form, action_message: e.target.value })}
                            placeholder="Ex: Atenção: processo avançou para análise"
                            rows={2}
                            className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                      )}

                      {form.action_type === 'advance_stage' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Avançar Para</label>
                          <select
                            value={form.action_stage}
                            onChange={(e) => setForm({ ...form, action_stage: e.target.value })}
                            className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                          >
                            <option value="">Selecionar etapa</option>
                            {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      )}

                      {form.action_type === 'create_task' && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Título da Tarefa</label>
                          <input
                            type="text"
                            value={form.action_task}
                            onChange={(e) => setForm({ ...form, action_task: e.target.value })}
                            placeholder="Ex: Verificar documentação do cliente"
                            className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Campos de e-mail - apenas para regras de cliente */}
                  {form.action_type === 'email_client' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          Remetente
                        </label>
                        <input
                          type="text"
                          value={form.action_from_name}
                          onChange={(e) => setForm({ ...form, action_from_name: e.target.value })}
                          placeholder="Korus@NomeDaAgencia"
                          className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          Assunto do E-mail *
                        </label>
                        <input
                          type="text"
                          value={form.action_subject}
                          onChange={(e) => setForm({ ...form, action_subject: e.target.value })}
                          placeholder="Ex: Atualização do seu processo"
                          className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          Modelo do E-mail
                        </label>
                        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                          Variáveis:{' '}
                          {['{{client_name}}', '{{destination}}', '{{process_status}}', '{{internal_status}}', '{{consultant_name}}', '{{agency_name}}'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, action_email_body: f.action_email_body + v }))}
                              className="inline-block mr-1 mb-1 px-1.5 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded font-mono text-[9px] hover:bg-violet-500/20 transition-all cursor-pointer"
                            >
                              {v}
                            </button>
                          ))}
                        </p>
                        <textarea
                          value={form.action_email_body}
                          onChange={(e) => setForm({ ...form, action_email_body: e.target.value })}
                          placeholder="Olá {{client_name}}, seu processo foi atualizado para {{process_status}}..."
                          rows={5}
                          className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Modal footer */}
                <div className="p-6 border-t border-[var(--border-color)] flex items-center gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 brand-gradient text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : editingRule ? 'Salvar' : 'Criar Regra'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
