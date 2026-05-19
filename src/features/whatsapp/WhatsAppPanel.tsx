import React, { useState, useEffect } from 'react';
import { User, Destination, VisaType, Plan } from '../../types';
import { X, UserPlus, MessageCircle, ExternalLink, Smartphone } from 'lucide-react';
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
  const [isLoadingWeb, setIsLoadingWeb] = useState(false);

  const handleOpenWhatsAppWeb = () => {
    setIsLoadingWeb(true);
    window.open('https://web.whatsapp.com', 'whatsapp_web', 'width=1200,height=800');
    setTimeout(() => setIsLoadingWeb(false), 1000);
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900 relative">
      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-4">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl">
            <MessageCircle size={56} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 tracking-tighter">
            WhatsApp Web
          </h1>
          <p className="text-gray-400 text-lg">
            Acesse sua conta do WhatsApp Web oficial
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full"
        >
          {[
            { icon: MessageCircle, label: 'Enviar Mensagens', desc: 'Em tempo real' },
            { icon: Smartphone, label: 'Conectado', desc: 'Pelo celular' },
            { icon: ExternalLink, label: 'Oficial', desc: 'web.whatsapp.com' },
          ].map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white/5 border border-emerald-500/20 hover:border-emerald-500/50 transition-all"
            >
              <item.icon className="text-emerald-400 mb-2" size={24} />
              <p className="text-white font-bold text-sm">{item.label}</p>
              <p className="text-gray-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Main Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleOpenWhatsAppWeb}
          disabled={isLoadingWeb}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-70 text-white font-black text-lg flex items-center gap-3 transition-all shadow-2xl hover:shadow-emerald-500/50"
        >
          <ExternalLink size={24} />
          {isLoadingWeb ? 'Abrindo...' : 'Abrir WhatsApp Web'}
        </motion.button>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 max-w-2xl w-full"
        >
          <p className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
            <Smartphone size={18} />
            Como usar:
          </p>
          <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
            <li>Clique no botão acima para abrir WhatsApp Web</li>
            <li>Aponte o celular para escanear o QR code</li>
            <li>Seu WhatsApp estará pronto para usar</li>
            <li>Você permanecerá conectado enquanto o navegador estiver aberto</li>
          </ol>
        </motion.div>
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
