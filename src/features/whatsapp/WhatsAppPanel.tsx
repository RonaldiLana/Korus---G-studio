import React, { useState } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { MessageCircle, ExternalLink } from 'lucide-react';

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

  const handleIframeError = () => {
    console.warn('Iframe bloqueado');
    setIframeError(true);
  };

  const handleOpenWhatsApp = () => {
    window.open('https://web.whatsapp.com', 'whatsapp_window', 'width=1400,height=900');
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black">
      {iframeError ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 bg-black">
          <MessageCircle size={48} className="text-emerald-400" />
          <div className="text-center">
            <h3 className="text-xl font-black text-white mb-2">WhatsApp Web Bloqueado</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm">
              O navegador bloqueou o acesso direto. Clique abaixo para abrir em uma nova aba.
            </p>
            <button
              onClick={handleOpenWhatsApp}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl transition-all flex items-center gap-2 mx-auto"
            >
              <ExternalLink size={20} />
              Abrir WhatsApp Web
            </button>
          </div>
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
