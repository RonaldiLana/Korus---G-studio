import React, { useState, useEffect } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { MessageCircle, ExternalLink, Smartphone } from 'lucide-react';

interface WhatsAppPanelProps {
  agencyId: number;
  user: User;
  token: string;
  destinations?: Destination[];
  visaTypes?: VisaType[];
  plans?: Plan[];
}

export const WhatsAppPanel: React.FC<WhatsAppPanelProps> = ({
  agencyId,
  user,
  token,
  destinations = [],
  visaTypes = [],
  plans = [],
}) => {
  const [iframeError, setIframeError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Timeout de 4 segundos para detectar se o iframe não carregou
    const timer = setTimeout(() => {
      console.warn('iframe não carregou em 4s, mostrando fallback');
      setShowFallback(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleIframeError = () => {
    console.error('Iframe error detectado');
    setIframeError(true);
    setShowFallback(true);
  };

  const handleOpenWhatsApp = () => {
    window.open('https://web.whatsapp.com', 'whatsapp_window', 'width=1400,height=900');
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black">
      {showFallback || iframeError ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-6 bg-gradient-to-br from-gray-900 to-black">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/30">
            <MessageCircle size={40} className="text-emerald-400" />
          </div>
          <div className="text-center max-w-sm">
            <h3 className="text-2xl font-black text-white mb-3">WhatsApp Web</h3>
            <p className="text-gray-300 text-sm mb-4">
              O acesso direto ao WhatsApp Web está bloqueado pelo navegador. Abra em uma nova aba para usar.
            </p>
            <p className="text-gray-400 text-xs mb-6 flex items-center justify-center gap-2">
              <Smartphone size={16} />
              Certifique-se que o WhatsApp está instalado no seu celular
            </p>
          </div>
          <button
            onClick={handleOpenWhatsApp}
            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-2xl transition-all flex items-center gap-3 shadow-lg hover:shadow-emerald-500/50"
          >
            <ExternalLink size={20} />
            Abrir WhatsApp Web
          </button>
          <p className="text-gray-500 text-xs mt-4">
            A aba permanecerá sincronizada com seu celular
          </p>
        </div>
      ) : (
        <iframe
          key="whatsapp-iframe"
          src="https://web.whatsapp.com"
          title="WhatsApp Web"
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-storage-access-by-user-activation allow-modals"
          onError={handleIframeError}
        />
      )}
    </div>
  );
};
