import React, { useState, useEffect } from 'react';
import { ExternalLink, Smartphone, RefreshCw } from 'lucide-react';

interface WhatsAppWebFallbackProps {
  onRetry?: () => void;
}

export const WhatsAppWebFallback: React.FC<WhatsAppWebFallbackProps> = ({ onRetry }) => {
  const [showFallback, setShowFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Se após 3 segundos ainda não carregou, mostra fallback
    const timeout = setTimeout(() => {
      setShowFallback(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [retryCount]);

  const handleRetry = () => {
    setShowFallback(false);
    setRetryCount(prev => prev + 1);
    onRetry?.();
  };

  if (!showFallback) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse flex items-center gap-3">
          <Smartphone size={32} className="text-emerald-400" />
          <div>
            <p className="text-white font-bold">Carregando WhatsApp Web...</p>
            <p className="text-gray-400 text-sm">Conecte no seu celular</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center gap-6 p-6">
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
        <Smartphone size={48} className="text-emerald-400" />
      </div>

      <div className="text-center max-w-sm">
        <h2 className="text-2xl font-black text-white mb-2">WhatsApp Web</h2>
        <p className="text-gray-400 text-sm mb-6">
          Acesse o WhatsApp Web oficial clicando no botão abaixo. Você pode usar todo o poder do WhatsApp no seu navegador.
        </p>

        <div className="space-y-3">
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold transition-all shadow-lg hover:shadow-xl"
          >
            <ExternalLink size={18} />
            Abrir WhatsApp Web
          </a>

          <button
            onClick={handleRetry}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            <RefreshCw size={16} />
            Tentar Novamente (Embed)
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          💡 Dica: Para usar o WhatsApp Web no navegador, você precisa ter o WhatsApp instalado no celular.
        </p>
      </div>
    </div>
  );
};
