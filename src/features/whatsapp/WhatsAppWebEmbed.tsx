import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader, X } from 'lucide-react';

/**
 * 🟢 WhatsAppWebEmbed - Layout Integrado 3 Colunas
 *
 * ESTRATÉGIA:
 * - Sidebar esquerda: Korus
 * - Centro: iframe web.whatsapp.com (fullscreen no painel)
 * - Direita: Painel "Criar Processo"
 * - Layout mantém as 2 colunas laterais visíveis
 */

type EmbedState = 'loading' | 'loaded' | 'error' | 'fallback';

interface WhatsAppWebEmbedProps {
  onOpenProcessPopup?: () => void;
}

export const WhatsAppWebEmbed: React.FC<WhatsAppWebEmbedProps> = ({ onOpenProcessPopup }) => {
  const [state, setState] = useState<EmbedState>('loading');
  const [showIframe, setShowIframe] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = { info: '🟢', warn: '🟡', error: '🔴' }[level];
    console.log(`[${timestamp}] ${icon} [WhatsApp] ${message}`, data || '');
  };

  /**
   * ⏱️ Monitora carregamento
   */
  useEffect(() => {
    if (!iframeRef.current || !showIframe) return;

    const handleLoad = () => {
      log('info', '✅ iframe carregado com sucesso');
      setState('loaded');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleError = () => {
      log('error', '❌ Erro ao carregar iframe - indo para fallback');
      setState('fallback');
    };

    // Timeout se demorar muito (3 segundos apenas)
    timeoutRef.current = setTimeout(() => {
      if (state === 'loading') {
        log('warn', 'Timeout ao carregar (3s) - web.whatsapp.com bloqueia iframe');
        setState('fallback');
      }
    }, 3000);

    const iframe = iframeRef.current;
    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [showIframe, state]);

  /**
   * 🎬 Abre o iframe quando clica em "Abrir"
   */
  const handleOpen = () => {
    log('info', '🎬 Abrindo WhatsApp Web no painel');
    setState('loading');
    setShowIframe(true);
  };

  /**
   * ❌ Fecha o iframe
   */
  const handleClose = () => {
    log('info', '❌ Fechando WhatsApp Web');
    setShowIframe(false);
    setState('loading');
  };

  // ──────────────────────────────────────────────────────────────────
  // LAYOUT: Se iframe está aberto, mostra fullscreen com close button
  // ──────────────────────────────────────────────────────────────────
  if (showIframe) {
    return (
      <div className="w-full h-full flex flex-col bg-black relative">
        {/* HEADER COM CLOSE */}
        <div className="px-6 py-3 border-b border-gray-800 bg-black/50 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white">WhatsApp Web</h1>
            <p className="text-xs text-gray-400">Integrado ao seu Korus</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white"
            title="Fechar WhatsApp"
          >
            <X size={24} />
          </button>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 relative overflow-hidden">
          {/* ESTADO: CARREGANDO */}
          {state === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
              <div className="text-center">
                <Loader size={48} className="text-emerald-500 animate-spin mx-auto mb-4" />
                <p className="text-white font-black">Conectando ao WhatsApp Web...</p>
              </div>
            </div>
          )}

          {/* ESTADO: FALLBACK - Mostro painel com opções */}
          {state === 'fallback' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
              <div className="text-center max-w-md p-8 bg-gray-900 rounded-2xl border border-gray-800">
                <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
                <p className="text-white font-black text-lg mb-2">WhatsApp Web - Modo Popup</p>
                <p className="text-gray-300 text-sm mb-8">
                  O WhatsApp não permite carregamento em iframe. Vamos abrir em uma popup ao lado do painel!
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      log('info', '🪟 Abrindo popup do WhatsApp');
                      const width = 1400;
                      const height = 900;
                      const left = window.screenX + 150;
                      const top = window.screenY + 50;
                      window.open(
                        'https://web.whatsapp.com',
                        'KorusWhatsApp',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,toolbar=no,menubar=no,location=no,status=no`
                      );
                      // Também abre o popup do Processo
                      if (onOpenProcessPopup) {
                        log('info', '📋 Abrindo popup do Processo');
                        onOpenProcessPopup();
                      }
                      setState('loaded');
                    }}
                    className="px-6 py-3 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-lg transition-all"
                  >
                    ✅ Abrir Popup do WhatsApp
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
                  >
                    Voltar
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-6">
                  💡 A popup abrirá ao lado desta janela. Você pode colocá-la lado a lado com o Korus!
                </p>
              </div>
            </div>
          )}

          {/* ESTADO: LOADED - Mostra mensagem de popup aberta */}
          {state === 'loaded' && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 gap-6 p-8">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">🪟</div>
                <h2 className="text-2xl font-black text-white mb-2">WhatsApp Web Ativo</h2>
                <p className="text-gray-300 text-sm max-w-sm leading-relaxed mb-6">
                  Uma popup com o WhatsApp Web foi aberta ao lado da sua tela. Posicione ambas as janelas lado a lado para uma experiência integrada perfeita!
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">👈</div>
                  <p className="text-xs text-gray-300 font-bold">Korus</p>
                  <p className="text-xs text-gray-500">Gerenciar vistos</p>
                </div>
                <div className="bg-emerald-900/30 border border-emerald-600 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2 animate-pulse">💬</div>
                  <p className="text-xs text-emerald-300 font-bold">WhatsApp</p>
                  <p className="text-xs text-emerald-400">Conversar</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">👥</div>
                  <p className="text-xs text-gray-300 font-bold">Processos</p>
                  <p className="text-xs text-gray-500">Criar/Gerenciar</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => window.open('https://web.whatsapp.com', '_blank')}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all text-sm"
                >
                  Abrir Outra Aba
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all text-sm"
                >
                  Fechar
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 max-w-md text-center">
                💡 <strong>Dica:</strong> Use Alt+Tab para alternar entre as janelas rapidamente
              </p>
            </div>
          )}

          {/* IFRAME (Tentativa silenciosa) */}
          {state !== 'fallback' && (
            <iframe
              ref={iframeRef}
              src="/api/whatsapp/web-proxy"
              className="w-full h-full border-0"
              title="WhatsApp Web"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock allow-presentation"
              allow="camera; microphone; clipboard-read; clipboard-write"
            />
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // LAYOUT: Painel inicial "Pronto para Conectar"
  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-black via-gray-950 to-gray-900">
      {/* CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
        {/* ILLUSTRAÇÃO */}
        <div className="relative w-64 h-40 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-3xl border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-transparent to-emerald-500 animate-pulse"></div>
          </div>

          <div className="relative text-center z-10">
            <div className="text-6xl mb-2">💬</div>
            <p className="text-sm text-emerald-200 font-bold">WhatsApp Web</p>
            <p className="text-xs text-emerald-300/70">Integrado ao Korus</p>
          </div>
        </div>

        {/* TEXTO */}
        <div className="text-center max-w-lg">
          <h1 className="text-3xl font-black text-white mb-3">Conecte seu WhatsApp</h1>
          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            Acesse suas conversas do WhatsApp em tempo real enquanto gerencia seus vistos e processos no Korus. O painel ficará integrado com 2 colunas laterais visíveis.
          </p>

          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3 text-sm text-left">
              <span className="text-emerald-400 font-black mt-0.5">✓</span>
              <span className="text-gray-300">Painel integrado com layout de 3 colunas</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-left">
              <span className="text-emerald-400 font-black mt-0.5">✓</span>
              <span className="text-gray-300">Sidebar do Korus permanece visível</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-left">
              <span className="text-emerald-400 font-black mt-0.5">✓</span>
              <span className="text-gray-300">Painel "Criar Processo" acessível à direita</span>
            </div>
          </div>
        </div>

        {/* BOTÃO PRINCIPAL */}
        <button
          onClick={handleOpen}
          className="px-8 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl transition-all shadow-lg hover:shadow-emerald-500/50 active:scale-95 text-lg"
        >
          🚀 Abrir WhatsApp Web
        </button>

        {/* BOTÃO ALTERNATIVO */}
        <button
          onClick={() => window.open('https://web.whatsapp.com', '_blank')}
          className="text-sm text-gray-400 hover:text-gray-300 underline transition-colors"
        >
          Ou abrir em nova aba
        </button>
      </div>

      {/* FOOTER INFO */}
      <div className="px-6 py-4 border-t border-gray-800 bg-black/50 text-center text-xs text-gray-500">
        💡 O WhatsApp Web será carregado no centro enquanto as colunas laterais do Korus permanecem visíveis
      </div>
    </div>
  );
};


