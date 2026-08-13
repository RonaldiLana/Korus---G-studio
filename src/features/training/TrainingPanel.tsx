import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, Plus, Upload, Eye, ShieldCheck, Lock, Trash2, NotebookPen } from 'lucide-react';
import type { User } from '../../types';

interface TrainingFolder {
  id: number;
  agency_id: number;
  name: string;
  description?: string | null;
  created_by?: number | null;
  is_active?: boolean;
  created_at: string;
}

interface TrainingMaterial {
  id: number;
  agency_id: number;
  folder_id: number | null;
  title: string;
  description?: string | null;
  file_url: string;
  file_name: string;
  mime_type?: string;
  created_by?: number | null;
  status?: 'draft' | 'published';
  available_for_roles?: string[];
  created_at: string;
}

interface TrainingPanelProps {
  agencyId: number | null;
  user: User | null;
  token: string | null;
  apiUrl: string;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const rolePriority = ['master', 'supervisor', 'gerente_financeiro', 'consultant', 'analyst'];

const canManageTraining = (user: User | null) => {
  if (!user) return false;
  return user.role === 'master' || user.role === 'supervisor';
};

const canReadTraining = (user: User | null) => {
  if (!user) return false;
  return ['master', 'supervisor', 'consultant', 'analyst', 'gerente_financeiro'].includes(user.role);
};

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    master: 'Master',
    supervisor: 'Supervisor',
    consultant: 'Consultor',
    analyst: 'Analista',
    gerente_financeiro: 'Financeiro',
  };
  return labels[role] || role;
};

