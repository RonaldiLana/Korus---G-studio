import React from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { Smartphone, ExternalLink } from 'lucide-react';
import { WhatsAppProcessSidebar } from './WhatsAppProcessSidebar';

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
    <div className="h-full flex flex-col lg:flex-row gap-0 lg:gap-6 overflow-hidden bg-[var(--bg-panel)]">
      {/* ─── LEFT COLUMN: WHATSAPP WEB IFRAME ─── */}
      <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-[var(--border-color)]">
        {/* Header */}
        <div className="flex-shrink-0 p-6 lg:p-8 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Smartphone size={24} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter">WhatsApp Web</h2>
              <p className="text-sm text-[var(--text-muted)]">Acesso oficial com total controle</p>
            </div>
          </div>
        </div>

        {/* WhatsApp Web Iframe - Full Height */}
        <div className="flex-1 overflow-hidden relative">
          <iframe
            key="whatsapp-web"
            src="https://web.whatsapp.com"
            title="WhatsApp Web"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
          />
          
          {/* Fallback message if iframe fails (CSS overlay) */}
          <div className="absolute inset-0 hidden pointer-events-none" id="whatsapp-iframe-fallback">
            <div className="w-full h-full bg-[var(--bg-card)]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <ExternalLink size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-main)]">WhatsApp Web não carregou</p>
                <p className="text-xs text-[var(--text-muted)] mt-2 max-w-xs">
                  Clique no botão abaixo para abrir em uma nova janela
                </p>
              </div>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-bold"
              >
                <ExternalLink size={14} />
                Abrir WhatsApp Web
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT COLUMN: PROCESS SIDEBAR ─── */}
      <div className="w-full lg:w-96 bg-[var(--bg-card)]/50 border-t lg:border-t-0 lg:border-l border-[var(--border-color)] flex flex-col overflow-hidden lg:max-h-full">
        <WhatsAppProcessSidebar
          agencyId={agencyId}
          token={token}
          user={user}
          destinations={destinations}
          visaTypes={visaTypes}
          plans={plans}
        />
      </div>
    </div>
  );
};
