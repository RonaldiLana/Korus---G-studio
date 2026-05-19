import React, { useState } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { WhatsAppSidebar } from './WhatsAppSidebar';
import { WhatsAppConversation } from './WhatsAppConversation';
import { WhatsAppRightPanel } from './WhatsAppRightPanel';
import { SimplifiedProcessModal } from '../simplifiedProcess/SimplifiedProcessModal';
import { mockConversations, mockMessages } from './data/mockConversations';

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
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>('1');
  const [showProcessModal, setShowProcessModal] = useState(false);

  const selectedConversation = mockConversations.find(
    (conv) => conv.id === selectedConversationId
  );
  const currentMessages = selectedConversationId
    ? mockMessages[selectedConversationId] || []
    : [];

  const handleOpenProcess = () => {
    setShowProcessModal(true);
  };

  const handleCloseModal = () => {
    setShowProcessModal(false);
  };

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* Sidebar - 25% */}
      <div className="w-1/4 h-full overflow-hidden">
        <WhatsAppSidebar
          conversations={mockConversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
        />
      </div>

      {/* Conversation - 55% */}
      <div className="w-11/20 h-full overflow-hidden">
        <WhatsAppConversation
          conversation={selectedConversation}
          messages={currentMessages}
        />
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
