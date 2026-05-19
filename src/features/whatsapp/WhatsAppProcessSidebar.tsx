import React, { useState } from 'react';
import { UserPlus, AlertCircle, CheckCircle2, Copy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Destination, VisaType, Plan } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface WhatsAppProcessSidebarProps {
  agencyId: number;
  token: string;
  user: { id: number; role: string };
  destinations: Destination[];
  visaTypes: VisaType[];
  plans: Plan[];
  onProcessCreated?: (processId: number) => void;
  onClose?: () => void;
}

interface FormState {
  client_name: string;
  client_email: string;
  client_phone: string;
  destination_id: string;
  visa_type_id: string;
  plan_id: string;
  description: string;
}

const initialForm: FormState = {
  client_name: '',
  client_email: '',
  client_phone: '',
  destination_id: '',
  visa_type_id: '',
  plan_id: '',
  description: '',
};

export const WhatsAppProcessSidebar: React.FC<WhatsAppProcessSidebarProps> = ({
  agencyId,
  token,
  user,
  destinations,
  visaTypes,
  plans,
  onProcessCreated,
  onClose,
}) => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [clientExists, setClientExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{ processId: number; trackingUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedPlan = React.useMemo(
    () => plans.find((p) => p.id === Number(form.plan_id)),
    [plans, form.plan_id]
  );

  const trackingLink = successData
    ? `${window.location.origin}/acompanhamento/${successData.trackingUrl.replace('/acompanhamento/', '')}`
    : '';

  const checkEmail = async () => {
    const email = form.client_email.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    setCheckingEmail(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/overview?agency_id=${agencyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const clients: any[] = await res.json();
        const found = clients.some((c: any) => c.email?.toLowerCase() === email);
        setClientExists(found);
      }
    } catch {
      setClientExists(null);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.client_name.trim() || !form.client_email.trim() || !form.client_phone.trim() || !form.destination_id) {
      setError('Preencha os campos obrigatórios: nome, e-mail, telefone e destino.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        agency_id: agencyId,
        created_by_user_id: user.id,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim().toLowerCase(),
        client_phone: form.client_phone.trim(),
        destination_id: Number(form.destination_id),
      };
      if (form.visa_type_id) payload.visa_type_id = Number(form.visa_type_id);
      if (form.plan_id) payload.plan_id = Number(form.plan_id);
      if (form.description.trim()) payload.description = form.description.trim();

      const res = await fetch(`${API_URL}/api/processes/simplified`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Erro ao criar processo.');
        return;
      }
      setSuccessData({ processId: data.process_id, trackingUrl: data.tracking_url });
      onProcessCreated?.(data.process_id);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(trackingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setForm(initialForm);
    setClientExists(null);
    setError('');
    setSuccessData(null);
    setCopied(false);
    onClose?.();
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[var(--bg-panel)] to-[var(--bg-panel)]/80 backdrop-blur-sm p-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
            <UserPlus className="text-black" size={18} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tighter">Novo Processo</h3>
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">
              Via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        <AnimatePresence mode="wait">
          {successData ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Success Message */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-400">Processo criado com sucesso!</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    ID do processo: <strong className="text-[var(--text-main)]">#{successData.processId}</strong>
                  </p>
                </div>
              </div>

              {/* Tracking Link */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Link de Acompanhamento
                </p>
                <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-xl px-4 py-3 border border-[var(--border-color)]">
                  <input
                    type="text"
                    readOnly
                    value={trackingLink}
                    className="flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none overflow-hidden text-ellipsis"
                  />
                  <button
                    onClick={copyLink}
                    className="flex-shrink-0 p-2 hover:bg-[var(--border-color)] rounded-lg transition-colors"
                    title="Copiar link"
                  >
                    <Copy size={16} className={copied ? 'text-emerald-400' : 'text-[var(--text-muted)]'} />
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Link copiado!
                  </p>
                )}
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-input)] transition-all text-sm font-bold flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Novo Processo
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Client Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                  placeholder="Ex: João Silva"
                />
              </div>

              {/* Client Email */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  E-mail *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={form.client_email}
                    onChange={(e) => {
                      setForm({ ...form, client_email: e.target.value });
                      setClientExists(null);
                    }}
                    onBlur={checkEmail}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                    placeholder="Ex: joao@email.com"
                  />
                  {checkingEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {clientExists !== null && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`text-xs font-bold ${
                        clientExists ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {clientExists
                        ? '⚠️ Este cliente já existe no sistema. Verifique antes de continuar.'
                        : '✓ Novo cliente'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Client Phone */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>

              {/* Destination */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Destino *
                </label>
                <select
                  value={form.destination_id}
                  onChange={(e) => setForm({ ...form, destination_id: e.target.value, visa_type_id: '' })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                >
                  <option value="">Selecione um destino...</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visa Type */}
              {form.destination_id && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    Tipo de Visto
                  </label>
                  <select
                    value={form.visa_type_id}
                    onChange={(e) => setForm({ ...form, visa_type_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                  >
                    <option value="">Selecione um tipo...</option>
                    {visaTypes
                      .filter((v) => Number(v.destination_id) === Number(form.destination_id))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Plan */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Plano
                </label>
                <select
                  value={form.plan_id}
                  onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm"
                >
                  <option value="">Selecione um plano...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Details */}
              {selectedPlan && (
                <div className="bg-[var(--bg-input)] rounded-xl p-4 border border-[var(--border-color)] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {selectedPlan.name}
                  </p>
                  {selectedPlan.description && (
                    <p className="text-xs text-[var(--text-muted)]">{selectedPlan.description}</p>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Observações
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20 transition-all text-sm resize-none"
                  placeholder="Observações adicionais (opcional)..."
                  rows={3}
                />
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                >
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl brand-gradient text-black font-bold hover:opacity-90 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Criar Processo
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
