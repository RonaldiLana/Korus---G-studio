import React from 'react';
import { UserPlus } from 'lucide-react';

interface WhatsAppRightPanelProps {
  onOpenProcess: () => void;
}

export const WhatsAppRightPanel: React.FC<WhatsAppRightPanelProps> = ({
  onOpenProcess,
}) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black border-l border-gray-800 p-6">
      {/* Button */}
      <button
        onClick={onOpenProcess}
        className="w-48 h-48 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all flex flex-col items-center justify-center gap-4 shadow-lg hover:shadow-emerald-500/50 group"
      >
        <UserPlus size={48} className="text-white group-hover:scale-110 transition-transform" />
        <div className="text-center">
          <p className="text-white font-black text-lg">Criar</p>
          <p className="text-white font-black text-lg">Processo</p>
        </div>
      </button>

      {/* Info Text */}
      <p className="text-gray-500 text-xs mt-8 text-center max-w-xs">
        Clique no botão ao lado para iniciar um novo processo de visto ou cadastrar um cliente
      </p>
    </div>
  );
};
