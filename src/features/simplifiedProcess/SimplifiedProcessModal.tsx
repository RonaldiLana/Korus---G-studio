import React from 'react';
import { X, UserPlus, AlertTriangle, Copy, CheckCircle2, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Destination, VisaType, Plan } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SimplifiedProcessModalProps {
  agencyId: number;
  token: string;
  destinations: Destination[];
  visaTypes: VisaType[];
  plans: Plan[];
  createdByUserId: number;
  onClose: () => void;
  onSuccess: (processId: number) => void;
}

interface FormState {
  client_name: string;
  client_email: string;
  client_phone: string;
  destination_id: string;
  visa_type_id: string;
  plan_id: string;
}

const initialForm: FormState = {
  client_name: '',
  client_email: '',
  client_phone: '',
  destination_id: '',
  visa_type_id: '',
  plan_id: '',
};

export const SimplifiedProcessModal: React.FC<SimplifiedProcessModalProps> = ({
  agencyId,
  token,
  destinations,
  visaTypes,
  plans,
  createdByUserId,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = React.useState<FormState>(initialForm);
  const [clientExists, setClientExists] = React.useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successData, setSuccessData] = React.useState<{ processId: number; trackingUrl: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

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
      const res = await fetch(
        `${API_URL}/api/clients/overview?agency_id=${agencyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
        created_by_user_id: createdByUserId,
        client_name: form.client_name.trim(),
        client_email: form.client_email.trim().toLowerCase(),
        client_phone: form.client_phone.trim(),
        destination_id: Number(form.destination_id),
      };
      if (form.visa_type_id) payload.visa_type_id = Number(form.visa_type_id);
      if (form.plan_id) payload.plan_id = Number(form.plan_id);

      const res = await fetch(`${API_URL}/api/processes/simplified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Erro ao criar processo.');
        return;
      }
      setSuccessData({ processId: data.process_id, trackingUrl: data.tracking_url });
      onSuccess(data.process_id);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="bg-[var(--bg-card)] w-full max-w-lg rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
              <UserPlus className="text-black" size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter">Novo Processo Simplificado</h2>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                Abertura rápida pela agência
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-input)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {successData ? (
              /* Tela de sucesso */
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={36} className="text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-black text-[var(--text-main)]">Processo Criado!</h3>
                  <p className="text-sm text-[var(--text-muted)] text-center">
                    Processo Simplificado <span className="text-emerald-400 font-black">#{successData.processId}</span> criado com sucesso. Compartilhe o link abaixo com o cliente.
                  </p>
                </div>

                <div className="p-4 bg-[var(--bg-input)]/60 border border-[var(--border-color)] rounded-2xl space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
                    <Link size={10} /> Link de Acompanhamento
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs text-emerald-400 font-bold break-all">{trackingLink}</p>
                    <button
                      onClick={copyLink}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full brand-gradient text-black py-3 rounded-xl font-black text-sm hover:opacity-90 transition-all"
                >
                  Fechar
                </button>
              </motion.div>
            ) : (
              /* Formulário */
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold">
                    {error}
                  </div>
                )}

                {/* Nome */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    Nome Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do cliente"
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    E-mail <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="cliente@exemplo.com"
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.client_email}
                    onChange={(e) => { setForm({ ...form, client_email: e.target.value }); setClientExists(null); }}
                    onBlur={checkEmail}
                  />
                  <AnimatePresence>
                    {checkingEmail && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-[var(--text-muted)] mt-1.5 font-bold">
                        Verificando cadastro...
                      </motion.p>
                    )}
                    {!checkingEmail && clientExists === false && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                      >
                        <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-400 leading-relaxed">
                          Nenhum cadastro encontrado. O sistema irá criar automaticamente um novo cliente para este e-mail.
                        </p>
                      </motion.div>
                    )}
                    {!checkingEmail && clientExists === true && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-emerald-400 mt-1.5 font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> Cliente já cadastrado na agência.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    Telefone / WhatsApp <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+55 (11) 99999-9999"
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                </div>

                {/* Destino */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    País / Destino <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.destination_id}
                    onChange={(e) => setForm({ ...form, destination_id: e.target.value })}
                  >
                    <option value="">Selecione o destino...</option>
                    {destinations.filter((d) => d.is_active).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.flag} {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Visto (opcional) */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    Tipo de Visto <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.visa_type_id}
                    onChange={(e) => setForm({ ...form, visa_type_id: e.target.value })}
                  >
                    <option value="">Nenhum</option>
                    {visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Plano (opcional) */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                    Plano de Consultoria <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all"
                    value={form.plan_id}
                    onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                  >
                    <option value="">Nenhum</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </option>
                    ))}
                  </select>
                  {selectedPlan && (
                    <p className="text-[10px] text-emerald-400 mt-1.5 font-bold">
                      Valor lançado como receita: {Number(selectedPlan.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl font-bold text-sm text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 brand-gradient text-black py-3 rounded-xl font-black text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg brand-shadow"
                  >
                    {saving ? 'Criando...' : 'Criar Processo'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
