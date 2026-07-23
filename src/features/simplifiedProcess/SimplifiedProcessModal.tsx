import React from 'react';
import { X, UserPlus, Copy, CheckCircle2, Link, Plus, Trash2, Upload, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Destination, VisaType, Plan, SimplifiedProcessQuestion } from '../../types';
import { fixLegacyUrl } from '../../utils';

const API_URL = import.meta.env.VITE_API_URL || '';
const MAX_TOTAL_FILES = 10;

interface SimplifiedProcessModalProps {
  agencyId: number;
  token: string;
  destinations: Destination[];
  visaTypes: VisaType[];
  plans: Plan[];
  createdByUserId: number;
  initialClient?: { name: string; email?: string | null; phone?: string | null };
  onClose: () => void;
  onSuccess: (processId: number) => void;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
}

function isQuestionVisible(q: SimplifiedProcessQuestion, answers: Record<string, any>): boolean {
  if (!q.showIf || !q.showIf.questionId) return true;
  const depValue = answers[q.showIf.questionId];
  return String(depValue ?? '') === String(q.showIf.equals ?? '');
}

export const SimplifiedProcessModal: React.FC<SimplifiedProcessModalProps> = ({
  agencyId,
  token,
  destinations,
  visaTypes,
  plans,
  createdByUserId,
  initialClient,
  onClose,
  onSuccess,
}) => {
  const [questions, setQuestions] = React.useState<SimplifiedProcessQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(true);
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [filesByQuestion, setFilesByQuestion] = React.useState<Record<string, File[]>>({});
  const [visaTypeId, setVisaTypeId] = React.useState('');
  const [planId, setPlanId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successData, setSuccessData] = React.useState<{ processId: number; trackingUrl: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQuestions(true);
      try {
        const res = await fetch(`${API_URL}/api/agencies/${agencyId}/simplified-questions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setQuestions(sorted);
          // Pré-preenche respostas de nome/e-mail/telefone se um cliente inicial foi passado
          if (initialClient) {
            const prefill: Record<string, any> = {};
            for (const q of sorted) {
              if (q.systemField === 'client_name' && initialClient.name) prefill[q.id] = initialClient.name;
              if (q.systemField === 'client_email' && initialClient.email) prefill[q.id] = initialClient.email;
              if (q.systemField === 'client_phone' && initialClient.phone) prefill[q.id] = initialClient.phone;
            }
            setAnswers(prefill);
          }
        }
      } catch {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoadingQuestions(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const selectedPlan = React.useMemo(
    () => plans.find((p) => p.id === Number(planId)),
    [plans, planId]
  );

  const visibleQuestions = React.useMemo(
    () => questions.filter((q) => isQuestionVisible(q, answers)),
    [questions, answers]
  );

  const totalFilesSelected = React.useMemo(
    () => Object.values(filesByQuestion).reduce((sum, arr) => sum + arr.length, 0),
    [filesByQuestion]
  );

  const trackingLink = successData
    ? fixLegacyUrl(
        `https://api.korus.me/acompanhamento/${successData.trackingUrl.replace('/acompanhamento/', '')}`
      )
    : '';

  const setAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const setAddressAnswer = (questionId: string, field: 'cep' | 'address', value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || {}), [field]: value },
    }));
  };

  const handleFilesChange = (questionId: string, fileList: FileList | null, maxFiles: number) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).slice(0, maxFiles);
    setFilesByQuestion((prev) => ({ ...prev, [questionId]: incoming }));
  };

  const removeFile = (questionId: string, index: number) => {
    setFilesByQuestion((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] || []).filter((_, i) => i !== index),
    }));
  };

  const validate = (): string | null => {
    for (const q of visibleQuestions) {
      if (!q.required) continue;
      if (q.type === 'file') {
        if ((filesByQuestion[q.id] || []).length === 0) return `Anexe ao menos um arquivo em "${q.label}".`;
        continue;
      }
      if (q.type === 'address') {
        const val = answers[q.id];
        if (!val?.cep?.trim() || !val?.address?.trim()) return `Preencha "${q.label}" (CEP e endereço).`;
        continue;
      }
      const val = answers[q.id];
      if (val === undefined || val === null || String(val).trim() === '') {
        return `Preencha o campo obrigatório "${q.label}".`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('agency_id', String(agencyId));
      formData.append('created_by_user_id', String(createdByUserId));
      formData.append('answers', JSON.stringify(answers));
      if (visaTypeId) formData.append('visa_type_id', visaTypeId);
      if (planId) formData.append('plan_id', planId);
      if (description.trim()) formData.append('description', description.trim());
      Object.values(filesByQuestion).forEach((fileArr) => {
        fileArr.forEach((f) => formData.append('documents', f));
      });

      const res = await fetch(`${API_URL}/api/processes/simplified`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
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

  const inputClass = 'w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm transition-all';
  const labelClass = 'block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5';

  const renderQuestion = (q: SimplifiedProcessQuestion) => {
    const value = answers[q.id] ?? '';

    if (q.systemField === 'destination_id') {
      return (
        <select required={q.required} className={inputClass} value={value} onChange={(e) => setAnswer(q.id, e.target.value ? Number(e.target.value) : '')}>
          <option value="">Selecione o destino...</option>
          {destinations.filter((d) => d.is_active).map((d) => (
            <option key={d.id} value={d.id}>{d.flag} {d.name}</option>
          ))}
        </select>
      );
    }

    switch (q.type) {
      case 'textarea':
        return (
          <textarea
            required={q.required}
            rows={2}
            placeholder={q.placeholder}
            className={`${inputClass} resize-none`}
            value={value}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        );
      case 'cpf':
        return (
          <input
            type="text"
            required={q.required}
            placeholder="000.000.000-00"
            maxLength={14}
            className={inputClass}
            value={value}
            onChange={(e) => setAnswer(q.id, formatCPF(e.target.value))}
          />
        );
      case 'phone':
      case 'email':
        return (
          <div className="space-y-2">
            <input
              type={q.type === 'email' ? 'email' : 'tel'}
              required={q.required}
              placeholder={q.placeholder || (q.type === 'email' ? 'cliente@exemplo.com' : '+55 (11) 99999-9999')}
              className={inputClass}
              value={value}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
            {q.allowExtra && (
              <div className="space-y-2">
                {(answers[`${q.id}_extra`] || []).map((extra: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={q.type === 'email' ? 'email' : 'tel'}
                      className={inputClass}
                      value={extra}
                      onChange={(e) => {
                        const list = [...(answers[`${q.id}_extra`] || [])];
                        list[idx] = e.target.value;
                        setAnswer(`${q.id}_extra`, list);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const list = (answers[`${q.id}_extra`] || []).filter((_: string, i: number) => i !== idx);
                        setAnswer(`${q.id}_extra`, list);
                      }}
                      className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAnswer(`${q.id}_extra`, [...(answers[`${q.id}_extra`] || []), ''])}
                  className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                >
                  <Plus size={12} /> Adicionar {q.type === 'email' ? 'e-mail' : 'telefone'}
                </button>
              </div>
            )}
          </div>
        );
      case 'date':
        return (
          <input type="date" required={q.required} className={inputClass} value={value} onChange={(e) => setAnswer(q.id, e.target.value)} />
        );
      case 'boolean':
        return (
          <div className="flex gap-3">
            {['Sim', 'Não'].map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setAnswer(q.id, opt)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                  value === opt
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[var(--bg-input)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      case 'select':
        return (
          <select required={q.required} className={inputClass} value={value} onChange={(e) => setAnswer(q.id, e.target.value)}>
            <option value="">Selecione...</option>
            {(q.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'address': {
        const addr = answers[q.id] || {};
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required={q.required}
              placeholder="CEP"
              maxLength={9}
              className={inputClass}
              value={addr.cep || ''}
              onChange={(e) => setAddressAnswer(q.id, 'cep', formatCEP(e.target.value))}
            />
            <input
              type="text"
              required={q.required}
              placeholder="Endereço completo (rua, número, bairro, cidade/UF)"
              className={`${inputClass} sm:col-span-2`}
              value={addr.address || ''}
              onChange={(e) => setAddressAnswer(q.id, 'address', e.target.value)}
            />
          </div>
        );
      }
      case 'file': {
        const maxFiles = q.maxFiles || MAX_TOTAL_FILES;
        const currentFiles = filesByQuestion[q.id] || [];
        return (
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center px-6 py-6 bg-[var(--bg-input)] border-2 border-dashed border-[var(--border-color)] rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all group">
              <Upload className="text-[var(--text-muted)] group-hover:text-emerald-400 mb-2 transition-colors" size={22} />
              <span className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                Selecionar arquivos (máx. {maxFiles})
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => handleFilesChange(q.id, e.target.files, maxFiles)}
              />
            </label>
            {currentFiles.length > 0 && (
              <div className="space-y-1">
                {currentFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 bg-[var(--bg-input)]/60 rounded-lg border border-[var(--border-color)]">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-main)] truncate">
                      <FileText size={13} className="text-emerald-400 flex-shrink-0" /> {f.name}
                    </span>
                    <button type="button" onClick={() => removeFile(q.id, idx)} className="text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case 'text':
      default:
        return (
          <input
            type="text"
            required={q.required}
            placeholder={q.placeholder}
            className={inputClass}
            value={value}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        );
    }
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
                    <a href={trackingLink} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-emerald-400 font-bold break-all hover:text-emerald-300 transition-colors underline">{trackingLink}</a>
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
            ) : loadingQuestions ? (
              <div className="py-12 text-center text-sm text-[var(--text-muted)] font-bold">Carregando formulário...</div>
            ) : (
              /* Formulário dinâmico */
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

                {visibleQuestions.map((q) => (
                  <div key={q.id}>
                    <label className={labelClass}>
                      {q.label} {q.required ? <span className="text-red-400">*</span> : <span className="text-[var(--text-muted)] normal-case">(opcional)</span>}
                    </label>
                    {renderQuestion(q)}
                  </div>
                ))}

                {/* Tipo de Visto (opcional) */}
                <div>
                  <label className={labelClass}>
                    Tipo de Visto <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <select className={inputClass} value={visaTypeId} onChange={(e) => setVisaTypeId(e.target.value)}>
                    <option value="">Nenhum</option>
                    {visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Plano (opcional) */}
                <div>
                  <label className={labelClass}>
                    Plano de Consultoria <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
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

                {/* Descrição (opcional) */}
                <div>
                  <label className={labelClass}>
                    Descrição <span className="text-[var(--text-muted)]">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: cliente indicado, urgente, visto de estudante..."
                    className={`${inputClass} resize-none`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {totalFilesSelected > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)] font-bold">
                    {totalFilesSelected} arquivo(s) selecionado(s) no total.
                  </p>
                )}

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
