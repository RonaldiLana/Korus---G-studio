import React, { useState, useEffect } from 'react';
import { Loader, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * WhatsAppWebEmbed Component
 * 
 * Carrega web.whatsapp.com através de um proxy backend que remove
 * headers bloqueadores (X-Frame-Options, CSP) permitindo iframe embedding.
 * 
 * FLUXO:
 * 1. Tenta carregar proxy local via /api/whatsapp/web-proxy em iframe
 * 2. Se sucesso: mostra WhatsApp Web funcional dentro da aplicação
 * 3. Se erro: mostra fallback com opções alternativas
 * 
 * BENEFÍCIOS:
 * - Sem nova aba
 * - Sessão persistente
 * - Integrado ao sistema
 * - Sidebar continua acessível
 */
export const WhatsAppWebEmbed: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');

  useEffect(() => {
    // Detecta URL base da aplicação para construir URL do proxy
    const protocol = window.location.protocol;
    const host = window.location.host;
    const baseUrl = `${protocol}//${host}`;
    setProxyUrl(`${baseUrl}/api/whatsapp/web-proxy`);
  }, []);

  const handleIframeLoad = () => {
    console.log('[WhatsApp Embed] Iframe carregado com sucesso');
    setIsLoading(false);
    setIframeError(false);
  };

  const handleIframeError = (error: any) => {
    console.error('[WhatsApp Embed] Erro ao carregar iframe:', error);
    setIsLoading(false);
    setIframeError(true);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setIframeError(false);
  };

  const handleOpenInNewTab = () => {
    window.open('https://web.whatsapp.com', '_blank', 'width=1400,height=900');
  };

  return (
    <div className="w-full h-full flex flex-col bg-black relative overflow-hidden">
      {/* Loading State */}
      {isLoading && !iframeError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-black to-gray-900 z-50">
          <div className="animate-spin">
            <Loader size={48} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-gray-100 font-medium text-sm">Carregando WhatsApp Web...</p>
            <p className="text-gray-500 text-xs mt-2">Conecte-se pelo QR Code na tela do seu celular</p>
          </div>
          <div className="w-24 h-24 rounded-lg bg-gray-800/50 border border-gray-700 flex items-center justify-center mt-2">
            <span className="text-xs text-gray-500 text-center px-2">QR Code</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {iframeError && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 bg-gradient-to-br from-gray-900 to-black">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/30">
            <AlertCircle size={40} className="text-red-400" />
          </div>
          
          <div className="text-center max-w-md">
            <h3 className="text-2xl font-black text-white mb-3">Não foi possível carregar</h3>
            <p className="text-gray-300 text-sm mb-2">
              O navegador bloqueou o acesso ao WhatsApp Web por políticas de segurança.
            </p>
            <p className="text-gray-500 text-xs">
              Isso geralmente acontece em navegadores muito restritivos. Tente uma das opções abaixo.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/50"
            >
              <RefreshCw size={18} />
              Tentar Novamente
            </button>
            
            <button
              onClick={handleOpenInNewTab}
              className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/50"
            >
              <ExternalLink size={18} />
              Abrir em Nova Aba
            </button>
          </div>

          <p className="text-gray-600 text-xs text-center">
            Se continuar com problemas, tente usar Chrome, Firefox ou Safari
          </p>
        </div>
      )}

      {/* Iframe - Main Content */}
      {proxyUrl && !iframeError && (
        <iframe
          key="whatsapp-proxy-iframe"
          src={proxyUrl}
          title="WhatsApp Web"
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-storage-access-by-user-activation allow-modals allow-downloads allow-presentation"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{
            display: isLoading ? 'none' : 'block',
          }}
        />
      )}
    </div>
  );
};
