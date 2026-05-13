import React from 'react';
import { MapPin, FileText, Download, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface TrackingData {
  id: number;
  status: string;
  internal_status: string;
  process_type: string;
  created_at: string;
  destination_name: string | null;
  destination_flag: string | null;
  destination_image: string | null;
  visa_type_name: string | null;
  plan_name: string | null;
  plan_price: number | null;
  agency_name: string | null;
  agency_logo: string | null;
  client_name: string | null;
  documents: {
    id: number;
    name: string;
    url: string;
    status: string;
    uploaded_at: string;
  }[];
}

const STATUS_STEPS = [
  { id: 'started', label: 'Iniciado' },
  { id: 'payment_confirmed', label: 'Pagamento' },
  { id: 'analyzing', label: 'Em Análise' },
  { id: 'final_phase', label: 'Fase Final' },
  { id: 'completed', label: 'Concluído' },
];

const STATUS_MESSAGES: Record<string, { title: string; desc: string; color: string }> = {
  started: { title: 'Processo Iniciado', desc: 'Sua solicitação foi recebida e está sendo analisada pela equipe.', color: 'text-blue-400' },
  waiting_payment: { title: 'Aguardando Pagamento', desc: 'Realize o pagamento para prosseguir com o processo.', color: 'text-amber-400' },
  payment_confirmed: { title: 'Pagamento Confirmado', desc: 'Pagamento recebido! A equipe já está trabalhando no seu processo.', color: 'text-emerald-400' },
  analyzing: { title: 'Em Análise', desc: 'Nossa equipe está analisando detalhadamente a sua documentação.', color: 'text-purple-400' },
  final_phase: { title: 'Fase Final', desc: 'Seu processo está na fase final! Em breve você terá a resposta.', color: 'text-indigo-400' },
  completed: { title: 'Concluído!', desc: 'Parabéns! Seu processo foi concluído com sucesso.', color: 'text-emerald-400' },
};

function getStepIndex(status: string): number {
  const normalized = status === 'waiting_payment' ? 'payment_confirmed' : status;
  const idx = STATUS_STEPS.findIndex((s) => s.id === normalized);
  return idx >= 0 ? idx : 0;
}

function resolveDocUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

export const ClientTrackingPage: React.FC = () => {
  const [data, setData] = React.useState<TrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const tokenIdx = pathParts.indexOf('acompanhamento');
    const token = tokenIdx !== -1 ? pathParts[tokenIdx + 1] : null;

    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/processes/track/${token}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const json = await res.json();
        setData(json);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-bold">Carregando seu processo...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center">
            <AlertCircle size={40} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Link não encontrado</h1>
          <p className="text-[var(--text-muted)] text-sm max-w-xs">
            Este link de acompanhamento é inválido ou expirou. Entre em contato com a agência.
          </p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MESSAGES[data.status] || STATUS_MESSAGES.started;
  const currentStep = getStepIndex(data.status);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header da Agência */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          {data.agency_logo ? (
            <img src={data.agency_logo} alt={data.agency_name || ''} className="h-8 w-auto object-contain" />
          ) : (
            <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center">
              <MapPin size={14} className="text-black" />
            </div>
          )}
          <span className="font-black text-sm tracking-widest uppercase">
            {data.agency_name || 'Korus'}
          </span>
          <span className="ml-auto text-[10px] font-bold text-[var(--text-muted)] bg-white/5 px-2 py-1 rounded-lg border border-white/10">
            Processo Simplificado #{data.id}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Status Principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-2"
        >
          <div className={`text-4xl font-black ${statusInfo.color}`}>
            {statusInfo.title}
          </div>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">{statusInfo.desc}</p>
          {data.client_name && (
            <p className="text-xs text-gray-500 mt-1">Olá, <span className="text-white font-bold">{data.client_name}</span>!</p>
          )}
        </motion.div>

        {/* Barra de Progresso */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6"
        >
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Etapas do Processo</h2>
          <div className="relative flex items-center justify-between">
            {/* Linha de fundo */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/10 z-0" />
            {/* Linha de progresso */}
            <div
              className="absolute top-5 left-5 h-0.5 brand-gradient z-0 transition-all duration-700"
              style={{ width: `calc(${(currentStep / (STATUS_STEPS.length - 1)) * 100}% - ${currentStep === STATUS_STEPS.length - 1 ? 0 : 20}px)` }}
            />
            {STATUS_STEPS.map((step, i) => (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 text-xs font-black ${
                    i < currentStep
                      ? 'brand-gradient border-transparent text-black'
                      : i === currentStep
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-white/5 text-gray-600'
                  }`}
                >
                  {i < currentStep ? <CheckCircle2 size={16} /> : <span>{i + 1}</span>}
                </div>
                <span
                  className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                    i <= currentStep ? 'text-emerald-400' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Informações do Processo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Detalhes do Processo</h2>
          <div className="grid grid-cols-2 gap-4">
            {data.destination_name && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Destino</p>
                <p className="text-sm font-black text-white">
                  {data.destination_flag} {data.destination_name}
                </p>
              </div>
            )}
            {data.visa_type_name && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Tipo de Visto</p>
                <p className="text-sm font-black text-white">{data.visa_type_name}</p>
              </div>
            )}
            {data.plan_name && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Plano</p>
                <p className="text-sm font-black text-white">{data.plan_name}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Aberto em</p>
              <p className="text-sm font-black text-white flex items-center gap-1">
                <Clock size={12} className="text-gray-500" />
                {new Date(data.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Documentos e Relatórios */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
        >
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
            <FileText size={11} />
            Documentos e Relatórios
          </h2>

          <AnimatePresence>
            {data.documents.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 text-center space-y-2"
              >
                <div className="w-14 h-14 mx-auto bg-white/5 rounded-2xl flex items-center justify-center">
                  <FileText size={24} className="text-gray-600" />
                </div>
                <p className="text-sm font-bold text-gray-500">Nenhum documento disponível ainda</p>
                <p className="text-xs text-gray-600">A agência irá adicionar documentos conforme o andamento do processo.</p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {data.documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <a
                      href={resolveDocUrl(doc.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-black transition-all"
                      download
                    >
                      <Download size={12} />
                      Baixar
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-600 pb-4">
          Powered by <span className="font-black text-gray-500">Korus</span> · Processo #{data.id}
        </div>
      </div>
    </div>
  );
};
