import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, WhatsAppIntegration } from '../../types';
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const API_URL =
  (import.meta as any).env?.VITE_API_URL?.trim() || 'https://api.korus.me';

interface WhatsAppPanelProps {
  agencyId: number;
  user: User;
  token: string;
}

type ConnectionStatus = 'idle' | 'loading' | 'qr_ready' | 'connected' | 'error';

const POLLING_INTERVAL_MS = 4000;

export const WhatsAppPanel: React.FC<WhatsAppPanelProps> = ({ agencyId, user, token }) => {
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [qrJustAppeared, setQrJustAppeared] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupervisor = user.role === 'supervisor' || user.role === 'master';

  const clearPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
    pollingRef.current = null;
    qrTimeoutRef.current = null;
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/status/${agencyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 404) {
          setIntegration(null);
          setConnectionStatus('idle');
          return;
        }
        throw new Error('Erro ao consultar status');
      }
      const data: WhatsAppIntegration = await res.json();
      setIntegration(data);
      if (data.status === 'connected') {
        setConnectionStatus('connected');
        setQrCode(null);
        clearPolling();
      } else if (data.status === 'pending') {
        setConnectionStatus('qr_ready');
        fetchQr();
      } else {
        setConnectionStatus('idle');
        setQrCode(null);
        clearPolling();
      }
    } catch {
      // Silently keep current state on transient errors
    }
  }, [agencyId, token]);

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/qr/${agencyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'disconnected') {
        // Instância sumiu da Evolution API — para o spinner e mostra botão de reconectar
        clearPolling();
        setConnectionStatus('idle');
        setQrCode(null);
        setIntegration(prev => prev ? { ...prev, status: 'disconnected' } : null);
        return;
      }
      if (data.status === 'connected') {
        clearPolling();
        setConnectionStatus('connected');
        setQrCode(null);
        fetchStatus(); // atualiza dados completos da integração
        return;
      }
      if (data.qr_code) {
        if (!qrCode) {
          // QR apareceu pela primeira vez — mostra confirmação
          setQrJustAppeared(true);
          setTimeout(() => setQrJustAppeared(false), 4000);
        }
        setQrCode(data.qr_code);
      }
    } catch {
      // ignore
    }
  }, [agencyId, token]);

  useEffect(() => {
    fetchStatus();
    return () => clearPolling();
  }, [agencyId]);

  const startPolling = (qrFn: () => Promise<void>) => {
    clearPolling();
    pollingRef.current = setInterval(() => {
      qrFn();
    }, POLLING_INTERVAL_MS);
  };

  const handleConnect = async () => {
    setConnectionStatus('loading');
    setErrorMsg(null);
    setQrCode(null);
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/connect/${agencyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao iniciar conexão');
      }
      const data = await res.json();
      setIntegration(data.integration || null);
      if (data.qr_code) {
        setQrCode(data.qr_code);
        setConnectionStatus('qr_ready');
        startPolling(fetchQr);
      } else if (data.integration?.status === 'pending') {
        // Instância criada mas QR ainda não disponível — polling irá buscar
        setConnectionStatus('qr_ready');
        startPolling(fetchQr);
      } else {
        setConnectionStatus('error');
        setErrorMsg('Não foi possível gerar o QR Code.');
      }
    } catch (e: any) {
      setConnectionStatus('error');
      setErrorMsg(e.message || 'Erro ao conectar');
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/whatsapp/disconnect/${agencyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao desconectar');
      setIntegration(null);
      setConnectionStatus('idle');
      setQrCode(null);
      clearPolling();
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshQr = async () => {
    clearPolling();
    setQrCode(null);
    await handleConnect();
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide p-6 lg:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Smartphone size={24} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tighter">Integração WhatsApp</h2>
          <p className="text-sm text-[var(--text-muted)]">1 WhatsApp por agência • compartilhado com toda a equipe</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-[var(--bg-card)]/50 rounded-3xl border border-[var(--border-color)] overflow-hidden">
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <StatusIndicator status={connectionStatus} integration={integration} />
              <div>
                <p className="font-black text-sm uppercase tracking-widest">
                  {connectionStatus === 'connected' && 'WhatsApp Conectado'}
                  {connectionStatus === 'qr_ready' && 'Aguardando Leitura do QR Code'}
                  {connectionStatus === 'loading' && 'Iniciando Conexão...'}
                  {connectionStatus === 'idle' && 'Não Conectado'}
                  {connectionStatus === 'error' && 'Falha na Conexão'}
                </p>
                {integration?.phone_number && connectionStatus === 'connected' && (
                  <p className="text-sm text-emerald-400 mt-0.5">{integration.phone_number}</p>
                )}
                {integration?.connected_at && connectionStatus === 'connected' && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Conectado em {new Date(integration.connected_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>

            {isSupervisor && (
              <div className="flex items-center gap-2">
                {connectionStatus === 'idle' && (
                  <button
                    onClick={handleConnect}
                    className="brand-gradient text-black px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:opacity-90 transition-all text-sm"
                  >
                    <Wifi size={16} />
                    Conectar WhatsApp
                  </button>
                )}
                {connectionStatus === 'qr_ready' && (
                  <button
                    onClick={handleRefreshQr}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all text-sm font-bold"
                  >
                    <RefreshCw size={16} />
                    Gerar Novo QR
                  </button>
                )}
                {connectionStatus === 'connected' && (
                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-bold disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                )}
                {connectionStatus === 'error' && (
                  <button
                    onClick={handleConnect}
                    className="brand-gradient text-black px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:opacity-90 transition-all text-sm"
                  >
                    <RefreshCw size={16} />
                    Tentar Novamente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* QR Code Display */}
        {connectionStatus === 'qr_ready' && (
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="text-center">
              <p className="font-bold text-sm mb-1">Abra o WhatsApp no seu celular</p>
              <p className="text-xs text-[var(--text-muted)]">
                Toque em <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong> e escaneie o QR Code
              </p>
            </div>
            {qrCode ? (
              <div className="flex flex-col items-center gap-3">
                {qrJustAppeared && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold animate-pulse">
                    <CheckCircle2 size={16} />
                    QR Code gerado! Escaneie agora com o WhatsApp
                  </div>
                )}
                <div className="p-4 bg-white rounded-2xl shadow-lg ring-2 ring-emerald-400/30">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-color)] flex flex-col items-center justify-center gap-3">
                <RefreshCw size={32} className="text-[var(--text-muted)] animate-spin" />
                <p className="text-xs text-[var(--text-muted)]">Aguardando Baileys inicializar...</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <Clock size={14} />
              <span>QR Code expira em 60 segundos</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {connectionStatus === 'loading' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <RefreshCw size={32} className="text-emerald-400 animate-spin" />
            <p className="text-sm text-[var(--text-muted)]">Aguarde, iniciando instância...</p>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 border-t border-[var(--border-color)] flex items-center gap-3 bg-red-500/5">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-[var(--bg-card)]/30 rounded-2xl border border-[var(--border-color)] p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Como funciona</p>
        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
            Cada agência vincula <strong className="text-[var(--text-main)]">1 número de WhatsApp</strong>, compartilhado com toda a equipe.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
            Consultores, analistas, financeiro e supervisores <strong className="text-[var(--text-main)]">visualizam o status</strong> do WhatsApp integrado.
          </li>
          {isSupervisor && (
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
              Apenas <strong className="text-[var(--text-main)]">supervisores e master</strong> podem conectar ou desconectar.
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
            O módulo precisa ser <strong className="text-[var(--text-main)]">ativado pelo master</strong> no painel de agências.
          </li>
        </ul>
      </div>
    </div>
  );
};

// ─── Sub-component: status indicator ────────────────────────────────────────
const StatusIndicator: React.FC<{
  status: ConnectionStatus;
  integration: WhatsAppIntegration | null;
}> = ({ status }) => {
  const map: Record<ConnectionStatus, { icon: React.ElementType; color: string; bg: string }> = {
    connected: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    qr_ready: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    loading: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    idle: { icon: WifiOff, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-input)] border-[var(--border-color)]' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };
  const { icon: Icon, color, bg } = map[status];
  return (
    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
      <Icon size={18} className={`${color} ${status === 'loading' ? 'animate-spin' : ''}`} />
    </div>
  );
};
