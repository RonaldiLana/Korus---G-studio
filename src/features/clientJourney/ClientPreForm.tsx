import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, CheckCircle2, User, Phone, Mail, MapPin, Globe, Plane, Users, Target, ClipboardList, Briefcase, Heart, GraduationCap } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Globe,
  Plane,
  Users,
  Target,
  Briefcase,
  Heart,
  GraduationCap
};

interface Props {
  onComplete: (data: any) => void;
  preFormQuestions?: any[];
}

export const ClientPreForm: React.FC<Props> = ({ onComplete, preFormQuestions }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    hasPassport: '',
    hasVisaDenied: '',
    travelDate: '',
    travelParty: '',
    travelGoal: '',
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const displayGoals = preFormQuestions && preFormQuestions.length > 0 
    ? preFormQuestions 
    : [
        { id: 'turismo', label: 'Turismo', icon: 'Globe' },
        { id: 'estudo', label: 'Estudo', icon: 'Plane' },
        { id: 'negocios', label: 'Negócios', icon: 'Target' },
        { id: 'imigracao', label: 'Imigração', icon: 'Users' },
      ];

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else onComplete(formData);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Dados Pessoais</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Nome Completo"
                    className="w-full pl-12 pr-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-white"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="tel" 
                    placeholder="Telefone"
                    className="w-full pl-12 pr-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-white"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="email" 
                    placeholder="E-mail"
                    className="w-full pl-12 pr-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-white"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="relative group">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Cidade"
                    className="w-full pl-12 pr-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-white"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Já possui passaporte?</label>
                <div className="flex gap-2">
                  {['Sim', 'Não'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setFormData({ ...formData, hasPassport: opt })}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all border ${
                        formData.hasPassport === opt ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Já teve visto negado?</label>
                <div className="flex gap-2">
                  {['Sim', 'Não'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setFormData({ ...formData, hasVisaDenied: opt })}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all border ${
                        formData.hasVisaDenied === opt ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Pretende viajar quando?</label>
                <select 
                  className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-white appearance-none"
                  value={formData.travelDate}
                  onChange={e => setFormData({ ...formData, travelDate: e.target.value })}
                >
                  <option value="">Selecione um período</option>
                  <option value="imediato">Imediato (Próximos 3 meses)</option>
                  <option value="semestre">Este semestre</option>
                  <option value="ano">Próximo ano</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Vai sozinho ou acompanhado?</label>
                <div className="flex gap-2">
                  {['Sozinho', 'Acompanhado'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setFormData({ ...formData, travelParty: opt })}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all border ${
                        formData.travelParty === opt ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <label className="block text-xs font-black uppercase tracking-widest text-zinc-500 ml-1 text-center mb-4">Objetivo da Viagem</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {displayGoals.map(opt => {
                const Icon = ICON_MAP[opt.icon] || Globe;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setFormData({ ...formData, travelGoal: opt.id })}
                    className={`flex flex-col items-center justify-center p-6 rounded-3xl font-bold transition-all border gap-4 ${
                      formData.travelGoal === opt.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon size={32} />
                    <span className="text-sm">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-zinc-900/40 backdrop-blur-2xl rounded-[40px] border border-white/5 p-8 sm:p-12 relative z-10 shadow-2xl"
      >
        {/* Progress Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <ClipboardList className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter">Pré-formulário</h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Etapa {step} de {totalSteps}</p>
            </div>
          </div>
          <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full brand-gradient"
            />
          </div>
        </div>

        {/* Form Body */}
        <div className="min-h-[300px] mb-12">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-white/5">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:bg-white/5'
            }`}
          >
            <ArrowLeft size={18} />
            Voltar
          </button>
          <button
            onClick={handleNext}
            className="brand-gradient text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all group"
          >
            {step === totalSteps ? 'Finalizar Análise' : 'Próxima Etapa'}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
