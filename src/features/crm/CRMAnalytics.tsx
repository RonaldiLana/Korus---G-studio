import React from 'react';
import { Process } from '../../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  Target,
  Globe,
  Layers,
  FileCheck,
  Briefcase,
} from 'lucide-react';

interface CRMAnalyticsProps {
  processes: Process[];
}

const STATUS_LABELS: Record<string, string> = {
  started: 'Iniciado',
  waiting_payment: 'Aguard. Pagamento',
  payment_confirmed: 'Pgto Confirmado',
  analyzing: 'Em Análise',
  final_phase: 'Fase Final',
  completed: 'Concluído',
};

const STATUS_ORDER = [
  'started',
  'waiting_payment',
  'payment_confirmed',
  'analyzing',
  'final_phase',
  'completed',
] as const;

function getDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

const DONUT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#ec4899'];

function groupByField(
  procs: Process[],
  key: keyof Process,
  top = 7,
): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  procs.forEach((p) => {
    const raw = p[key];
    const label = typeof raw === 'string' && raw.trim() ? raw.trim() : 'Não informado';
    map[label] = (map[label] ?? 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

const DonutChartCard: React.FC<{
  icon: React.ElementType;
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
  total: number;
}> = ({ icon: Icon, title, data, colors, total }) => (
  <div className="bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] p-5 flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-emerald-400" />
      <h3 className="text-sm font-black uppercase tracking-tight">{title}</h3>
    </div>
    {data.length === 0 ? (
      <p className="text-xs text-[var(--text-muted)] text-center py-8">Sem dados</p>
    ) : (
      <>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card, #1a1a2e)',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-main, #fff)',
                }}
                formatter={(value: number, name: string) => [
                  `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: colors[i % colors.length] }}
              />
              <span className="truncate text-[var(--text-main)] font-bold flex-1">{d.name}</span>
              <span className="text-[var(--text-muted)] tabular-nums">{d.value}</span>
              <span className="text-[var(--text-muted)] tabular-nums w-8 text-right">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </>
    )}
  </div>
);

const MetricCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon: Icon, label, value, sub, color = 'text-emerald-400' }) => (
  <div className="p-5 bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] flex items-start gap-4">
    <div className={`w-10 h-10 rounded-xl bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className={`text-2xl font-black tracking-tighter mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  </div>
);

export const CRMAnalytics: React.FC<CRMAnalyticsProps> = ({ processes }) => {
  const total = processes.length;
  const completed = processes.filter((p) => p.status === 'completed').length;
  const inProgress = processes.filter((p) => p.status !== 'completed').length;
  const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const avgDaysByStage = STATUS_ORDER.map((status) => {
    const stageProcesses = processes.filter((p) => p.status === status);
    return {
      status,
      count: stageProcesses.length,
      avgDays: avg(stageProcesses.map((p) => getDays(p.created_at))),
    };
  });

  // Gargalo: etapa com mais processos E mais dias de média
  const bottleneck = [...avgDaysByStage]
    .filter((s) => s.status !== 'completed')
    .sort((a, b) => b.count * b.avgDays - a.count * a.avgDays)[0];

  // Processos com pagamento confirmado (receita realizada)
  const paidCount = processes.filter((p) => p.payment_status === 'confirmed').length;
  const pendingCount = processes.filter((p) => p.payment_status !== 'confirmed').length;

  // Performance por consultor
  const consultorMap: Record<string, { total: number; completed: number }> = {};
  processes.forEach((p) => {
    const name = p.consultant_name || 'Sem consultor';
    if (!consultorMap[name]) consultorMap[name] = { total: 0, completed: 0 };
    consultorMap[name].total += 1;
    if (p.status === 'completed') consultorMap[name].completed += 1;
  });
  const consultorStats = Object.entries(consultorMap)
    .map(([name, { total, completed }]) => ({
      name,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  // Processos inativos (>14 dias sem avançar)
  const inactiveCount = processes.filter(
    (p) => p.status !== 'completed' && getDays(p.created_at) > 14
  ).length;

  // Datasets para gráficos de rosca
  const processTypeData = (() => {
    const map: Record<string, number> = { Normal: 0, Simplificado: 0 };
    processes.forEach((p) => {
      if (p.process_type === 'simplified') map['Simplificado'] += 1;
      else map['Normal'] += 1;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  })();

  const destinationData = groupByField(processes, 'destination_name', 7);
  const visaData = groupByField(processes, 'visa_name', 7);
  const planData = groupByField(processes, 'plan_name', 7);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg">
          <BarChart2 className="text-black" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter">Painel Analítico</h2>
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
            Baseado em {total} processo{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total de Processos" value={total} />
        <MetricCard icon={CheckCircle} label="Concluídos" value={completed} color="text-emerald-400" />
        <MetricCard icon={TrendingUp} label="Taxa de Conversão" value={`${conversionRate}%`} sub={`${inProgress} em andamento`} color={conversionRate >= 60 ? 'text-emerald-400' : 'text-amber-400'} />
        <MetricCard icon={AlertTriangle} label="Processos Inativos" value={inactiveCount} sub="+14 dias sem avanço" color={inactiveCount > 0 ? 'text-red-400' : 'text-emerald-400'} />
      </div>

      {/* Receita */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard icon={DollarSign} label="Pagamentos Confirmados" value={paidCount} sub={`${total > 0 ? Math.round((paidCount / total) * 100) : 0}% do total`} color="text-emerald-400" />
        <MetricCard icon={DollarSign} label="Pagamentos Pendentes" value={pendingCount} sub={`${total > 0 ? Math.round((pendingCount / total) * 100) : 0}% do total`} color="text-amber-400" />
      </div>

      {/* Distribuição por tipo e destino */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-main)]">Distribuição por Tipo e Destino</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <DonutChartCard
            icon={Layers}
            title="Tipo de Processo"
            data={processTypeData}
            colors={['#10b981', '#6366f1']}
            total={total}
          />
          <DonutChartCard
            icon={Globe}
            title="Por Destino"
            data={destinationData}
            colors={DONUT_COLORS}
            total={total}
          />
          <DonutChartCard
            icon={FileCheck}
            title="Tipo de Visto"
            data={visaData}
            colors={DONUT_COLORS.slice(2)}
            total={total}
          />
          <DonutChartCard
            icon={Briefcase}
            title="Por Plano"
            data={planData}
            colors={DONUT_COLORS.slice(1)}
            total={total}
          />
        </div>
      </div>

      {/* Tempo médio por etapa */}
      <div className="bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black uppercase tracking-tight">Tempo Médio por Etapa</h3>
        </div>
        <div className="space-y-3">
          {avgDaysByStage.map(({ status, count, avgDays }) => {
            const isBottleneck = bottleneck?.status === status;
            return (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-main)]">{STATUS_LABELS[status]}</span>
                    {isBottleneck && count > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest">
                        Gargalo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--text-muted)]">{count} processos</span>
                    <span className={`text-xs font-black ${avgDays > 14 ? 'text-red-400' : avgDays > 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {avgDays}d méd.
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isBottleneck && count > 0 ? 'bg-red-500' : avgDays > 14 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (count / Math.max(total, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance por consultor */}
      {consultorStats.length > 0 && (
        <div className="bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-tight">Performance por Consultor</h3>
          </div>
          <div className="space-y-3">
            {consultorStats.map(({ name, total: t, completed: c, rate }) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-main)] truncate max-w-[180px]">{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--text-muted)]">{c}/{t}</span>
                    <span className={`text-xs font-black ${rate >= 70 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {rate}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribuição por etapa */}
      <div className="bg-[var(--bg-card)]/50 rounded-2xl border border-[var(--border-color)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-emerald-400" />
          <h3 className="text-sm font-black uppercase tracking-tight">Distribuição por Etapa</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STATUS_ORDER.map((status) => {
            const count = processes.filter((p) => p.status === status).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} className="p-3 bg-[var(--bg-input)]/50 rounded-xl border border-[var(--border-color)] text-center">
                <p className="text-2xl font-black text-emerald-400">{count}</p>
                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">
                  {STATUS_LABELS[status]}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
