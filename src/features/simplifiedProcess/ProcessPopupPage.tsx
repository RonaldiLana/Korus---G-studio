import React, { useState, useEffect } from 'react';
import { SimplifiedProcessModal } from './SimplifiedProcessModal';
import { Destination, VisaType, Plan, User } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

export const ProcessPopupPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [agencyId, setAgencyId] = useState<number>(0);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Recupera dados da sessão
    const sessionUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const sessionToken = sessionStorage.getItem('token') || '';
    const sessionAgency = sessionStorage.getItem('selectedAgency') || '';

    if (!sessionUser.id || !sessionToken) {
      window.close();
      return;
    }

    setUser(sessionUser);
    setToken(sessionToken);
    setAgencyId(Number(sessionAgency) || sessionUser.agency_id || 0);

    // Carrega dados necessários
    const fetchData = async () => {
      try {
        const [destRes, visaRes, plansRes] = await Promise.all([
          fetch(`${API_URL}/api/destinations?agency_id=${Number(sessionAgency) || sessionUser.agency_id}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
          fetch(`${API_URL}/api/visa-types?agency_id=${Number(sessionAgency) || sessionUser.agency_id}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
          fetch(`${API_URL}/api/plans?agency_id=${Number(sessionAgency) || sessionUser.agency_id}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
        ]);

        const destData = await destRes.json();
        const visaData = await visaRes.json();
        const plansData = await plansRes.json();

        setDestinations(destData);
        setVisaTypes(visaData);
        setPlans(plansData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">⏳</div>
          <p className="text-white mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !token || !agencyId) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Sessão inválida. Feche esta janela.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      <SimplifiedProcessModal
        agencyId={agencyId}
        token={token}
        destinations={destinations}
        visaTypes={visaTypes}
        plans={plans}
        createdByUserId={user.id}
        onClose={() => window.close()}
        onSuccess={(processId) => {
          console.log('Processo criado:', processId);
          window.close();
        }}
      />
    </div>
  );
};
