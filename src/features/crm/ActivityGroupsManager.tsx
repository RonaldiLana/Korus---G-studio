import React from 'react';
import { Users, UserCheck, UserMinus, UserPlus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { ActivityGroup, ActivityGroupMember, User } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ActivityGroupsManagerProps {
  agencyId: number;
  user: User;
}

const PROFILE_LABELS: Record<string, { label: string; color: string; stageDesc: string }> = {
  consultant: {
    label: 'Consultores',
    color: 'emerald',
    stageDesc: 'Visualizam processos: Iniciado → Aguard. Pagamento → Pgto Confirmado → Em Análise',
  },
  analyst: {
    label: 'Analistas',
    color: 'purple',
    stageDesc: 'Visualizam processos: Em Análise → Fase Final → Concluído',
  },
};

export const ActivityGroupsManager: React.FC<ActivityGroupsManagerProps> = ({ agencyId, user }) => {
  const [groups, setGroups] = React.useState<ActivityGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [removingId, setRemovingId] = React.useState<number | null>(null);

  const fetchGroups = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/activity-groups?agency_id=${agencyId}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        // Expandir todos por padrão
        const exp: Record<number, boolean> = {};
        data.forEach((g: ActivityGroup) => { exp[g.id] = true; });
        setExpanded(exp);
      }
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  React.useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleRemoveMember = async (groupId: number, userId: number) => {
    setRemovingId(userId);
    try {
      await fetch(`${API_URL}/api/activity-groups/members/${groupId}/${userId}?agency_id=${agencyId}`, {
        method: 'DELETE',
      });
      await fetchGroups();
    } finally {
      setRemovingId(null);
    }
  };

  const toggleExpand = (groupId: number) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Users className="text-black" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Grupos de Atividade</h2>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Controle de visibilidade por perfil e etapa
            </p>
          </div>
        </div>
        <button
          onClick={fetchGroups}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Aviso explicativo */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-medium leading-relaxed">
        <strong className="text-blue-200">Como funciona:</strong> Cada agência possui grupos automáticos por perfil.
        Todos os <strong>consultores</strong> do grupo veem os mesmos processos nas etapas iniciais e sabem quem assumiu cada um.
        Quando um processo avança para <strong>"Em Análise"</strong>, os <strong>analistas</strong> passam a vê-lo automaticamente.
        Usuários de outras agências não têm acesso a nenhum dado desta agência.
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          Nenhum grupo encontrado. Grupos são criados automaticamente quando consultores ou analistas são cadastrados.
        </div>
      )}

      {/* Grupos */}
      {groups.map((group) => {
        const meta = PROFILE_LABELS[group.profile];
        const isExpanded = expanded[group.id] ?? true;
        const members: ActivityGroupMember[] = group.members || [];
        const colorClass = meta?.color === 'purple'
          ? { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' }
          : { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' };

        return (
          <div
            key={group.id}
            className="bg-[var(--bg-card)]/40 border border-[var(--border-color)] rounded-2xl overflow-hidden"
          >
            {/* Header do grupo */}
            <button
              onClick={() => toggleExpand(group.id)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${colorClass.dot}`} />
                <div className="text-left">
                  <h3 className="font-black text-sm uppercase tracking-wider">{meta?.label || group.name}</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${colorClass.text}`}>
                    {meta?.stageDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colorClass.bg} ${colorClass.border} border ${colorClass.text}`}>
                  {members.length} membro{members.length !== 1 ? 's' : ''}
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
              </div>
            </button>

            {/* Lista de membros */}
            {isExpanded && (
              <div className="border-t border-[var(--border-color)]">
                {members.length === 0 ? (
                  <div className="p-6 text-center text-[var(--text-muted)] text-xs">
                    Nenhum membro neste grupo. Cadastre usuários com o perfil <strong>{meta?.label}</strong> para que sejam adicionados automaticamente.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-color)]">
                    {members.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${colorClass.bg} ${colorClass.text}`}>
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--text-main)]">{member.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg-input)] px-2 py-1 rounded-lg border border-[var(--border-color)]">
                            {member.role}
                          </span>
                          {/* Remover só disponível para supervisor/master */}
                          {(user.role === 'master' || user.role === 'supervisor') && (
                            <button
                              onClick={() => handleRemoveMember(group.id, member.user_id)}
                              disabled={removingId === member.user_id}
                              title="Remover do grupo"
                              className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-[var(--text-muted)] transition-all disabled:opacity-40"
                            >
                              {removingId === member.user_id
                                ? <RefreshCw size={13} className="animate-spin" />
                                : <UserMinus size={13} />
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nota sobre adição automática */}
                <div className="px-5 py-3 border-t border-[var(--border-color)] flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <UserPlus size={11} />
                  Novos usuários com o perfil <strong className="text-[var(--text-main)]">{meta?.label}</strong> são adicionados automaticamente a este grupo ao fazer login.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
