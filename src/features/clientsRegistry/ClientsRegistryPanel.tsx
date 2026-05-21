import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Upload,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Filter,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  FilePlus,
} from 'lucide-react';
import { Destination, VisaType, Plan } from '../../types';
import { SimplifiedProcessModal } from '../simplifiedProcess/SimplifiedProcessModal';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export interface ClientRecord {
  id: number;
  agency_id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: 'pre_registered' | 'active' | 'archived';
  imported: boolean;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
}

interface ClientsStats {
  total: number;
  pre_registered: number;
  active: number;
  imported: number;
}

interface ImportPreview {
  total: number;
  new_count: number;
  duplicates: number;
  errors: string[];
  preview: {
    full_name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    is_duplicate: boolean;
  }[];
}

interface ImportResult {
  total: number;
  created: number;
  duplicates: number;
  errors: string[];
  batch_id: string;
}

interface Props {
  apiUrl: string;
  token: string | null;
  agencyId: number;
  userId: number;
  userRole: string;
  notify: (msg: string, type: 'success' | 'error' | 'info') => void;
  destinations: Destination[];
  visaTypes: VisaType[];
  plans: Plan[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pre_registered: 'Pré-cadastro',
  active: 'Ativo',
  archived: 'Arquivado',
};

const STATUS_STYLE: Record<string, string> = {
  pre_registered: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)]',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${STATUS_STYLE[status] || STATUS_STYLE.pre_registered}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal de cliente (criação / edição)
// ─────────────────────────────────────────────────────────────────────────────
interface ClientModalProps {
  client: ClientRecord | null;
  agencyId: number;
  userId: number;
  apiUrl: string;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
  notify: Props['notify'];
}

