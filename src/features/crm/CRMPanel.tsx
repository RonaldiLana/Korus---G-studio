import React from 'react';
import { Process, User } from '../../types';
import { Kanban, BarChart2, Zap, Bell } from 'lucide-react';
import { CRMKanban } from './CRMKanban';
import { CRMProcessDetail } from './CRMProcessDetail';
import { CRMAnalytics } from './CRMAnalytics';
import { CRMAutomation } from './CRMAutomation';
import { CRMFollowUp } from './CRMFollowUp';

const API_URL = import.meta.env.VITE_API_URL || '';

interface CRMPanelProps {
  processes: Process[];
  clients: User[];
  onUpdateStatus: (processId: number, newStatus: Process['status']) => void;
  onSelectProcess: (process: Process) => void;
  agencyId: number;
  user: User;
}

type CRMTab = 'kanban' | 'analytics' | 'automation' | 'followup';

const TABS: { id: CRMTab; label: string; icon: React.ElementType }[] = [
  { id: 'kanban', label: 'Pipeline', icon: Kanban },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'automation', label: 'Automações', icon: Zap },
  { id: 'followup', label: 'Follow-up', icon: Bell },
];

export const CRMPanel: React.FC<CRMPanelProps> = ({
  processes,
  clients,
  onUpdateStatus,
  onSelectProcess,
  agencyId,
  user,
}) => {
  const [activeTab, setActiveTab] = React.useState<CRMTab>('kanban');
  const [detailProcess, setDetailProcess] = React.useState<Process | null>(null);

  const token = localStorage.getItem('korus-token') || '';

  const handleSelectProcess = (process: Process) => {
    setDetailProcess(process);
    // Também dispara o callback pai para carregar o detalhe completo se necessário
    onSelectProcess(process);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)]">
      {/* Tab bar */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/30 px-6">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da tab ativa */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'kanban' && (
          <CRMKanban
            processes={processes}
            clients={clients}
            onUpdateStatus={onUpdateStatus}
            onSelectProcess={handleSelectProcess}
          />
        )}
        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto scrollbar-hide">
            <CRMAnalytics processes={processes} />
          </div>
        )}
        {activeTab === 'automation' && (
          <div className="h-full overflow-y-auto scrollbar-hide">
            <CRMAutomation agencyId={agencyId} token={token} />
          </div>
        )}
        {activeTab === 'followup' && (
          <div className="h-full overflow-y-auto scrollbar-hide">
            <CRMFollowUp processes={processes} onSelectProcess={handleSelectProcess} />
          </div>
        )}
      </div>

      {/* Drawer de detalhe do processo */}
      <CRMProcessDetail
        process={detailProcess}
        onClose={() => setDetailProcess(null)}
      />
    </div>
  );
};
