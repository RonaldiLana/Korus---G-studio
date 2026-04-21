import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, ClipboardList, ChevronDown, ChevronUp, Edit2, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_URL = import.meta.env.VITE_API_URL?.trim() || 'https://korus-backend-a55k.onrender.com';

async function apiRequest(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

interface Form {
  id?: number;
  agency_id?: number | null;
  visa_type_id?: number | null;
  destination_id?: number | null;
  title: string;
  fields: FormField[];
  visa_type_name?: string;
  destination_name?: string;
}

interface VisaType { id: number; name: string; }
interface Destination { id: number; name: string; }

interface FormsPanelProps {
  agencyId: number | null;
  userRole: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function FormsPanel({ agencyId, userRole }: FormsPanelProps) {
  const [forms, setForms] = useState<Form[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [expandedForm, setExpandedForm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const canEdit = userRole === 'master' || userRole === 'supervisor';

  useEffect(() => {
    fetchAll();
  }, [agencyId]);

  async function fetchAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agencyId) params.set('agency_id', String(agencyId));
      const [f, vt, dest] = await Promise.all([
        apiRequest(`${API_URL}/api/forms?${params}`),
        agencyId
          ? apiRequest(`${API_URL}/api/visa-types?agency_id=${agencyId}`)
          : apiRequest(`${API_URL}/api/visa-types`),
        agencyId
          ? apiRequest(`${API_URL}/api/destinations?agency_id=${agencyId}`)
          : apiRequest(`${API_URL}/api/destinations`),
      ]);
      setForms(Array.isArray(f) ? f : []);
      setVisaTypes(Array.isArray(vt) ? vt : []);
      setDestinations(Array.isArray(dest) ? dest : []);
    } catch (e: any) {
      setError('Erro ao carregar formulários');
    } finally {
      setLoading(false);
    }
  }

  function startNewForm() {
    setEditingForm({
      title: '',
      agency_id: agencyId,
      visa_type_id: null,
      destination_id: null,
      fields: [],
    });
  }

  function startEditForm(form: Form) {
    setEditingForm({ ...form, fields: form.fields.map(f => ({ ...f })) });
  }

  function addField() {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      fields: [
        ...editingForm.fields,
        { id: generateId(), label: '', type: 'text', required: false },
      ],
    });
  }

  function removeField(fieldId: string) {
    if (!editingForm) return;
    setEditingForm({ ...editingForm, fields: editingForm.fields.filter(f => f.id !== fieldId) });
  }

  function updateField(fieldId: string, updates: Partial<FormField>) {
    if (!editingForm) return;
    setEditingForm({
      ...editingForm,
      fields: editingForm.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f),
    });
  }

  async function saveForm() {
    if (!editingForm || !editingForm.title.trim()) {
      setError('Título é obrigatório');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        agency_id: editingForm.agency_id || agencyId,
        visa_type_id: editingForm.visa_type_id || null,
        destination_id: editingForm.destination_id || null,
        title: editingForm.title,
        fields: editingForm.fields,
      };
      if (editingForm.id) {
        await apiRequest(`${API_URL}/api/forms/${editingForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`${API_URL}/api/forms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setSuccess('Formulário salvo com sucesso!');
      setEditingForm(null);
      fetchAll();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError('Erro ao salvar formulário');
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm(formId: number) {
    if (!confirm('Tem certeza que deseja excluir este formulário?')) return;
    try {
      await apiRequest(`${API_URL}/api/forms/${formId}`, { method: 'DELETE' });
      fetchAll();
    } catch (e: any) {
      setError('Erro ao excluir formulário');
    }
  }

  const groupedForms = forms.reduce((acc: Record<string, Form[]>, form) => {
    const key = form.destination_name || 'Sem destino';
    if (!acc[key]) acc[key] = [];
    acc[key].push(form);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center">
            <ClipboardList size={20} className="text-black" />
          </div>
          <div>
            <h2 className="text-xl font-black">Formulários</h2>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Gerencie os formulários por destino e tipo de visto
            </p>
          </div>
        </div>
        {canEdit && !editingForm && (
          <button
            onClick={startNewForm}
            className="flex items-center gap-2 px-5 py-2.5 brand-gradient text-black font-black text-sm rounded-xl hover:opacity-90 transition-all"
          >
            <Plus size={16} />
            Novo Formulário
          </button>
        )}
      </div>

      {/* Mensagens */}
      <AnimatePresence mode="popLayout">
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium"
          >
            <Check size={16} /> {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium"
          >
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor de formulário */}
      <AnimatePresence>
        {editingForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base">{editingForm.id ? 'Editar Formulário' : 'Novo Formulário'}</h3>
              <button onClick={() => setEditingForm(null)} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]">
                <X size={18} />
              </button>
            </div>

            {/* Título */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1.5">Título do Formulário</label>
              <input
                value={editingForm.title}
                onChange={e => setEditingForm({ ...editingForm, title: e.target.value })}
                placeholder="Ex: Formulário de Visto de Turismo"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Destino + Tipo de Visto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1.5">Destino</label>
                <select
                  value={editingForm.destination_id || ''}
                  onChange={e => setEditingForm({ ...editingForm, destination_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todos os destinos</option>
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1.5">Tipo de Visto</label>
                <select
                  value={editingForm.visa_type_id || ''}
                  onChange={e => setEditingForm({ ...editingForm, visa_type_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Todos os vistos</option>
                  {visaTypes.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Campos do Formulário</label>
                <button
                  onClick={addField}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
                >
                  <Plus size={12} /> Adicionar Campo
                </button>
              </div>

              <div className="space-y-3">
                {editingForm.fields.length === 0 && (
                  <p className="text-center text-[var(--text-muted)] text-sm py-4 bg-[var(--bg-input)] rounded-xl">
                    Nenhum campo adicionado. Clique em "Adicionar Campo" para começar.
                  </p>
                )}
                {editingForm.fields.map((field, idx) => (
                  <div key={field.id} className="bg-[var(--bg-input)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Campo {idx + 1}</span>
                      <button onClick={() => removeField(field.id)} className="p-1 text-red-400 hover:bg-red-400/10 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-1 block">Rótulo</label>
                        <input
                          value={field.label}
                          onChange={e => updateField(field.id, { label: e.target.value })}
                          placeholder="Ex: Nome completo"
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-1 block">Tipo</label>
                        <select
                          value={field.type}
                          onChange={e => updateField(field.id, { type: e.target.value as any })}
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        >
                          {FIELD_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-1 block">Opções (separadas por vírgula)</label>
                        <input
                          value={(field.options || []).join(', ')}
                          onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="Opção 1, Opção 2, Opção 3"
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateField(field.id, { required: !field.required })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${field.required ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-[var(--text-muted)] border border-[var(--border-color)]'}`}
                      >
                        {field.required ? '★ Obrigatório' : '☆ Opcional'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveForm}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 brand-gradient text-black font-black text-sm rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar Formulário'}
              </button>
              <button
                onClick={() => setEditingForm(null)}
                className="px-6 py-2.5 bg-white/5 border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-sm rounded-xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de formulários agrupados por destino */}
      {loading ? (
        <div className="text-center py-16 text-[var(--text-muted)]">Carregando formulários...</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold">Nenhum formulário cadastrado</p>
          <p className="text-sm mt-1">Clique em "Novo Formulário" para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedForms).map(([destination, destForms]) => (
            <div key={destination} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden">
              <div className="px-6 py-4 bg-white/3 border-b border-[var(--border-color)]">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{destination}</h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {destForms.map(form => (
                  <div key={form.id}>
                    <div
                      className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/3 transition-all"
                      onClick={() => setExpandedForm(expandedForm === form.id ? null : form.id!)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{form.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {form.visa_type_name && (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                              {form.visa_type_name}
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-muted)]">
                            {form.fields.length} campo{form.fields.length !== 1 ? 's' : ''} ·{' '}
                            {form.fields.filter(f => f.required).length} obrigatório{form.fields.filter(f => f.required).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); startEditForm(form); }}
                              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteForm(form.id!); }}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-all"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {expandedForm === form.id ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedForm === form.id && form.fields.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4 pt-1 grid grid-cols-2 gap-2">
                            {form.fields.map((field, idx) => (
                              <div key={field.id} className="flex items-start gap-2 bg-[var(--bg-input)] rounded-xl px-3 py-2">
                                <span className="text-[10px] font-black text-[var(--text-muted)] mt-0.5 w-5 shrink-0">{idx + 1}.</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">{field.label || '(sem rótulo)'}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-[var(--text-muted)]">{FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}</span>
                                    {field.required && <span className="text-[10px] text-red-400 font-black">• Obrigatório</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
