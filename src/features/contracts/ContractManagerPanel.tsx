import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Contract {
  id: number;
  file_name: string;
  status: 'pending' | 'signed' | 'expired' | 'rejected';
  signer_email: string;
  signer_name: string;
  created_at: string;
  signed_at?: string;
  zipsign_sign_url?: string;
}

interface ContractManagerPanelProps {
  processId: number;
  agencyId: number;
  apiUrl: string;
  token: string;
  onContractAdded?: () => void;
}

const ContractManagerPanel: React.FC<ContractManagerPanelProps> = ({
  processId,
  agencyId,
  apiUrl,
  token,
  onContractAdded,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Fetch contracts for process
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/processes/${processId}/contracts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [processId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-yellow-400" size={18} />;
      case 'signed':
        return <CheckCircle className="text-emerald-400" size={18} />;
      case 'expired':
      case 'rejected':
        return <XCircle className="text-red-400" size={18} />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente de Assinatura';
      case 'signed':
        return 'Assinado';
      case 'expired':
        return 'Expirado';
      case 'rejected':
        return 'Rejeitado';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'signed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'expired':
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-[var(--bg-input)] text-[var(--text-muted)]';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xl">📋</div>
          <h3 className="text-lg font-black">Documentos para Assinatura</h3>
          {contracts.length > 0 && (
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-[var(--bg-input)] text-[var(--text-muted)]">
              {contracts.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 brand-gradient text-black rounded-lg font-bold hover:opacity-90 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Novo Contrato</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin">⚙️</div>
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-8 px-4 bg-[var(--bg-input)]/30 rounded-2xl border border-[var(--border-color)]">
          <p className="text-[var(--text-muted)] text-sm">
            Nenhum contrato adicionado ainda
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-[var(--bg-input)]/30 rounded-xl border border-[var(--border-color)] hover:border-emerald-500/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(contract.status)}
                    <p className="font-bold truncate text-[var(--text-main)]">
                      {contract.file_name}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    Assinante: <span className="font-semibold">{contract.signer_name}</span> ({contract.signer_email})
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>Criado: {formatDate(contract.created_at)}</span>
                    {contract.signed_at && (
                      <span>• Assinado: {formatDate(contract.signed_at)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${getStatusColor(contract.status)}`}>
                    {getStatusLabel(contract.status)}
                  </span>

                  {contract.zipsign_sign_url && contract.status === 'pending' && (
                    <a
                      href={contract.zipsign_sign_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-all"
                      title="Abrir link de assinatura"
                    >
                      🔗
                    </a>
                  )}

                  <button
                    className="p-2 hover:bg-[var(--bg-card)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                    title="Baixar contrato"
                  >
                    <Download size={18} />
                  </button>

                  <button
                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-all"
                    title="Remover contrato"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--bg-card)] w-full max-w-md rounded-3xl border border-[var(--border-color)] p-8 shadow-2xl"
          >
            <h3 className="text-2xl font-black mb-4">Novo Contrato</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Upload um PDF ou escolha um template para assinar.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  onContractAdded?.();
                }}
                className="w-full p-4 bg-[var(--bg-input)] border-2 border-dashed border-[var(--border-color)] rounded-xl hover:border-emerald-500 transition-all text-center"
              >
                <div className="text-2xl mb-2">📁</div>
                <p className="font-bold text-[var(--text-main)]">Upload PDF</p>
                <p className="text-xs text-[var(--text-muted)]">Selecionar arquivo...</p>
              </button>

              <button
                onClick={() => {
                  setShowUploadModal(false);
                  onContractAdded?.();
                }}
                className="w-full p-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl hover:border-amber-500 transition-all text-center"
              >
                <div className="text-2xl mb-2">📑</div>
                <p className="font-bold text-[var(--text-main)]">Usar Template</p>
                <p className="text-xs text-[var(--text-muted)]">Modelos salvos...</p>
              </button>
            </div>

            <button
              onClick={() => setShowUploadModal(false)}
              className="w-full mt-6 py-3 rounded-xl font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)] transition-all"
            >
              Cancelar
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ContractManagerPanel;