function ClientModal({ client, agencyId, userId, apiUrl, token, onClose, onSaved, notify }: ClientModalProps) {
  const [form, setForm] = useState({
    full_name: client?.full_name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    city: client?.city || '',
    state: client?.state || '',
    status: client?.status || 'pre_registered',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { notify('Nome é obrigatório', 'error'); return; }
    setSaving(true);
    try {
      const url = client
        ? `${apiUrl}/api/clients/${client.id}`
        : `${apiUrl}/api/clients`;
      const method = client ? 'PATCH' : 'POST';
      const body = client
        ? { ...form, agency_id: agencyId }
        : { ...form, agency_id: agencyId, created_by: userId };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify((err as any).error || 'Erro ao salvar cliente', 'error');
        return;
      }
      notify(client ? 'Cliente atualizado!' : 'Cliente criado!', 'success');
      onSaved();
      onClose();
    } catch {
      notify('Erro de rede ao salvar cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Nome Completo *</label>
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nome completo"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Telefone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Cidade</label>
              <input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Cidade"
              />
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Estado</label>
              <input
                value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
          {client && (
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pre_registered">Pré-cadastro</option>
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl brand-gradient text-black text-sm font-black disabled:opacity-50 transition-all"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de importação Excel
// ─────────────────────────────────────────────────────────────────────────────
interface ImportModalProps {
  agencyId: number;
  userId: number;
  apiUrl: string;
  token: string | null;
  onClose: () => void;
  onImported: () => void;
  notify: Props['notify'];
}

function ClientImportModal({ agencyId, userId, apiUrl, token, onClose, onImported, notify }: ImportModalProps) {
  const [step, setStep] = useState<'select' | 'preview' | 'result'>('select');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agency_id', String(agencyId));

      const res = await fetch(`${apiUrl}/api/clients/import/preview`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify((err as any).error || 'Erro ao ler arquivo', 'error');
        return;
      }
      const data: ImportPreview = await res.json();
      setPreview(data);
      setStep('preview');
    } catch {
      notify('Erro de rede ao ler arquivo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agency_id', String(agencyId));
      formData.append('created_by', String(userId));

      const res = await fetch(`${apiUrl}/api/clients/import`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify((err as any).error || 'Erro na importação', 'error');
        return;
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setStep('result');
      onImported();
      notify(`Importação concluída: ${data.created} clientes adicionados`, 'success');
    } catch {
      notify('Erro de rede na importação', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === 'select' ? onClose : undefined} />
      <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-black" />
            </div>
            <div>
              <h3 className="text-lg font-black">Importar Clientes</h3>
              <p className="text-xs text-[var(--text-muted)]">Suporta .xlsx e .csv • Máximo 10MB / 5.000 registros</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['select', 'preview', 'result'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${step === s ? 'brand-gradient text-black' : ((['select', 'preview', 'result'].indexOf(step) > i) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-input)] text-[var(--text-muted)]')}`}>
                {i + 1}
              </div>
              <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                {s === 'select' ? 'Arquivo' : s === 'preview' ? 'Prévia' : 'Resultado'}
              </span>
              {i < 2 && <div className="w-8 h-px bg-[var(--border-color)]" />}
            </div>
          ))}
        </div>

        {/* Step: Selecionar arquivo */}
        {step === 'select' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            >
              <Upload size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="font-bold text-sm">{file ? file.name : 'Arraste o arquivo ou clique para selecionar'}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Formatos aceitos: .xlsx, .csv</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />

            <div className="bg-[var(--bg-input)] rounded-xl p-4 text-xs text-[var(--text-muted)]">
              <p className="font-black uppercase tracking-widest mb-2">Colunas esperadas na planilha:</p>
              <div className="grid grid-cols-2 gap-1">
                {[['NOME', 'Nome completo (obrigatório)'], ['TELEFONE', 'Celular ou fixo'], ['EMAIL', 'Endereço de e-mail'], ['CIDADE', 'Cidade de residência'], ['ESTADO', 'UF (ex: SP)']].map(([col, desc]) => (
                  <div key={col} className="flex gap-2">
                    <span className="text-emerald-400 font-black">{col}</span>
                    <span>— {desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="flex-1 px-4 py-2.5 rounded-xl brand-gradient text-black text-sm font-black disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Lendo...' : 'Próximo →'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Prévia */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-emerald-400">{preview.new_count}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold">Novos</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-amber-400">{preview.duplicates}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold">Duplicatas</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-400">{preview.errors.length}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold">Erros</p>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-xs font-black text-red-400 mb-2 uppercase tracking-widest">Erros encontrados:</p>
                {preview.errors.map((e, i) => <p key={i} className="text-xs text-[var(--text-muted)]">{e}</p>)}
              </div>
            )}

            <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg-input)] text-[var(--text-muted)]">
                    <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Nome</th>
                    <th className="px-3 py-2 text-left font-black uppercase tracking-widest hidden sm:table-cell">Telefone</th>
                    <th className="px-3 py-2 text-left font-black uppercase tracking-widest hidden md:table-cell">E-mail</th>
                    <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className={`border-t border-[var(--border-color)] ${row.is_duplicate ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{row.full_name}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)] hidden sm:table-cell">{row.phone || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)] hidden md:table-cell">{row.email || '—'}</td>
                      <td className="px-3 py-2">
                        {row.is_duplicate
                          ? <span className="text-amber-400 font-black text-[10px] uppercase">Duplicata</span>
                          : <span className="text-emerald-400 font-black text-[10px] uppercase">Novo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.total > preview.preview.length && (
                <p className="text-center text-xs text-[var(--text-muted)] py-2">
                  + {preview.total - preview.preview.length} linha(s) não exibida(s) na prévia
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('select')} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all">
                ← Voltar
              </button>
              <button
                onClick={handleImport}
                disabled={loading || preview.new_count === 0}
                className="flex-1 px-4 py-2.5 rounded-xl brand-gradient text-black text-sm font-black disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Importando...' : `Importar ${preview.new_count} cliente(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Resultado */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-400" />
              <h4 className="text-xl font-black">Importação Concluída!</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-input)] rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-[var(--text-main)]">{result.total}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Total linhas</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-emerald-400">{result.created}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Criados</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-amber-400">{result.duplicates}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Duplicatas</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-red-400">{result.errors.length}</p>
                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">Erros</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-black text-red-400 mb-2 uppercase tracking-widest">Erros:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-[var(--text-muted)]">{e}</p>)}
              </div>
            )}
            <button onClick={onClose} className="w-full px-4 py-2.5 rounded-xl brand-gradient text-black text-sm font-black">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel principal
// ─────────────────────────────────────────────────────────────────────────────
export function ClientsRegistryPanel({ apiUrl, token, agencyId, userId, userRole, notify, destinations, visaTypes, plans }: Props) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ClientsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [clientForProcess, setClientForProcess] = useState<ClientRecord | null>(null);

  const isMasterOrSupervisor = userRole === 'master' || userRole === 'supervisor';
  const canCreateProcess = userRole === 'master' || userRole === 'supervisor' || userRole === 'analyst';

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        agency_id: String(agencyId),
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${apiUrl}/api/clients?${params}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.clients || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('[CLIENTS FETCH]', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, agencyId, page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/clients/stats?agency_id=${agencyId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) return;
      setStats(await res.json());
    } catch {}
  }, [apiUrl, token, agencyId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDelete = async (client: ClientRecord) => {
    if (!window.confirm(`Excluir "${client.full_name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`${apiUrl}/api/clients/${client.id}?agency_id=${agencyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) { notify('Erro ao excluir cliente', 'error'); return; }
      notify('Cliente excluído', 'success');
      fetchClients();
      fetchStats();
    } catch { notify('Erro de rede', 'error'); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-emerald-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Total</span>
            </div>
            <p className="text-3xl font-black">{stats.total}</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Clock size={18} className="text-amber-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Pré-cadastro</span>
            </div>
            <p className="text-3xl font-black text-amber-400">{stats.pre_registered}</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Ativos</span>
            </div>
            <p className="text-3xl font-black text-emerald-400">{stats.active}</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Upload size={18} className="text-blue-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Importados</span>
            </div>
            <p className="text-3xl font-black text-blue-400">{stats.imported}</p>
          </div>
        </div>
      )}

      {/* Barra de ações */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nome, e-mail ou telefone..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-all ${showFilters ? 'brand-gradient text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]'}`}
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isMasterOrSupervisor && (
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-sm font-bold transition-all"
              >
                <Upload size={16} />
                <span className="hidden sm:inline">Importar Excel</span>
              </button>
            )}
            <button
              onClick={() => { setEditingClient(null); setShowClientModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl brand-gradient text-black text-sm font-black"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo Cliente</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos os status</option>
              <option value="pre_registered">Pré-cadastro</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1">
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
            Carregando...
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="font-bold">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">Importe uma planilha ou adicione manualmente</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-input)]">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Nome</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hidden sm:table-cell">Telefone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hidden md:table-cell">E-mail</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hidden lg:table-cell">Cidade</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hidden lg:table-cell">UF</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-input)]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold">{client.full_name}</div>
                        {client.imported && (
                          <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Importado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)] hidden sm:table-cell">{client.phone || '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)] hidden md:table-cell">{client.email || '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)] hidden lg:table-cell">{client.city || '—'}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)] hidden lg:table-cell">{client.state || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingClient(client); setShowClientModal(true); }}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          {canCreateProcess && (
                            <button
                              onClick={() => setClientForProcess(client)}
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                              title="Criar Processo Simplificado"
                            >
                              <FilePlus size={15} />
                            </button>
                          )}
                          {isMasterOrSupervisor && (
                            <button
                              onClick={() => handleDelete(client)}
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
                <span className="text-xs text-[var(--text-muted)]">
                  {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold">{page} / {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modais */}
      {showClientModal && (
        <ClientModal
          client={editingClient}
          agencyId={agencyId}
          userId={userId}
          apiUrl={apiUrl}
          token={token}
          onClose={() => setShowClientModal(false)}
          onSaved={() => { fetchClients(); fetchStats(); }}
          notify={notify}
        />
      )}
      {showImportModal && (
        <ClientImportModal
          agencyId={agencyId}
          userId={userId}
          apiUrl={apiUrl}
          token={token}
          onClose={() => setShowImportModal(false)}
          onImported={() => { fetchClients(); fetchStats(); }}
          notify={notify}
        />
      )}
      {clientForProcess && (
        <SimplifiedProcessModal
          agencyId={agencyId}
          token={token || ''}
          destinations={destinations}
          visaTypes={visaTypes}
          plans={plans}
          createdByUserId={userId}
          initialClient={{ name: clientForProcess.full_name, email: clientForProcess.email, phone: clientForProcess.phone }}
          onClose={() => setClientForProcess(null)}
          onSuccess={() => { setClientForProcess(null); fetchClients(); }}
        />
      )}
    </div>
  );
}
