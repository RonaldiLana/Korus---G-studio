import React from 'react';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { ClientProfileAnswer } from '../../types';
import { hasValue } from './clientFormat';

export type EditValues = Record<string, string | boolean>;

interface AnswerEditorProps {
  items: ClientProfileAnswer[];
  note?: string;
  onCancel: () => void;
  // Retorna a mensagem de erro (ou null quando salvou com sucesso)
  onSave: (values: EditValues) => Promise<string | null>;
}

const YES_NO = ['Sim', 'Não'];

const inputClass =
  'w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none transition-all focus:ring-2 focus:ring-emerald-500/50';

const isBooleanField = (item: ClientProfileAnswer) => item.type === 'boolean' || typeof item.value === 'boolean';

// Valores compostos (listas, endereços) não são editados aqui para não corromper o dado original
const isEditable = (item: ClientProfileAnswer) =>
  !!item.key && (item.value === null || item.value === undefined || ['string', 'number', 'boolean'].includes(typeof item.value));

function toDraft(item: ClientProfileAnswer): string {
  const value = item.value;
  if (!hasValue(value)) return '';
  if (isBooleanField(item)) {
    const text = String(value).trim().toLowerCase();
    if (text === 'true' || text === 'sim') return 'Sim';
    if (text === 'false' || text === 'não' || text === 'nao') return 'Não';
    return String(value);
  }
  if (item.type === 'date') return String(value).slice(0, 10);
  return String(value);
}

function fromDraft(item: ClientProfileAnswer, draft: string): string | boolean {
  const text = draft.trim();
  // Mantém o formato original: se o dado era booleano, continua booleano
  if (typeof item.value === 'boolean' && (text === 'Sim' || text === 'Não')) return text === 'Sim';
  return text;
}

export const AnswerEditor: React.FC<AnswerEditorProps> = ({ items, note, onCancel, onSave }) => {
  const editableItems = items.filter(isEditable);
  const [draft, setDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(editableItems.map((item) => [item.key as string, toDraft(item)]))
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    const changed: EditValues = {};
    editableItems.forEach((item) => {
      const key = item.key as string;
      const current = draft[key] ?? '';
      if (item.required && current.trim() === '') errors[key] = 'Campo obrigatório';
      if (current !== toDraft(item)) changed[key] = fromDraft(item, current);
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (Object.keys(changed).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onSave(changed);
    setSaving(false);
    if (message) setError(message);
  };

  const renderInput = (item: ClientProfileAnswer) => {
    const key = item.key as string;
    const value = draft[key] ?? '';
    const onChange = (next: string) => setDraft((prev) => ({ ...prev, [key]: next }));
    const id = `edit-${key}`;

    if (isBooleanField(item) || ((item.type === 'select' || item.type === 'radio') && (item.options?.length ?? 0) > 0)) {
      const base = isBooleanField(item) ? YES_NO : (item.options as string[]);
      const options = value && !base.includes(value) ? [...base, value] : base;
      return (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Selecione...</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    if (item.type === 'date') return <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
    if (item.type === 'email') return <input id={id} type="email" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
    if (item.type === 'phone') return <input id={id} type="tel" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
    if (value.length > 90) {
      return <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-y`} />;
    }
    return <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[var(--bg-input)]/30 p-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const editable = isEditable(item);
          const key = item.key as string;
          return (
            <div key={`${item.key ?? item.label}-${index}`} className="min-w-0">
              <label htmlFor={`edit-${key}`} className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {item.label}
                {item.required && <span className="ml-1 text-red-400">*</span>}
              </label>
              {editable ? (
                renderInput(item)
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-muted)]" title="Este tipo de resposta não pode ser editado aqui">
                  {Array.isArray(item.value) ? item.value.join(', ') : JSON.stringify(item.value)}
                </p>
              )}
              {fieldErrors[key] && <p className="mt-1 text-[11px] font-semibold text-red-400">{fieldErrors[key]}</p>}
            </div>
          );
        })}
      </div>

      {note && <p className="mt-4 text-[11px] font-medium text-[var(--text-muted)]">{note}</p>}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] transition-all hover:text-[var(--text-main)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-black transition-all hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
};
