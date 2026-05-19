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

  const handleOpenProcess = () => {
    setShowProcessModal(true);
  };

  const handleCloseModal = () => {
    setShowProcessModal(false);
  };

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* WhatsApp Web - 80% */}
      <div className="w-4/5 h-full overflow-hidden">
        <WhatsAppWebEmbed />
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
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
