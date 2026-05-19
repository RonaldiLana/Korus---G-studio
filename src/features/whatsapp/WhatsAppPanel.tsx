import React, { useState } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { X, MessageCircle } from 'lucide-react';
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
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const handleIframeError = () => {
    console.warn('Iframe bloqueado - mostrando fallback');
    setIframeError(true);
  };

  const handleOpenWhatsApp = () => {
    window.open('https://web.whatsapp.com', 'whatsapp_window', 'width=1400,height=900');
  };

  return (
    <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden bg-black gap-0">
      
      {/* ─── WHATSAPP SIDE (70%) ─── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black relative">
        {iframeError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
            <MessageCircle size={48} className="text-emerald-400" />
            <div className="text-center">
              <h3 className="text-xl font-black text-white mb-2">WhatsApp Web Bloqueado</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-sm">
                O navegador bloqueou o acesso. Você pode abrir em uma nova aba clicando no botão abaixo.
              </p>
              <button
                onClick={handleOpenWhatsApp}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl transition-all"
              >
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

      {/* ─── SIDEBAR (30%) - Desktop Only ─── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="hidden lg:flex w-96 flex-col overflow-hidden bg-gradient-to-br from-gray-900 to-black border-l border-emerald-500/20"
      >
        {/* Sidebar Header */}
        <div className="flex-shrink-0 p-6 border-b border-emerald-500/20 bg-black/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-black" />
            </div>
            <div>
              <h3 className="font-black text-white uppercase tracking-tighter text-sm">Novo Processo</h3>
              <p className="text-xs text-gray-400 font-bold uppercase">WhatsApp</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Crie um novo processo do cliente enquanto conversa no WhatsApp
          </p>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <WhatsAppProcessSidebar
            agencyId={agencyId}
            token={token}
            user={user}
            destinations={destinations}
            visaTypes={visaTypes}
            plans={plans}
            onClose={() => {}}
          />
        </div>
      </motion.div>

      {/* ─── MOBILE DRAWER BUTTON ─── */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setShowFormDrawer(true)}
        className="lg:hidden fixed bottom-6 right-6 w-16 h-16 rounded-full brand-gradient shadow-2xl hover:shadow-emerald-500/50 flex items-center justify-center group z-40 transition-all"
        title="Novo Processo"
      >
        <span className="text-2xl font-black text-black group-hover:scale-125 transition-transform">+</span>
      </motion.button>

      {/* ─── MOBILE DRAWER MODAL ─── */}
      <AnimatePresence mode="wait">
        {showFormDrawer && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setShowFormDrawer(false)}
            />

            <motion.div
              key="drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 h-[90vh] bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-2xl z-50 lg:hidden flex flex-col rounded-t-3xl"
            >
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-[var(--border-color)]">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter">Novo Processo</h3>
                  <p className="text-xs text-[var(--text-muted)] font-bold uppercase">Via WhatsApp</p>
                </div>
                <button
                  onClick={() => setShowFormDrawer(false)}
                  className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors"
                >
                  <X size={24} className="text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <WhatsAppProcessSidebar
                  agencyId={agencyId}
                  token={token}
                  user={user}
                  destinations={destinations}
                  visaTypes={visaTypes}
                  plans={plans}
                  onClose={() => setShowFormDrawer(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
