import React from 'react';
import { MapPin, FileText, Download, Clock, CheckCircle2, AlertCircle, Save, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Use runtime detection: if served from api.korus.me, use that; otherwise use VITE_API_URL
const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (typeof window !== 'undefined' && window.location.hostname.includes('api.korus.me')
    ? 'https://api.korus.me'
    : 'https://api.korus.me');

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

interface TrackingForm {
  pf_id: number;
  form_id: number;
  title: string;
  fields: FormField[];
  response_id: number | null;
  response_data: Record<string, any>;
  response_status: 'open' | 'in_progress' | 'submitted' | 'locked';
  updated_at: string | null;
}

interface TrackingData {
  id: number;
  status: string;
  internal_status: string;
  process_type: string;
  created_at: string;
  tracking_token: string;
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
  forms: TrackingForm[];
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
  // Always use production API URL to avoid localhost redirect issues
  return `https://api.korus.me${url}`;
}

interface DocumentUploadSectionProps {
  processId: number;
  trackingToken: string;
  onUploadSuccess?: () => void;
}

const DocumentUploadSection: React.FC<DocumentUploadSectionProps> = ({
  processId,
  trackingToken,
  onUploadSuccess,
}) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState<{ fileName: string; message: string } | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected].slice(0, 5)); // Máximo 5 arquivos
    setUploadError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadError('Selecione pelo menos um arquivo');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);

        const response = await fetch(`${API_URL}/api/documents/track/${trackingToken}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao enviar documento');
        }

        const result = await response.json();
        setUploadSuccess({ fileName: file.name, message: result.message });
        setTimeout(() => setUploadSuccess(null), 4000);
        onUploadSuccess?.();
      }

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar documentação');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
    >
      <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
        <Upload size={11} />
        Enviar Documentação
      </h2>

      <p className="text-xs text-gray-400">
        Envie seus documentos aqui (máximo 5 arquivos, PDF ou imagens). A agência irá revisar e aprovar.
      </p>

      {/* Área de Drop/Upload */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-8 text-center cursor-pointer transition-all bg-emerald-500/5 hover:bg-emerald-500/10 group"
      >
        <div className="w-12 h-12 mx-auto bg-emerald-500/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-all">
          <Upload size={24} className="text-emerald-400" />
        </div>
        <p className="text-sm font-bold text-white mb-1">Clique para selecionar ou arraste arquivos</p>
        <p className="text-xs text-gray-500">PDF, PNG, JPG ou WEBP (máximo 5 MB por arquivo)</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Lista de Arquivos Selecionados */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-400">Arquivos selecionados ({files.length}/5)</p>
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg group hover:border-amber-500/30"
            >
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="flex items-center justify-center w-6 h-6 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Erro */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle size={14} />
            {uploadError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sucesso */}
      <AnimatePresence>
        {uploadSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 size={14} />
            <div>
              <p>✅ {uploadSuccess.fileName}</p>
              <p className="text-emerald-400/80">{uploadSuccess.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão de Envio */}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-black text-xs transition-all ${
          files.length > 0 && !uploading
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
        }`}
      >
        <Upload size={14} />
        {uploading ? 'Enviando...' : 'Enviar Documentação'}
      </button>
    </motion.div>
  );
};

interface FormRendererProps {
  form: TrackingForm;
  processId: number;
  onSubmitSuccess?: () => void;
}

