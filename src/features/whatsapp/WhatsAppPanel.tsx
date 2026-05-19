import React, { useState, useEffect, useRef } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { X, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WhatsAppProcessSidebar } from './WhatsAppProcessSidebar';
import { WhatsAppWebFallback } from './WhatsAppWebFallback';

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
  const [showFallback, setShowFallback] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Timeout de 5 segundos para detectar se o iframe não carregou
    timeoutRef.current = setTimeout(() => {
      console.warn('WhatsApp iframe não carregou em 5 segundos, mostrando fallback');
      setShowFallback(true);
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [iframeKey]);

  const handleIframeLoad = () => {
    // Limpar timeout se o iframe carregou com sucesso
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    console.log('WhatsApp iframe carregou com sucesso');
  };

  const handleIframeError = () => {
    console.error('Erro ao carregar WhatsApp iframe');
    setShowFallback(true);
  };

  const handleRetry = () => {
    setShowFallback(false);
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-black relative">
      {/* ─── WHATSAPP WEB - FULL SCREEN ─── */}
      {showFallback ? (
        <WhatsAppWebFallback onRetry={handleRetry} />
      ) : (
        <iframe
          key={`whatsapp-web-${iframeKey}`}
          src="https://web.whatsapp.com"
          title="WhatsApp Web"
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation allow-storage-access-by-user-activation allow-modals"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      )}

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
