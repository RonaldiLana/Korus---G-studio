import React, { useState } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { WhatsAppWebEmbed } from './WhatsAppWebEmbed';
import { WhatsAppRightPanel } from './WhatsAppRightPanel';
import { SimplifiedProcessModal } from '../simplifiedProcess/SimplifiedProcessModal';

interface WhatsAppChatContainerProps {
  agencyId: number;
  user: User;
  token: string;
  destinations?: Destination[];
  visaTypes?: VisaType[];
  plans?: Plan[];
}

export const WhatsAppChatContainer: React.FC<WhatsAppChatContainerProps> = ({
  agencyId,
  user,
  token,
  destinations = [],
  visaTypes = [],
  plans = [],
}) => {
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [whatsappPopupState, setWhatsappPopupState] = useState<'closed' | 'loading' | 'popup'>('closed');
  const processPopupRef = React.useRef<Window | null>(null);

  const handleOpenProcess = () => {
    setShowProcessModal(true);
  };

  const handleOpenProcessPopup = () => {
    // Abre popup do Processo quando WhatsApp Web também abre
    if (typeof window !== 'undefined') {
      const left = window.screenX + 1450; // Posiciona à direita do WhatsApp
      const top = window.screenY;
      processPopupRef.current = window.open(
        `${window.location.origin}/processo-popup?agency=${agencyId}`,
        'KorusProcesso',
        `width=800,height=900,left=${left},top=${top},resizable=yes,toolbar=no,menubar=no,location=no,status=no`
      );
    }
  };

  const handleCloseProcessPopup = () => {
    if (processPopupRef.current && !processPopupRef.current.closed) {
      processPopupRef.current.close();
    }
  };

  const handleCloseModal = () => {
    setShowProcessModal(false);
  };

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* WhatsApp Web - 80% */}
      <div className="w-4/5 h-full overflow-hidden">
        <WhatsAppWebEmbed onOpenProcessPopup={handleOpenProcessPopup} />
      </div>

      {/* Right Panel - 20% */}
      <div className="w-1/5 h-full overflow-hidden">
        <WhatsAppRightPanel onOpenProcess={handleOpenProcess} />
      </div>

      {/* SimplifiedProcessModal */}
      {showProcessModal && (
        <SimplifiedProcessModal
          agencyId={agencyId}
          token={token}
          destinations={destinations}
          visaTypes={visaTypes}
          plans={plans}
          createdByUserId={user.id}
          onClose={handleCloseModal}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};
