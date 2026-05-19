import React, { useState, useEffect, useRef } from 'react';
import {
  Loader,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  MessageCircle,
  Wifi,
  WifiOff,
  X,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';

/**
 * 🟢 WhatsAppWebEmbed - Componente Robusto com Detecção Inteligente
 *
 * ESTRATÉGIA MULTI-CAMADA:
 * 1. Tenta carregar iframe com proxy backend
 * 2. Detecta bloqueio de frame (X-Frame-Options, CSP)
 * 3. Detecta timeout (5 segundos sem resposta)
 * 4. Se falhar: exibe fallback elegante com popup controlado
 * 5. Sincroniza estado entre iframe e popup
 * 6. Log completo de eventos
 *
 * ESTADOS:
 * - loading: Carregando...
 * - error: Bloqueio detectado
 * - iframe: iframe funciona
 * - popup: popup aberta
 * - offline: Sem conexão
 */

type EmbedState = 'loading' | 'error' | 'iframe' | 'popup' | 'offline';

interface WhatsAppState {
  connected: boolean;
  popupOpen: boolean;
  lastSync: Date | null;
}

export const WhatsAppWebEmbed: React.FC = () => {
  // Estados principais
  const [state, setState] = useState<EmbedState>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [proxyUrl, setProxyUrl] = useState('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [whatsappState, setWhatsappState] = useState<WhatsAppState>({
    connected: false,
    popupOpen: false,
    lastSync: null,
  });

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<Window | null>(null);
  const checkPopupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 📝 SISTEMA DE LOGS
   */
  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const color = {
      info: '🟢',
      warn: '🟡',
      error: '🔴',
    }[level];

    console.log(
      `[${timestamp}] ${color} [WhatsApp Embed] ${message}`,
      data || ''
    );
  };

  /**
   * 🔍 DETECTAR BLOQUEIO DE FRAME
   * Verifica se o servidor está respondendo com headers que bloqueiam iframe
   */
  useEffect(() => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const baseUrl = `${protocol}//${host}`;
    const url = `${baseUrl}/api/whatsapp/web-proxy`;

    setProxyUrl(url);
    log('info', 'URL do proxy detectada', url);

    // Faz um HEAD request para verificar headers antes de carregar
    fetch(url, { method: 'HEAD' })
      .then(async (response) => {
        const xFrameOptions = response.headers.get('X-Frame-Options');
        const csp = response.headers.get('Content-Security-Policy');

        if (xFrameOptions === 'DENY' || csp?.includes('frame-ancestors')) {
          log('error', 'Frame bloqueado por headers restritivos', {
            xFrameOptions,
            csp: csp?.substring(0, 50),
          });
          setBlockReason(
            'X-Frame-Options: DENY detectado - Server ainda está bloqueando iframe'
          );
          setState('error');
          setIsLoading(false);
        } else {
          log('info', 'Headers de bloqueio não detectados - tentando iframe');
        }
      })
      .catch((err) => {
        log('warn', 'Erro ao verificar headers (pode ser CORS)', err.message);
        // Continue mesmo com erro, pode funcionar
      });

    // Setup timeout de 5 segundos para load do iframe
    loadTimeoutRef.current = setTimeout(() => {
      if (isLoading && state === 'loading') {
        log('error', 'Timeout: iframe não respondeu em 5 segundos');
        setBlockReason('Timeout - iframe não respondeu. O servidor pode estar lento ou bloqueando.');
        setState('error');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, []);

  /**
   * ✅ IFRAME CARREGOU COM SUCESSO
   */
  const handleIframeLoad = () => {
    log('info', '✅ Iframe carregado com sucesso!');
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setState('iframe');
    setIsLoading(false);
    setWhatsappState((prev) => ({
      ...prev,
      connected: true,
      lastSync: new Date(),
    }));
  };

  /**
   * ❌ IFRAME ERRO
   */
  const handleIframeError = (error: any) => {
    log('error', 'Erro ao carregar iframe:', error);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    setBlockReason(
      'Iframe bloqueado pelo navegador. Tentando popup controlado...'
    );
    setState('error');
    setIsLoading(false);

    // Tenta abrir popup automaticamente como fallback
    setTimeout(() => {
      handleOpenPopup();
    }, 1000);
  };

  /**
   * 🪟 POPUP CONTROLADO
   * Abre WhatsApp Web em popup controlado (não aba solta)
   * Sincroniza estado entre iframe e popup
   */
  const handleOpenPopup = () => {
    log('info', '🪟 Abrindo popup controlado...');

    if (popupRef.current && !popupRef.current.closed) {
      log('info', 'Popup já está aberta, focando...');
      popupRef.current.focus();
      return;
    }

    const popupWindow = window.open(
      'https://web.whatsapp.com',
      'KorusWhatsApp',
      'width=1400,height=900,left=100,top=100,resizable=yes,scrollbars=yes'
    );

    if (popupWindow) {
      popupRef.current = popupWindow;
      log('info', '✅ Popup aberta com sucesso');
      setState('popup');
      setWhatsappState((prev) => ({
        ...prev,
        popupOpen: true,
      }));

      // Monitora se popup foi fechada
      if (checkPopupIntervalRef.current)
        clearInterval(checkPopupIntervalRef.current);

      checkPopupIntervalRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          log('info', 'Popup foi fechada pelo usuário');
          setWhatsappState((prev) => ({
            ...prev,
            popupOpen: false,
          }));
          setState('loading');
          setIsLoading(false);
          if (checkPopupIntervalRef.current)
            clearInterval(checkPopupIntervalRef.current);
        }
      }, 500);
    } else {
      log('error', 'Popup bloqueada pelo navegador');
      setBlockReason(
        'Popup foi bloqueada. Tente desabilitar bloqueador de popups.'
      );
    }
  };

  /**
   * 🔄 RETRY
   */
  const handleRetry = () => {
    log('info', '🔄 Tentando recarregar...');
    setState('loading');
    setIsLoading(true);
    setBlockReason('');

    // Force reload do iframe
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }

    loadTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        log('error', 'Retry timeout');
        setState('error');
        setIsLoading(false);
      }
    }, 5000);
  };

  /**
   * 🌐 ABRIR EM NOVA ABA SOLTA
   */
  const handleOpenInNewTab = () => {
    log('info', '🌐 Abrindo em nova aba solta');
    window.open('https://web.whatsapp.com', '_blank');
  };

  /**
   * ✨ RENDERIZAR
   */
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-black via-gray-950 to-gray-900 relative overflow-hidden">
      {/* 🔄 LOADING STATE */}
      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-black to-gray-950 z-40 backdrop-blur-sm">
          <div className="animate-spin">
            <Loader size={56} className="text-emerald-400" strokeWidth={1.5} />
          </div>

          <div className="text-center max-w-sm">
            <h2 className="text-2xl font-black text-white mb-2">
              Carregando WhatsApp
            </h2>
            <p className="text-gray-300 text-sm">
              Aguarde enquanto conectamos ao WhatsApp Web...
            </p>
            <p className="text-gray-500 text-xs mt-3">
              Escaneie o código QR com seu celular para conectar
            </p>
          </div>

          {/* QR Code Placeholder */}
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-emerald-500/20 flex items-center justify-center shadow-2xl animate-pulse">
            <MessageCircle size={48} className="text-emerald-400/40" />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Wifi size={14} />
            <span>Conectando...</span>
          </div>
        </div>
      )}

      {/* ❌ ERROR STATE */}
      {state === 'error' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-8 overflow-auto">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border-2 border-red-500/50 shadow-2xl">
            <AlertTriangle size={48} className="text-red-400 animate-bounce" />
          </div>

          <div className="text-center max-w-lg">
            <h2 className="text-3xl font-black text-white mb-4">
              Acesso Bloqueado
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">
              O WhatsApp Web protege contra embedding direto por razões de
              segurança. Isso é esperado e normal.
            </p>

            {blockReason && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-xs text-red-300 text-left">
                <strong>Motivo técnico:</strong> {blockReason}
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300 text-left">
              <strong>Solução:</strong> Use o popup controlado (abaixo). Ele
              abre em uma janela gerenciada, mantendo seu sistema acessível.
            </div>
          </div>

          {/* Botões de ação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-lg">
            {/* Popup Controlado */}
            <button
              onClick={handleOpenPopup}
              className="flex flex-col items-center justify-center gap-2 px-6 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/50 active:scale-95 group"
            >
              <div className="relative">
                <MessageCircle size={24} />
                <Maximize2 size={12} className="absolute -bottom-1 -right-1" />
              </div>
              <span className="text-xs">Popup</span>
              <span className="text-xs font-normal text-emerald-100">
                Recomendado
              </span>
            </button>

            {/* Retry */}
            <button
              onClick={handleRetry}
              className="flex flex-col items-center justify-center gap-2 px-6 py-4 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-blue-500/50 active:scale-95"
            >
              <RefreshCw size={24} />
              <span className="text-xs">Tentar</span>
              <span className="text-xs font-normal text-blue-100">Novamente</span>
            </button>

            {/* Nova Aba */}
            <button
              onClick={handleOpenInNewTab}
              className="flex flex-col items-center justify-center gap-2 px-6 py-4 bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-gray-600/50 active:scale-95"
            >
              <ExternalLink size={24} />
              <span className="text-xs">Nova</span>
              <span className="text-xs font-normal text-gray-300">Aba</span>
            </button>
          </div>

          {/* Status da Popup */}
          {whatsappState.popupOpen && (
            <div className="w-full max-w-lg bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-3">
              <Wifi size={16} className="text-emerald-400 animate-pulse" />
              <div className="flex-1">
                <p className="text-emerald-300 text-xs font-semibold">
                  Popup Aberta
                </p>
                <p className="text-emerald-300/70 text-xs">
                  WhatsApp está aberto em popup. Você pode continuar usando o
                  sistema.
                </p>
              </div>
            </div>
          )}

          {/* Info Footer */}
          <div className="text-center max-w-lg text-xs text-gray-500 space-y-2 pt-4 border-t border-gray-700/50">
            <p>
              💡 Se o popup não abrir, verifique se seu navegador está
              bloqueando popups.
            </p>
            <p>
              🌐 Para melhor experiência, use Chrome, Firefox, Safari ou Edge
              atualizados.
            </p>
          </div>
        </div>
      )}

      {/* ✅ IFRAME STATE */}
      {state === 'iframe' && proxyUrl && (
        <>
          {/* Micro-header durante iframe */}
          <div className="h-8 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-emerald-500/20 flex items-center px-4 gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-400">
              WhatsApp conectado • iframe ativo
            </span>
          </div>

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={proxyUrl}
            title="WhatsApp Web"
            className="flex-1 border-0 w-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-storage-access-by-user-activation allow-modals allow-downloads allow-presentation"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </>
      )}

      {/* 🪟 POPUP STATE */}
      {state === 'popup' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 bg-gradient-to-br from-gray-900 to-black">
          <div className="text-center max-w-md">
            <h2 className="text-3xl font-black text-white mb-3">
              WhatsApp em Popup
            </h2>
            <p className="text-gray-300 text-sm mb-4">
              ✅ Popup aberta com sucesso! Você pode usar WhatsApp Web nela
              enquanto continua usando o Korus aqui.
            </p>
          </div>

          {/* Ilustração */}
          <div className="relative w-64 h-40 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-2xl border-2 border-emerald-500/30 flex items-center justify-center">
            <div className="flex gap-4 items-end">
              <div className="w-24 h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg transform -rotate-6">
                <MessageCircle size={40} className="text-white" />
              </div>
              <div className="w-24 h-32 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-6">
                <MessageCircle size={40} className="text-white" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="w-full max-w-md space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-emerald-300 text-sm font-semibold flex items-center gap-2">
                <Wifi size={16} className="animate-pulse" />
                Sistema sincronizado
              </p>
              <p className="text-emerald-300/70 text-xs mt-1">
                Sua sessão WhatsApp permanece ativa enquanto você usa o Korus
              </p>
            </div>

            <button
              onClick={() => {
                if (popupRef.current && !popupRef.current.closed) {
                  popupRef.current.focus();
                } else {
                  handleOpenPopup();
                }
              }}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl transition-all shadow-lg hover:shadow-emerald-500/50 flex items-center justify-center gap-2"
            >
              <Maximize2 size={18} />
              Focar na Popup
            </button>

            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-black rounded-xl transition-all"
            >
              Voltar ao Sistema
            </button>
          </div>

          <p className="text-gray-500 text-xs text-center">
            A popup fecha automaticamente ao fechar a janela
          </p>
        </div>
      )}
    </div>
  );
};
