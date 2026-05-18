import React, { useState } from 'react';
import { ExternalLink, AlertCircle, Wifi } from 'lucide-react';

interface WhatsAppWebEmbedProps {
  isConnected: boolean;
}

export const WhatsAppWebEmbed: React.FC<WhatsAppWebEmbedProps> = ({ isConnected }) => {
  const [iframeError, setIframeError] = useState(false);

  if (!isConnected) {
    return (
      <div className="w-full h-96 rounded-2xl bg-[var(--bg-card)]/50 border border-dashed border-[var(--border-color)] flex flex-col items-center justify-center gap-4 p-6">
        <Wifi size={32} className="text-[var(--text-muted)] opacity-50" />
        <div className="text-center">
          <p className="text-sm font-bold text-[var(--text-muted)]">Conecte o WhatsApp para acessar</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Após conectar o QR Code, o WhatsApp Web aparecerá aqui</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {iframeError ? (
        <div className="w-full bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-400">Não foi possível carregar o WhatsApp Web</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Alguns navegadores bloqueiam o WhatsApp Web em iframe. Clique abaixo para abrir em uma nova janela.
              </p>
            </div>
          </div>
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-bold"
          >
            <ExternalLink size={16} />
            Abrir WhatsApp Web
          </a>
        </div>
      ) : (
        <div className="w-full bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] overflow-hidden">
          <iframe
            key="whatsapp-web"
            src="https://web.whatsapp.com"
            title="WhatsApp Web"
            className="w-full h-96 border-0"
            onError={() => setIframeError(true)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation"
          />
        </div>
      )}
    </div>
  );
};
