import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, FileText, MessageSquare, LayoutDashboard, Globe, Star, ShieldCheck, ArrowUpRight, Calendar, DollarSign, Upload, Loader2, Zap, ShieldCheck as ShieldCheckIcon, X, Send, User as UserIcon, Pencil, Check } from 'lucide-react';
import { Process } from '../../types';
import axios from 'axios';
import { toast } from 'sonner';

const MAX_DOC_SIZE_MB = 5;
const MAX_DOC_SIZE = MAX_DOC_SIZE_MB * 1024 * 1024; // 5 MB
const MAX_DOCS = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

const ICON_MAP: Record<string, any> = {
  Star,
  ShieldCheck: ShieldCheckIcon,
  Zap
};

interface Props {
  destination?: { name: string; flag: string };
  plan?: { name: string; icon: any };
  processes: Process[];
}

const PROCESS_STEPS = [
  { id: 'started', label: 'Iniciado' },
  { id: 'waiting_payment', label: 'Pagamento' },
  { id: 'payment_confirmed', label: 'Confirmado' },
  { id: 'analyzing', label: 'Análise' },
  { id: 'final_phase', label: 'Fase Final' },
  { id: 'completed', label: 'Concluído' },
];

const getStepStatus = (process: Process, stepId: string) => {
  const statusOrder = ['started', 'waiting_payment', 'payment_confirmed', 'analyzing', 'final_phase', 'completed'];
  
  const currentStatus = process.status;
  const currentStatusIndex = statusOrder.indexOf(currentStatus);
  const stepIndex = statusOrder.indexOf(stepId);

  if (stepIndex < currentStatusIndex) return 'completed';
  if (stepIndex === currentStatusIndex) return 'current';
  return 'pending';
};

