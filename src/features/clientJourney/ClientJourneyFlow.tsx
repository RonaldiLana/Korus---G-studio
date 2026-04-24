import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home, LogOut, LayoutDashboard, User as UserIcon, Globe, Zap } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { ClientDestinationSelection } from './ClientDestinationSelection';
import { DestinationMapIntro } from './DestinationMapIntro';
import { DestinationProcessIntro } from './DestinationProcessIntro';
import { ClientPreForm } from './ClientPreForm';
import { ConsultingPlanSelection } from './ConsultingPlanSelection';
import { ClientPaymentStep } from './ClientPaymentStep';
import { ClientProcessDashboard } from './ClientProcessDashboard';
import { User, Process } from '../../types';

type JourneyStep = 
  | 'destination' 
  | 'map_intro' 
  | 'process_intro' 
  | 'pre_form' 
  | 'plan_selection' 
  | 'payment' 
  | 'dashboard';

interface Props {
  user: User;
  onLogout: () => void;
  processes: Process[];
  onRefreshProcesses: () => void;
  agencyName?: string;
  agencyLogo?: string;
  destinations?: any[];
  preFormQuestions?: any[];
  plans?: any[];
  formFields?: any[];
  visaTypes?: any[];
}

export const ClientJourneyFlow: React.FC<Props> = ({ 
  user, 
  onLogout, 
  processes, 
  onRefreshProcesses,
  agencyName,
  agencyLogo,
  destinations,
  preFormQuestions,
  plans,
  formFields,
  visaTypes
}) => {
  const API_URL =
    import.meta.env.VITE_API_URL?.trim() ||
    'https://korus-backend-a55k.onrender.com';
  console.log('[BUILD] ClientJourneyFlow API_URL =', API_URL, '| user:', user?.id, user?.email);
  const [currentStep, setCurrentStep] = useState<JourneyStep>(processes.length > 0 ? 'dashboard' : 'destination');
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [formData, setFormData] = useState<any>(null);
  const [agencyCustomForms, setAgencyCustomForms] = useState<any[]>([]);

  useEffect(() => {
    if (user?.agency_id) {
      fetch(`${API_URL}/api/forms?agency_id=${user.agency_id}&active_only=true`)
        .then(r => r.json())
        .then(data => setAgencyCustomForms(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [user?.agency_id]);

  // Update step if processes change (e.g. after creation)
  useEffect(() => {
    if (processes.length > 0 && currentStep !== 'dashboard') {
      setCurrentStep('dashboard');
    }
  }, [processes.length]);

  const handleDestinationSelect = (destination: any) => {
    setSelectedDestination(destination);
    setCurrentStep('map_intro');
  };

  const handleMapComplete = () => {
    setCurrentStep('process_intro');
  };

  const handleProcessStart = () => {
    setCurrentStep('pre_form');
  };

  const handlePreFormComplete = (data: any) => {
    setFormData(data);
    setCurrentStep('plan_selection');
  };

  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    setCurrentStep('payment');
  };

  const handlePaymentComplete = async () => {
    try {
      if (!user?.id || !user?.agency_id) {
        console.error('Dados inválidos:', user);
        return;
      }
      const payload: any = {
        user_id: Number(user.id),
        agency_id: Number(user.agency_id)
      };
      if (selectedDestination?.id) payload.destination_id = selectedDestination.id;
      if (selectedPlan?.id) payload.plan_id = selectedPlan.id;
      if (formData?.visaTypeId) payload.visa_type_id = formData.visaTypeId;
      if (formData?.travelDate) payload.travel_date = formData.travelDate;
      if (formData?.dependents) payload.dependents = formData.dependents;
      payload.form_responses = {
        ...formData?.dynamicResponses,
        fullName: formData?.fullName,
        phone: formData?.phone,
        email: formData?.email,
        city: formData?.city,
        hasPassport: formData?.hasPassport,
        hasVisaDenied: formData?.hasVisaDenied,
        travelParty: formData?.travelParty,
        travelGoal: formData?.travelGoal,
        dependentLevel: formData?.dependentLevel
      };
      if (formData?.customFormResponses) {
        payload.custom_form_responses = formData.customFormResponses;
      }
      console.log('PAYLOAD:', payload);
      const response = await fetch(`${API_URL}/api/processes/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('STATUS:', response.status);
      if (response.ok) {
        toast.success('Processo iniciado com sucesso!');
        onRefreshProcesses();
        setCurrentStep('dashboard');
      } else {
        toast.error('Erro ao iniciar processo. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao iniciar processo:', error);
      toast.error('Erro ao iniciar processo. Tente novamente.');
    }
  };

  const resetJourney = () => {
    setSelectedDestination(null);
    setSelectedPlan(null);
    setFormData(null);
    setCurrentStep('destination');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Client Navbar */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              {agencyLogo ? (
                <img 
                  src={agencyLogo} 
                  alt={agencyName} 
                  className="h-8 w-auto object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center text-black font-black text-xs">
                  {agencyName?.charAt(0) || 'K'}
                </div>
              )}
              <span className="font-black tracking-tighter text-xl brand-text-gradient uppercase">
                {agencyName || 'KORUS'}
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <button 
                onClick={resetJourney}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  currentStep === 'destination' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Home size={14} />
                Início
              </button>
              <button 
                onClick={() => setCurrentStep('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  currentStep === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <LayoutDashboard size={14} />
                Meu Processo
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5">
              <div className="w-8 h-8 brand-gradient rounded-full flex items-center justify-center text-black font-black text-xs">
                {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-white leading-none mb-1">{user.name}</p>
                <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest leading-none">Cliente Premium</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-3 rounded-2xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          {currentStep === 'destination' && (
            <motion.div
              key="destination"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ClientDestinationSelection 
                onSelect={handleDestinationSelect} 
                destinations={destinations}
              />
            </motion.div>
          )}

          {currentStep === 'map_intro' && (
            <motion.div
              key="map_intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DestinationMapIntro 
                destination={selectedDestination} 
                onComplete={handleMapComplete} 
              />
            </motion.div>
          )}

          {currentStep === 'process_intro' && (
            <motion.div
              key="process_intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DestinationProcessIntro 
                destination={selectedDestination} 
                onStart={handleProcessStart} 
              />
            </motion.div>
          )}

          {currentStep === 'pre_form' && (
            <motion.div
              key="pre_form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ClientPreForm 
                onComplete={handlePreFormComplete} 
                preFormQuestions={preFormQuestions}
                formFields={formFields}
                customForms={agencyCustomForms.filter((f: any) => !f.destination_id || f.destination_id === selectedDestination?.id)}
                destinationId={selectedDestination?.id}
                visaTypes={visaTypes}
              />
            </motion.div>
          )}

          {currentStep === 'plan_selection' && (
            <motion.div
              key="plan_selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ConsultingPlanSelection 
                onSelect={handlePlanSelect} 
                plans={plans}
              />
            </motion.div>
          )}

          {currentStep === 'payment' && selectedDestination && selectedPlan && (
            <motion.div
              key="payment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ClientPaymentStep 
                destination={selectedDestination} 
                plan={selectedPlan} 
                onComplete={handlePaymentComplete} 
              />
            </motion.div>
          )}

          {currentStep === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ClientProcessDashboard 
                destination={selectedDestination} 
                plan={selectedPlan} 
                processes={processes}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
