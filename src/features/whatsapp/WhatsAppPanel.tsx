import React from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { WhatsAppChatContainer } from './WhatsAppChatContainer';

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
  return (
    <WhatsAppChatContainer
      agencyId={agencyId}
      user={user}
      token={token}
      destinations={destinations}
      visaTypes={visaTypes}
      plans={plans}
    />
  );
};
