// PrototypalTest to verify isMaster logic works correctly with backend response
const user = {
  id: 1,
  email: 'master@korus.com',
  name: 'Master User',
  role: 'master',
  agency_id: null,
  phone: null,
  created_at: '2026-04-04T06:51:19.906Z',
  agency_modules: null
};

// Test helpers as they are in App.tsx
const isMaster = (user) => {
  return user?.role === 'master';
};

const hasAdminAccess = (user) => {
  return user?.role === 'master' || user?.role === 'supervisor';
};

const canAccessFinanceModule = (user) => {
  if (!user) return false;
  if (isMaster(user)) return true;
  if (user.role === 'supervisor' || user.role === 'gerente_financeiro') return true;
  return false;
};

const canViewAudit = (user) => {
  return isMaster(user);
};

const canViewSettings = (user) => {
  return isMaster(user);
};

const canViewAgenciesPanel = (user) => {
  return isMaster(user) || user?.role === 'supervisor';
};

const canAccessPipefyModule = (user) => {
  if (!user) return false;
  if (isMaster(user)) return true;
  return false;
};

// Test
console.log('🧪 Testando permissões do master:\n');
console.log('User:', JSON.stringify(user, null, 2));
console.log('\n✅ Resultados:');
console.log(`isMaster(): ${isMaster(user)} (esperado: true)`);
console.log(`hasAdminAccess(): ${hasAdminAccess(user)} (esperado: true)`);
console.log(`canAccessFinanceModule(): ${canAccessFinanceModule(user)} (esperado: true)`);
console.log(`canViewAudit(): ${canViewAudit(user)} (esperado: true)`);
console.log(`canViewSettings(): ${canViewSettings(user)} (esperado: true)`);
console.log(`canViewAgenciesPanel(): ${canViewAgenciesPanel(user)} (esperado: true)`);
console.log(`canAccessPipefyModule(): ${canAccessPipefyModule(user)} (esperado: true)`);

// Summary
console.log('\n📊 Summary:');
const allTrue = [
  isMaster(user),
  hasAdminAccess(user),
  canAccessFinanceModule(user),
  canViewAudit(user),
  canViewSettings(user),
  canViewAgenciesPanel(user),
  canAccessPipefyModule(user)
].every(v => v === true);

if (allTrue) {
  console.log('✅ Todas as permissões do master estão ATIVAS!');
} else {
  console.log('❌ PROBLEMA: Algumas permissões não estão ativas!');
}