const FormRenderer: React.FC<FormRendererProps> = ({ form, processId, onSubmitSuccess }) => {
  const [formData, setFormData] = React.useState<Record<string, any>>(form.response_data || {});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(form.response_status === 'submitted');

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/form-responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_id: processId,
          form_id: form.form_id,
          data: formData,
        }),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
        onSubmitSuccess?.();
      }
    } catch (err) {
      console.error('Erro ao salvar formulário:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filledFields = form.fields.filter((f) => formData[f.id]).length;
  const requiredFields = form.fields.filter((f) => f.required).length;
  const allRequiredFilled = form.fields.every((f) => !f.required || formData[f.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/30 border border-emerald-500/20 rounded-2xl p-5 space-y-4"
    >
      {/* Cabeçalho do Formulário */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-black text-white mb-1">{form.title}</h3>
          {!isMinimized && (
            <p className="text-xs text-gray-400">
              Progresso: {filledFields} de {form.fields.length} campos preenchidos
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            form.response_status === 'submitted'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : form.response_status === 'in_progress'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {form.response_status === 'submitted' ? '✅ Enviado' : form.response_status === 'in_progress' ? '⏳ Preenchendo' : '📝 Vazio'}
          </div>
          {form.response_status === 'submitted' && (
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              {isMinimized ? '▼' : '▲'}
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo do Formulário - Renderizado apenas se não está minimizado */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Barra de Progresso */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${(filledFields / form.fields.length) * 100}%` }}
              />
            </div>

            {/* Campos do Formulário */}
            <div className="space-y-3">
              {form.fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                    {field.label}
                    {field.required && <span className="text-red-400">*</span>}
                  </label>

                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.label}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.label}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={formData[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  )}

                  {field.type === 'select' && (
                    <select
                      value={formData[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="">Selecione uma opção</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt} className="bg-gray-900">
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      value={formData[field.id] || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.label}
                      rows={3}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Botão de Envio */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!allRequiredFilled || submitting}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-black text-xs transition-all ${
                  allRequiredFilled && !submitting
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Save size={14} />
                {submitting ? 'Enviando...' : 'Enviar Formulário'}
              </button>
            </div>

            {/* Mensagem de Sucesso */}
            <AnimatePresence>
              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-bold text-center"
                >
                  ✅ Formulário salvo com sucesso!
                </motion.div>
              )}
            </AnimatePresence>

            {!allRequiredFilled && requiredFields > 0 && (
              <p className="text-xs text-amber-400 text-center">
                Preencha os {requiredFields - form.fields.filter((f) => f.required && formData[f.id]).length} campo(s) obrigatório(s) restante(s)
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ClientTrackingPage: React.FC = () => {
  const [data, setData] = React.useState<TrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const tokenIdx = pathParts.indexOf('acompanhamento');
    const token = tokenIdx !== -1 ? pathParts[tokenIdx + 1] : null;
    const searchParams = new URLSearchParams(window.location.search);
    const agencyId = searchParams.get('agency');

    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const url = new URL(`${API_URL}/api/processes/track/${token}`, window.location.origin);
    if (agencyId) {
      url.searchParams.set('agency', agencyId);
    }

    console.log(`[ClientTrackingPage] Fetching from: ${url.toString()}`);
    console.log(`[ClientTrackingPage] window.location.origin: ${window.location.origin}`);
    console.log(`[ClientTrackingPage] API_URL: ${API_URL}`);

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) { 
          setNotFound(true);
          console.error(`[ClientTrackingPage] Erro ao carregar: ${res.status}`);
          return; 
        }
        const json = await res.json();
        setData(json);
      })
      .catch((err) => {
        setNotFound(true);
        console.error(`[ClientTrackingPage] Erro na requisição:`, err);
      })
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

        {/* Upload de Documentação do Cliente */}
        <DocumentUploadSection
          processId={data.id}
          trackingToken={data.tracking_token}
          onUploadSuccess={() => {
            console.log('✅ Documento enviado com sucesso');
          }}
        />

        {/* Formulários Vinculados */}
        {data.forms && data.forms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
          >
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              📋 Formulários a Preencher
            </h2>

            <div className="space-y-4">
              {data.forms.map((form, formIdx) => (
                <FormRenderer
                  key={form.form_id}
                  form={form}
                  processId={data.id}
                  onSubmitSuccess={() => {
                    // Aqui você poderia fazer um refresh dos dados
                    console.log('✅ Formulário enviado com sucesso');
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-600 pb-4">
          Powered by <span className="font-black text-gray-500">Korus</span> · Processo #{data.id}
        </div>
      </div>
    </div>
  );
};