export const ClientProcessDashboard: React.FC<Props> = ({ destination, plan, processes }) => {
  const API_URL =
    import.meta.env.VITE_API_URL?.trim() ||
    'https://korus-backend-a55k.onrender.com';

  // Garante que URLs relativas (/uploads/...) sejam resolvidas contra o backend
  const resolveFileUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };
  const latestProcess = processes.length > 0 ? processes[0] : null;
  const [fullProcess, setFullProcess] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [editingForm, setEditingForm] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [extraDocName, setExtraDocName] = useState('');
  const extraDocInputRef = useRef<HTMLInputElement>(null);

  const isPaymentConfirmed = ['payment_confirmed', 'analyzing', 'final_phase', 'submitted', 'completed'].includes(latestProcess?.status || '');

  const fetchFullProcess = async () => {
    if (!latestProcess) return;
    try {
      const res = await axios.get(`${API_URL}/api/processes/${latestProcess.id}`);
      setFullProcess(res.data);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes do processo:', err);
    }
  };

  useEffect(() => {
    fetchFullProcess();
  }, [latestProcess?.id, latestProcess?.status]);

  // Auto-abre detalhes quando cliente tem docs pendentes
  useEffect(() => {
    if (latestProcess?.internal_status === 'documents_requested') {
      setShowDetails(true);
    }
  }, [latestProcess?.internal_status]);

  const fetchMessages = async () => {
    if (!latestProcess) return;
    try {
      const res = await axios.get(`${API_URL}/api/processes/${latestProcess.id}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !latestProcess) return;

    try {
      await axios.post(`${API_URL}/api/messages`, {
        process_id: latestProcess.id,
        sender_id: latestProcess.client_id,
        content: chatMessage,
        is_proof: false
      });
      setChatMessage('');
      fetchMessages();
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  useEffect(() => {
    if (showChat) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [showChat, latestProcess?.id]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !latestProcess) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('process_id', latestProcess.id.toString());

    try {
      await axios.post(`${API_URL}/api/financials/confirm-proof`, formData);
      toast.success('Comprovante enviado com sucesso! Aguarde a confirmação do consultor.');
      setTimeout(() => fetchFullProcess(), 1500);
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, docName: string) => {
    const file = e.target.files?.[0];
    // Limpar valor do input para permitir re-upload do mesmo arquivo
    e.target.value = '';
    if (!file || !latestProcess) return;

    // Validação de tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo não permitido. Envie imagens (JPEG, PNG, WEBP) ou PDF.');
      return;
    }

    // Validação de tamanho (5 MB)
    if (file.size > MAX_DOC_SIZE) {
      toast.error(`Arquivo muito grande. Tamanho máximo: ${MAX_DOC_SIZE_MB} MB.`);
      return;
    }

    // Validação de quantidade (max 3)
    const currentCount = fullProcess?.documents?.length || 0;
    if (currentCount >= MAX_DOCS) {
      toast.error(`Limite de ${MAX_DOCS} documentos por processo atingido.`);
      return;
    }

    setUploadingDoc(docName);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('process_id', latestProcess.id.toString());
    fd.append('name', docName);

    try {
      await axios.post(`${API_URL}/api/documents`, fd);
      toast.success(`Documento "${docName}" enviado com sucesso!`);
      fetchFullProcess();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Erro ao enviar documento. Tente novamente.';
      toast.error(msg);
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleFormResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm || !latestProcess) return;

    try {
      await axios.post(`${API_URL}/api/form-responses`, {
        process_id: latestProcess.id,
        form_id: editingForm.form_id,
        data: formData
      });
      toast.success('Formulário enviado com sucesso!');
      setEditingForm(null);
      fetchFullProcess();
    } catch (err) {
      toast.error('Erro ao enviar formulário');
    }
  };

  // Fallback destination and plan if not provided but process exists
  const displayDestination = destination || (latestProcess ? { 
    name: latestProcess.destination_name || latestProcess.visa_name || 'Visto em Processamento', 
    flag: latestProcess.destination_image || '🌎' 
  } : { name: '-', flag: '🌎' });

  const displayPlan = plan || (latestProcess?.plan_name ? { name: latestProcess.plan_name, icon: Star } : { name: 'Consultoria Premium', icon: Star });
  const PlanIcon = typeof displayPlan.icon === 'string' ? (ICON_MAP[displayPlan.icon] || Star) : (displayPlan.icon || Star);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 md:p-12 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 sm:mb-6">
              <LayoutDashboard size={14} />
              Status do seu Processo
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-3 sm:mb-4 leading-tight">
              Seu sonho para o <span className="brand-text-gradient">{displayDestination.name}</span> está em andamento.
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg font-medium">
              Acompanhe cada etapa da sua jornada internacional com a Korus.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3 sm:gap-4 flex-wrap"
          >
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl flex-1 min-w-[130px]">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Destino</p>
              <div className="flex items-center gap-2 text-base sm:text-xl font-black">
                {displayDestination.flag.length > 2 ? (
                  <img src={displayDestination.flag} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{displayDestination.flag}</span>
                )}
                <span className="truncate">{displayDestination.name}</span>
              </div>
            </div>
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl flex-1 min-w-[130px]">
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Plano</p>
              <div className="flex items-center gap-2 text-base sm:text-xl font-black text-emerald-400">
                <PlanIcon size={18} />
                <span className="truncate">{displayPlan.name}</span>
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

              {/* Details Section: Forms & Documents */}
              <AnimatePresence>
                {showDetails && fullProcess && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-8"
                  >
                    {!isPaymentConfirmed ? (
                      <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl text-center">
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                          <ShieldCheck size={32} className="text-zinc-500" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tighter mb-4">Acesso Restrito</h2>
                        <p className="text-zinc-500 font-medium max-w-md mx-auto">
                          Os formulários e a opção de envio de documentos serão liberados assim que a confirmação do seu pagamento for processada por nossa equipe.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Forms Section — usa process_forms */}
                        {fullProcess.process_forms && fullProcess.process_forms.length > 0 && (
                          <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl">
                            <h2 className="text-2xl font-black tracking-tighter mb-8 flex items-center gap-3">
                              <FileText className="text-emerald-400" />
                              Formulários Necessários
                            </h2>
                            <div className="space-y-6">
                              {fullProcess.process_forms.map((pf: any) => {
                                const fields = typeof pf.form_fields === 'string' ? JSON.parse(pf.form_fields) : (pf.form_fields || []);
                                const data = typeof pf.response_data === 'string' ? JSON.parse(pf.response_data) : (pf.response_data || {});
                                const isSubmitted = pf.response_status === 'submitted' || pf.response_status === 'locked';
                                const hasData = Object.keys(data).length > 0;

                                return (
                                  <div key={pf.id} className="p-6 rounded-3xl bg-zinc-800/30 border border-white/5">
                                    <div className="flex justify-between items-center mb-6">
                                      <div>
                                        <h4 className="font-black uppercase tracking-widest text-xs">{pf.form_title}</h4>
                                        {pf.progress !== undefined && (
                                          <p className="text-[10px] text-zinc-500 mt-1">{pf.progress}% preenchido</p>
                                        )}
                                      </div>
                                      {!isSubmitted && (
                                        <button 
                                          onClick={() => {
                                            setEditingForm(pf);
                                            setFormData(data);
                                          }}
                                          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                                            hasData ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-400 hover:text-blue-300'
                                          }`}
                                        >
                                          <Pencil size={12} />
                                          {hasData ? 'Editar Respostas' : 'Preencher Agora'}
                                        </button>
                                      )}
                                      {isSubmitted && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                          <Check size={12} /> Enviado
                                        </span>
                                      )}
                                    </div>
                                    
                                    {hasData && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {fields.map((field: any, idx: number) => (
                                          <div key={field.id || `field-${idx}`} className="space-y-1">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{field.label}</p>
                                            <p className="text-sm font-bold text-white">{String(data[field.id] || '-')}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Documents Section */}
                        <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-10 backdrop-blur-xl">
                          <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                              <Upload className="text-emerald-400" />
                              Envio de Documentação
                            </h2>
                            {(() => {
                              const count = fullProcess.documents?.length || 0;
                              const remaining = MAX_DOCS - count;
                              return (
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                                  remaining === 0 ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {count}/{MAX_DOCS} documentos
                                </span>
                              );
                            })()}
                          </div>
                          {(fullProcess.documents?.length || 0) >= MAX_DOCS && (
                            <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                              Limite de {MAX_DOCS} documentos atingido. Fale com seu consultor caso precise substituir algum arquivo.
                            </div>
                          )}
                          <p className="text-[10px] text-zinc-500 font-bold mb-6">
                            Formatos aceitos: JPEG, PNG, WEBP, GIF, PDF &nbsp;·&nbsp; Tamanho máximo: {MAX_DOC_SIZE_MB} MB por arquivo
                          </p>
                          <div className="space-y-4">
                            {/* Required Docs from Visa Type */}
                            {fullProcess.required_docs && (typeof fullProcess.required_docs === 'string' ? JSON.parse(fullProcess.required_docs) : fullProcess.required_docs).map((docName: string, idx: number) => {
                              const uploadedDoc = fullProcess.documents?.find((d: any) => d.name === docName);
                              return (
                                <div key={docName || `doc-${idx}`} className="flex items-center justify-between p-6 bg-zinc-800/30 rounded-3xl border border-white/5">
                                  <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${uploadedDoc ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                      <FileText size={20} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold">{docName}</p>
                                      {uploadedDoc && (
                                        <p className="text-[10px] text-zinc-500 font-medium">Enviado em {new Date(uploadedDoc.uploaded_at).toLocaleDateString()}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    {uploadedDoc ? (
                                      <div className="flex items-center gap-3">
                                        <span className={`text-[10px] uppercase font-black px-3 py-1 rounded-lg ${
                                          uploadedDoc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 
                                          uploadedDoc.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 
                                          'bg-blue-500/10 text-blue-400'
                                        }`}>
                                          {uploadedDoc.status === 'uploaded' ? 'Em Análise' : 
                                           uploadedDoc.status === 'approved' ? 'Aprovado' : 'Recusado'}
                                        </span>
                                        <button 
                                          onClick={() => window.open(resolveFileUrl(uploadedDoc.url), '_blank')}
                                          className="text-xs font-black hover:text-emerald-400 transition-colors"
                                        >
                                          VER
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <input 
                                          type="file" 
                                          className="hidden" 
                                          id={`doc-${docName}`}
                                          accept={ACCEPT_ATTR}
                                          onChange={(e) => handleDocumentUpload(e, docName)}
                                        />
                                        <button 
                                          onClick={() => document.getElementById(`doc-${docName}`)?.click()}
                                          disabled={uploadingDoc === docName || (fullProcess.documents?.length || 0) >= MAX_DOCS}
                                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          {uploadingDoc === docName ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                          Enviar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {/* Upload de documento adicional livre */}
                            {(fullProcess.documents?.length || 0) < MAX_DOCS && (
                            <div className="mt-6 pt-6 border-t border-white/5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Enviar Documento Adicional</p>
                              <div className="flex gap-3 items-center">
                                <input
                                  type="text"
                                  placeholder="Nome do documento..."
                                  value={extraDocName}
                                  onChange={(e) => setExtraDocName(e.target.value)}
                                  className="flex-1 bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-emerald-500"
                                />
                                <input
                                  type="file"
                                  className="hidden"
                                  ref={extraDocInputRef}
                                  accept={ACCEPT_ATTR}
                                  onChange={(e) => {
                                    if (extraDocName.trim()) handleDocumentUpload(e, extraDocName.trim());
                                    else toast.error('Informe o nome do documento antes de enviar.');
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (!extraDocName.trim()) { toast.error('Informe o nome do documento.'); return; }
                                    extraDocInputRef.current?.click();
                                  }}
                                  disabled={!!uploadingDoc}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                  {uploadingDoc ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                  Enviar
                                </button>
                              </div>
                            </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Other Processes if any */}
              {processes.length > 1 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-black tracking-tighter">Outros Processos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {processes.slice(1).map((p, idx) => (
                      <div key={p.id || `process-${idx}`} className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
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
                   latestProcess.status === 'waiting_payment' ? (latestProcess.payment_status === 'proof_received' ? 'Aguardar Validação' : 'Confirmar Pagamento') :
                   latestProcess.status === 'payment_confirmed' ? 'Enviar Documentos' :
                   (latestProcess.status === 'analyzing' && latestProcess.internal_status === 'documents_requested') ? 'Preencher e Enviar Documentos' :
                   latestProcess.status === 'analyzing' ? 'Revisão de Perfil' : 
                   latestProcess.status === 'final_phase' ? 'Fase Final' :
                   latestProcess.status === 'completed' ? 'Visto Aprovado!' : 'Acompanhar Processo'}
                </h3>
                <p className="text-black/70 text-sm font-bold leading-relaxed mb-8">
                  {latestProcess.status === 'waiting_payment' 
                    ? (latestProcess.payment_status === 'proof_received' 
                        ? 'Seu comprovante foi enviado e está em análise por um consultor. Você será notificado assim que for validado.'
                        : 'Para dar continuidade ao seu processo, por favor anexe o comprovante de pagamento do seu plano.')
                    : latestProcess.status === 'payment_confirmed' 
                    ? 'Seu pagamento foi confirmado! Agora você pode preencher os formulários e enviar os documentos necessários.'
                    : (latestProcess.status === 'analyzing' && latestProcess.internal_status === 'documents_requested')
                    ? 'Seu consultor liberou esta etapa. Preencha os formulários abaixo e envie os documentos solicitados para continuar.'
                    : latestProcess.status === 'analyzing' 
                    ? 'Nossos especialistas estão analisando seu perfil e documentos. Fique atento ao chat para qualquer dúvida.'
                    : latestProcess.status === 'final_phase'
                    ? 'Estamos na fase final do seu processo. Em breve teremos novidades sobre a submissão.'
                    : latestProcess.status === 'completed'
                    ? 'Parabéns! Seu visto foi aprovado com sucesso. Verifique os detalhes na seção de documentos.'
                    : 'Acompanhe as atualizações aqui na plataforma ou fale com seu consultor.'}
                </p>
                
                {latestProcess.status === 'waiting_payment' && latestProcess.payment_status !== 'proof_received' ? (
                  <>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleUploadProof}
                      accept="image/*,.pdf"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Anexar Comprovante
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    {showDetails ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                    <ArrowUpRight size={16} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Consultor Responsável */}
              {(fullProcess?.consultant_name) && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
                  <h3 className="text-xl font-black tracking-tighter mb-4 flex items-center gap-2">
                    <UserIcon className="text-emerald-400" size={18} />
                    Seu Consultor
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg">
                      {fullProcess.consultant_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-sm">{fullProcess.consultant_name}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Consultor Responsável</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulários Vinculados com Progresso */}
              {isPaymentConfirmed && fullProcess?.process_forms && fullProcess.process_forms.length > 0 && (
                <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
                  <h3 className="text-xl font-black tracking-tighter mb-6 flex items-center gap-2">
                    <FileText className="text-emerald-400" size={18} />
                    Formulários
                  </h3>
                  <div className="space-y-4">
                    {fullProcess.process_forms.map((pf: any) => (
                      <div key={pf.id} className="p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-sm truncate">{pf.form_title}</p>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                            pf.response_status === 'submitted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : pf.response_status === 'in_progress'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-white/5 text-zinc-500'
                          }`}>
                            {pf.response_status === 'submitted' ? '✓' : pf.response_status === 'in_progress' ? '…' : '○'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pf.progress || 0}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-zinc-500">{pf.progress || 0}%</span>
                        </div>
                        {pf.response_status !== 'submitted' && (
                          <button
                            onClick={() => {
                              setEditingForm(pf);
                              setFormData(pf.response_data || {});
                            }}
                            className="mt-3 w-full text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            Preencher Agora →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support Card */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 backdrop-blur-xl">
                <h3 className="text-xl font-black tracking-tighter mb-6 flex items-center gap-2">
                  <MessageSquare className="text-emerald-400" />
                  Suporte Korus
                </h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-8">
                  Dúvidas sobre o processo? Fale com seu consultor dedicado agora mesmo.
                </p>
                <button 
                  onClick={() => setShowChat(true)}
                  className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all"
                >
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
                  <p className={`text-sm font-black ${latestProcess.status === 'payment_confirmed' || latestProcess.status === 'analyzing' || latestProcess.status === 'completed' ? 'text-emerald-400' : latestProcess.payment_status === 'proof_received' ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {latestProcess.status === 'payment_confirmed' || latestProcess.status === 'analyzing' || latestProcess.status === 'completed' ? 'Confirmado' : latestProcess.payment_status === 'proof_received' ? 'Em Análise' : 'Pendente'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Chat Modal */}
        <AnimatePresence>
          {showChat && (
            <div 
              onClick={() => setShowChat(false)}
              className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-zinc-900 w-full sm:max-w-md h-[80vh] sm:h-[500px] rounded-t-[32px] sm:rounded-[40px] border-t sm:border border-white/10 flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <MessageSquare className="text-emerald-400" size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">Suporte Korus</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Consultor Dedicado</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowChat(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-white group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Fechar</span>
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {messages.length > 0 ? (
                    messages.map((msg: any, idx: number) => (
                      <div key={msg.id || `msg-${idx}`} className={`flex flex-col ${msg.sender_id === latestProcess?.client_id ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium leading-relaxed ${
                          msg.sender_id === latestProcess?.client_id 
                            ? 'bg-emerald-500 text-black rounded-tr-none font-bold' 
                            : 'bg-zinc-800 text-white rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-tighter mt-1 px-1">
                          {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare className="text-zinc-600" size={32} />
                      </div>
                      <p className="text-zinc-500 text-sm font-bold">Inicie uma conversa com seu consultor.</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 sm:p-6 bg-zinc-800/50 border-t border-white/5">
                  <form onSubmit={sendMessage} className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Sua mensagem..." 
                      className="flex-1 px-5 py-4 bg-zinc-900 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-white"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={!chatMessage.trim()}
                      className="bg-emerald-500 text-black p-4 rounded-2xl hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Form Edit Modal */}
        <AnimatePresence>
          {editingForm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 w-full max-w-2xl rounded-[40px] border border-white/10 overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-800/50">
                  <div>
                    <h3 className="text-xl font-black tracking-tight uppercase">{editingForm.form_title}</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Preencha as informações solicitadas</p>
                  </div>
                  <button 
                    onClick={() => setEditingForm(null)}
                    className="p-3 hover:bg-white/5 rounded-2xl transition-all text-zinc-500 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleFormResponseSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(typeof editingForm.form_fields === 'string' ? JSON.parse(editingForm.form_fields) : editingForm.form_fields).map((field: any, idx: number) => (
                      <div key={field.id || `editfield-${idx}`} className="space-y-2">
                        <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === 'select' ? (
                          <select
                            required={field.required}
                            className="w-full px-5 py-4 bg-zinc-800 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-white appearance-none"
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          >
                            <option value="">Selecione...</option>
                            {field.options.map((opt: string, idx: number) => (
                              <option key={opt || `opt-${idx}`} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            required={field.required}
                            className="w-full px-5 py-4 bg-zinc-800 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-white"
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        ) : (
                          <input
                            type="text"
                            required={field.required}
                            className="w-full px-5 py-4 bg-zinc-800 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm text-white"
                            placeholder={`Digite ${field.label.toLowerCase()}...`}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setEditingForm(null)}
                      className="flex-1 px-8 py-4 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-8 py-4 bg-emerald-500 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      Salvar Respostas
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
