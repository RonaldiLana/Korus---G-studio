import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, FileText, MessageSquare, LayoutDashboard, Globe, Star, ShieldCheck, ArrowUpRight, Calendar, DollarSign } from 'lucide-react';
import { Process } from '../../types';

interface Props {
  destination?: { name: string; flag: string };
  plan?: { name: string; icon: any };
  processes: Process[];
}

const PROCESS_STEPS = [
  { id: 'started', label: 'Processo Iniciado', status: 'completed', date: '18 Mar 2026' },
  { id: 'payment_confirmed', label: 'Pagamento Confirmado', status: 'completed', date: '18 Mar 2026' },
  { id: 'analyzing', label: 'Análise de Perfil', status: 'current', date: 'Em andamento' },
  { id: 'final_phase', label: 'Preparação de Documentos', status: 'pending', date: '-' },
  { id: 'submitted', label: 'Submissão do Visto', status: 'pending', date: '-' },
  { id: 'completed', label: 'Visto Aprovado', status: 'pending', date: '-' },
];

const getStepStatus = (process: Process, stepId: string) => {
  const statusOrder = ['started', 'payment_confirmed', 'analyzing', 'final_phase', 'completed'];
  const currentStatusIndex = statusOrder.indexOf(process.status);
  const stepIndex = statusOrder.indexOf(stepId);

  if (stepIndex < currentStatusIndex) return 'completed';
  if (stepIndex === currentStatusIndex) return 'current';
  return 'pending';
};

export const ClientProcessDashboard: React.FC<Props> = ({ destination, plan, processes }) => {
  const latestProcess = processes.length > 0 ? processes[0] : null;

  // Fallback destination and plan if not provided but process exists
  const displayDestination = destination || (latestProcess ? { 
    name: latestProcess.visa_name || 'Visto em Processamento', 
    flag: '🌎' 
  } : { name: '-', flag: '🌎' });

  const displayPlan = plan || { name: 'Consultoria Premium', icon: Star };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-12 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-6">
              <LayoutDashboard size={14} />
              Status do seu Processo
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 leading-tight">
              Seu sonho para o <span className="brand-text-gradient">{displayDestination.name}</span> está em andamento.
            </h1>
            <p className="text-zinc-400 text-lg font-medium">
              Acompanhe cada etapa da sua jornada internacional com a Korus.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-4"
          >
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Destino</p>
              <div className="flex items-center gap-2 text-xl font-black">
                <span>{displayDestination.flag}</span>
                <span>{displayDestination.name}</span>
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Plano</p>
              <div className="flex items-center gap-2 text-xl font-black text-emerald-400">
                <displayPlan.icon size={20} />
                <span>{displayPlan.name}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {!latestProcess ? (
          <div className="text-center py-32 bg-zinc-900/30 rounded-[40px] border border-dashed border-white/5">
            <FileText className="mx-auto text-zinc-800 mb-6" size={80} />
            <h2 className="text-2xl font-black tracking-tighter text-zinc-400 mb-4">Nenhum processo ativo</h2>
            <p className="text-zinc-500 font-medium mb-8">Você ainda não iniciou sua jornada. Comece agora escolhendo um destino.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Timeline */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl">
                <h2 className="text-2xl font-black tracking-tighter mb-10 flex items-center gap-3">
                  <Clock className="text-emerald-400" />
                  Linha do Tempo
                </h2>

                <div className="space-y-12 relative">
                  {/* Vertical Line */}
                  <div className="absolute left-[23px] top-2 bottom-2 w-px bg-zinc-800" />

                  {PROCESS_STEPS.map((step, index) => {
                    const status = getStepStatus(latestProcess, step.id);
                    return (
                      <div key={step.id} className="flex items-start gap-8 relative">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 ${
                          status === 'completed' ? 'bg-emerald-500 text-black' : 
                          status === 'current' ? 'bg-zinc-800 border-2 border-emerald-500 text-emerald-400' :
                          'bg-zinc-900 border border-white/5 text-zinc-600'
                        }`}>
                          {status === 'completed' ? <CheckCircle2 size={24} /> : 
                           status === 'current' ? <Clock size={24} className="animate-pulse" /> :
                           <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`text-lg font-black ${
                              status === 'pending' ? 'text-zinc-600' : 'text-white'
                            }`}>
                              {step.label}
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                              {status === 'completed' ? 'Concluído' : status === 'current' ? 'Em andamento' : '-'}
                            </span>
                          </div>
                          <p className="text-zinc-500 text-sm font-medium">
                            {status === 'completed' ? 'Etapa concluída com sucesso.' :
                             status === 'current' ? 'Nossos especialistas estão trabalhando nesta etapa.' :
                             'Aguardando etapas anteriores.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Other Processes if any */}
              {processes.length > 1 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-black tracking-tighter">Outros Processos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {processes.slice(1).map(p => (
                      <div key={p.id} className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                            <FileText size={20} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">
                            {p.status}
                          </span>
                        </div>
                        <h4 className="font-black tracking-tight">{p.visa_name || 'Visto'}</h4>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Iniciado em {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Widgets */}
            <div className="space-y-8">
              {/* Next Step Card */}
              <div className="bg-emerald-500 text-black rounded-[40px] p-8 shadow-[0_0_50px_rgba(0,255,136,0.2)]">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Próximo Passo</p>
                <h3 className="text-2xl font-black tracking-tighter mb-4">
                  {latestProcess.status === 'started' ? 'Aguardar Confirmação' : 
                   latestProcess.status === 'payment_confirmed' ? 'Enviar Documentos' :
                   latestProcess.status === 'analyzing' ? 'Revisão de Perfil' : 'Finalizar Processo'}
                </h3>
                <p className="text-black/70 text-sm font-bold leading-relaxed mb-8">
                  {latestProcess.status === 'payment_confirmed' 
                    ? 'Prepare seu passaporte e comprovantes de residência. Nossa equipe enviará o checklist completo em breve.'
                    : 'Acompanhe as atualizações aqui na plataforma ou fale com seu consultor.'}
                </p>
                <button className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                  Ver Detalhes
                  <ArrowUpRight size={16} />
                </button>
              </div>

              {/* Support Card */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
                <h3 className="text-xl font-black tracking-tighter mb-6 flex items-center gap-2">
                  <MessageSquare className="text-emerald-400" />
                  Suporte Korus
                </h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-8">
                  Dúvidas sobre o processo? Fale com seu consultor dedicado agora mesmo.
                </p>
                <button className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                  Abrir Chat
                </button>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
                  <Calendar className="text-zinc-500 mb-4" size={20} />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Início</p>
                  <p className="text-sm font-black">{new Date(latestProcess.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
                  <DollarSign className="text-zinc-500 mb-4" size={20} />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Pagamento</p>
                  <p className={`text-sm font-black ${latestProcess.status !== 'started' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {latestProcess.status !== 'started' ? 'Confirmado' : 'Pendente'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