export function TrainingPanel({ agencyId, user, token, apiUrl, notify }: TrainingPanelProps) {
  const [folders, setFolders] = useState<TrainingFolder[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    return ['master', 'supervisor', 'gerente_financeiro', 'consultant', 'analyst'];
  }, []);

  const visibleMaterials = useMemo(() => {
    if (!user) return [];
    return materials.filter((item) => {
      if (!item.available_for_roles || item.available_for_roles.length === 0) return true;
      return item.available_for_roles.includes(user.role);
    });
  }, [materials, user]);

  const loadData = async () => {
    if (!agencyId || !user) return;
    try {
      const foldersRes = await fetch(`${apiUrl}/api/training/folders?agency_id=${agencyId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (foldersRes.ok) {
        const foldersData = await foldersRes.json();
        setFolders(Array.isArray(foldersData) ? foldersData : foldersData.folders || []);
      }

      const materialsRes = await fetch(`${apiUrl}/api/training/materials?agency_id=${agencyId}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        setMaterials(Array.isArray(materialsData) ? materialsData : materialsData.materials || []);
      }
    } catch (error) {
      console.error('[TRAINING] loadData error:', error);
    }
  };

  useEffect(() => {
    if (agencyId && canReadTraining(user)) {
      loadData();
    }
  }, [agencyId, user, token]);

  useEffect(() => {
    if (folders.length > 0 && !selectedFolderId) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;

  const folderMaterials = visibleMaterials.filter((item) => item.folder_id === selectedFolderId);

  const createFolder = async () => {
    if (!agencyId || !user || !folderName.trim()) {
      notify('Informe o nome da pasta.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/training/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          agency_id: agencyId,
          name: folderName,
          description: folderDescription,
          created_by: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar pasta');
      setFolderName('');
      setFolderDescription('');
      await loadData();
      setSelectedFolderId(data.folder?.id || null);
      notify('Pasta criada com sucesso.', 'success');
    } catch (error: any) {
      notify(error.message || 'Erro ao criar pasta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadMaterial = async () => {
    if (!agencyId || !user || !file || !selectedFolderId || !materialTitle.trim()) {
      notify('Selecione uma pasta, informe o título e envie um PDF.', 'error');
      return;
    }

    if (file.type !== 'application/pdf') {
      notify('Apenas arquivos PDF são permitidos.', 'error');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agency_id', String(agencyId));
      formData.append('folder_id', String(selectedFolderId));
      formData.append('title', materialTitle);
      formData.append('description', materialDescription);
      formData.append('created_by', String(user.id));
      formData.append('available_for_roles', JSON.stringify(roleOptions));

      const uploadRes = await fetch(`${apiUrl}/api/training/upload`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Erro ao enviar material');

      setMaterialTitle('');
      setMaterialDescription('');
      setFile(null);
      await loadData();
      notify('Material enviado com sucesso.', 'success');
    } catch (error: any) {
      notify(error.message || 'Erro ao enviar material', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteMaterial = async (materialId: number) => {
    if (!agencyId) return;
    try {
      const res = await fetch(`${apiUrl}/api/training/materials/${materialId}`, {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir material');
      await loadData();
      notify('Material removido.', 'success');
    } catch (error: any) {
      notify(error.message || 'Erro ao excluir material', 'error');
    }
  };

  if (!agencyId || !canReadTraining(user)) {
    return (
      <div className="bg-[var(--bg-card)]/60 rounded-3xl border border-[var(--border-color)] p-8 text-center text-[var(--text-muted)]">
        <Lock size={30} className="mx-auto mb-3" />
        Você não tem acesso a este módulo.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">Treinamentos</p>
          <h2 className="mt-2 text-3xl font-black tracking-tighter text-[var(--text-main)]">Biblioteca da Agência</h2>
        </div>
        <div className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-[0.2em]">Agência: {agencyId}</div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="bg-[var(--bg-card)]/60 border border-[var(--border-color)] rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen size={18} className="text-emerald-400" />
              <h3 className="font-black uppercase tracking-wider text-sm">Pastas</h3>
            </div>

            <div className="space-y-3">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full text-left rounded-2xl border px-3 py-3 transition-all ${
                    selectedFolderId === folder.id
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-[var(--border-color)] bg-[var(--bg-input)]/40 text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{folder.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                      {visibleMaterials.filter((m) => m.folder_id === folder.id).length} itens
                    </span>
                  </div>
                  {folder.description && <p className="mt-2 text-xs text-[var(--text-muted)]">{folder.description}</p>}
                </button>
              ))}
            </div>

            {canManageTraining(user) && (
              <div className="mt-5 space-y-3 border-t border-[var(--border-color)] pt-4">
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none"
                  placeholder="Nome da pasta"
                />
                <textarea
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  className="w-full min-h-[70px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none"
                  placeholder="Descrição da pasta"
                />
                <button
                  disabled={loading}
                  onClick={createFolder}
                  className="w-full brand-gradient text-black rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Plus size={14} />
                    Criar pasta
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--bg-card)]/60 border border-[var(--border-color)] rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <NotebookPen size={18} className="text-emerald-400" />
                <h3 className="font-black uppercase tracking-wider text-sm">
                  {selectedFolder ? selectedFolder.name : 'Selecione uma pasta'}
                </h3>
              </div>
            </div>

            {folderMaterials.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-8 text-center text-[var(--text-muted)]">
                Nenhum material disponível nesta pasta.
              </div>
            ) : (
              <div className="space-y-3">
                {folderMaterials.map((material) => (
                  <div key={material.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileText size={18} className="text-emerald-400 mt-1" />
                        <div>
                          <p className="font-bold text-[var(--text-main)]">{material.title}</p>
                          {material.description && <p className="text-xs text-[var(--text-muted)] mt-1">{material.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                            <span>{material.file_name}</span>
                            {material.status && <span>• {material.status}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingPdf(material.file_url)}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300"
                        >
                          <span className="flex items-center gap-1"><Eye size={12} /> Ver</span>
                        </button>
                        {canManageTraining(user) && (
                          <button
                            onClick={() => deleteMaterial(material.id)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-red-300"
                          >
                            <span className="flex items-center gap-1"><Trash2 size={12} /> Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManageTraining(user) && (
            <div className="bg-[var(--bg-card)]/60 border border-[var(--border-color)] rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Upload size={18} className="text-emerald-400" />
                <h3 className="font-black uppercase tracking-wider text-sm">Novo material</h3>
              </div>

              <div className="space-y-4">
                <input
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none"
                  placeholder="Título do material"
                />
                <textarea
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  className="w-full min-h-[90px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none"
                  placeholder="Descrição do conteúdo"
                />
                <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-4">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500/15 file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-[0.18em] file:text-emerald-300"
                  />
                  {file && <p className="mt-2 text-xs text-[var(--text-muted)]">Arquivo: {file.name}</p>}
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Disponível para</p>
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((role) => (
                      <span key={role} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                        {getRoleLabel(role)}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  disabled={loading}
                  onClick={uploadMaterial}
                  className="w-full brand-gradient text-black rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Upload size={14} />
                    Enviar PDF
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-6xl rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Visualização do material</p>
              <button
                onClick={() => setViewingPdf(null)}
                className="rounded-xl border border-[var(--border-color)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]"
              >
                Fechar
              </button>
            </div>
            <iframe src={viewingPdf} className="h-[80vh] w-full rounded-2xl border border-[var(--border-color)] bg-white" title="Training PDF Viewer" />
          </div>
        </div>
      )}
    </div>
  );
}
