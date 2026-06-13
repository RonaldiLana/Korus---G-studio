import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';

interface ZipsignEmbedProps {
  signUrl: string;
  contractName: string;
  onClose: () => void;
  onSigned?: () => void;
}

const ZipsignEmbed: React.FC<ZipsignEmbedProps> = ({
  signUrl,
  contractName,
  onClose,
  onSigned,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [signed, setSigned] = useState(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleSigned = () => {
    setSigned(true);
    setTimeout(() => {
      onSigned?.();
      onClose();
    }, 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--bg-card)] w-full max-w-4xl h-[90vh] rounded-3xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-[var(--bg-input)]/30">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black truncate">{contractName}</h3>
              <p className="text-xs text-[var(--text-muted)]">Assine o documento abaixo</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 hover:bg-[var(--bg-card)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-input)]/50 z-40">
                <div className="text-center">
                  <div className="text-4xl mb-4 animate-bounce">📄</div>
                  <p className="text-[var(--text-muted)]">Carregando documento...</p>
                </div>
              </div>
            )}

            {signed && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-overlay)] z-50">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-center"
                >
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <p className="text-lg font-bold text-emerald-400">Contrato Assinado com Sucesso!</p>
                </motion.div>
              </div>
            )}

            <iframe
              src={signUrl}
              className="w-full h-full border-none"
              onLoad={handleIframeLoad}
              title="Assinatura de Contrato"
              allow="camera; microphone; clipboard-read; clipboard-write"
            />
          </div>

          {/* Footer Info */}
          <div className="px-6 py-3 bg-[var(--bg-input)]/30 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
            💡 Após assinar, você será notificado automaticamente. Feche esta janela para retornar.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ZipsignEmbed;
