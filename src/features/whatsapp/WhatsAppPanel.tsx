import React, { useState } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { Smartphone, X, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[var(--bg-panel)] relative">
      {/* ─── WHATSAPP WEB - FULL SCREEN ─── */}
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Smartphone size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tighter">WhatsApp Web</h2>
              <p className="text-xs text-[var(--text-muted)]">Acesso oficial com total controle</p>
            </div>
          </div>
        </div>

        {/* Iframe - Full Height */}
        <div className="flex-1 overflow-hidden relative">
          <iframe
            key="whatsapp-web"
            src="https://web.whatsapp.com"
            title="WhatsApp Web"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-storage-access-by-user-activation"
          />
        </div>
      </div>

      {/* ─── FLOATING BUTTON ─── */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full brand-gradient shadow-lg hover:shadow-xl transition-all flex items-center justify-center group z-40"
        title="Novo Processo"
      >
        <UserPlus size={24} className="text-black group-hover:scale-110 transition-transform" />
      </button>

      {/* ─── DRAWER MODAL ─── */}
      <AnimatePresence mode="wait">
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Drawer - Slide from right */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-screen w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
                    <UserPlus className="text-black" size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter">Novo Processo</h3>
                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">
                      Via WhatsApp
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors"
                >
                  <X size={20} className="text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Drawer Content - Scrollable */}
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <WhatsAppProcessSidebar
                  agencyId={agencyId}
                  token={token}
                  user={user}
                  destinations={destinations}
                  visaTypes={visaTypes}
                  plans={plans}
                  onClose={() => setIsModalOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
