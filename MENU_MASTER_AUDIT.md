# Auditoria: Menu e Views Disponíveis para MASTER

## Status Atual do Código

### ✅ Helpers de Permissão (CORRETOS)
Todos os helpers estão codificados corretamente linha 104-228:

```typescript
const isMaster = (user?: User | null): boolean => {
  return user?.role === 'master'; ✅ CORRETO
};

const hasAdminAccess = (user?: User | null): boolean => {
  return user?.role === 'master' || user?.role === 'supervisor'; ✅ CORRETO
};

const canAccessFinanceModule = (user?: User | null): boolean => {
  if (!user) return false;
  if (isMaster(user)) return true; ✅ Master tem acesso
  ... // Isso retorna true quando isMaster(user) = true
};

const canAccessPipefyModule = (user?: User | null): boolean => {
  if (!user) return false;
  if (isMaster(user)) return true; ✅ Master tem acesso
  ...
};

const canViewAudit = (user?: User | null): boolean => {
  return isMaster(user); ✅ CORRETO
};

const canViewSettings = (user?: User | null): boolean => {
  return isMaster(user); ✅ CORRETO
};

const canViewAgenciesPanel = (user?: User | null): boolean => {
  return isMaster(user) || user?.role === 'supervisor'; ✅ CORRETO
};
```

### ✅ Menu Sidebar (ESTRUTURA CORRETA)
Linhas 2315-2410, renderização condicional:

```typescript
<nav className="flex-1 space-y-2">
  // Menu Item 1: Dashboard (SEMPRE MOSTRA)
  <SidebarItem label="Dashboard" ... /> ✅

  // Menu Item 2: Pipefy (Se canAccessPipefyModule)
  {canAccessPipefyModule(user) && (
    <SidebarItem label="Pipefy teste" ... /> // Master deveria VER
  )}

  // Menu Item 3: Processos (Se canAccessPipefyModule) 
  {canAccessPipefyModule(user) && (
    <SidebarItem label="Processos" ... /> // Master deveria VER
  )}

  // Menu Item 4: Agências (Se isMaster)
  {isMaster(user) && (
    <SidebarItem label="Agências" view="agencies" /> // Master deveria VER ✅
  )}

  // Menu Item 5: Equipe (Se hasAdminAccess)
  {hasAdminAccess(user) && (
    <SidebarItem label="Equipe" view="team" /> // Master deveria VER ✅
  )}

  // Menu Item 6: Clientes (Se hasAdminAccess)
  {hasAdminAccess(user) && (
    <SidebarItem label="Clientes" view="leads" /> // Master deveria VER ✅
  )}

  // Menu Item 7: Financeiro (Se canAccessFinanceModule)
  {canAccessFinanceModule(user) && (
    <SidebarItem label="Financeiro" view="finance" /> // Master deveria VER ✅ (realmente vê!)
  )}

  // Menu Item 8: Painel Agência (Se canViewAgenciesPanel)
  {canViewAgenciesPanel(user) && (
    <SidebarItem label="Painel Agência" view="agency_panel" /> // Master deveria VER ✅
  )}

  // Menu Item 9: Auditoria (Se canViewAudit)
  {canViewAudit(user) && (
    <SidebarItem label="Auditoria" view="audit" /> // Master deveria VER ✅
  )}

  // Menu Item 10: Configurações (Se canViewSettings)
  {canViewSettings(user) && (
    <SidebarItem label="Configurações" view="settings" /> // Master deveria VER ✅
  )}
</nav>
```

### ⚠️ PROBLEMA IDENTIFICADO

Baseado no relato do usuário:
- Master VÊ: Dashboard, Financeiro
- Master NÃO VÊ: Agências, Equipe, Clientes, Auditoria, Configurações, Processos

**Possíveis Causas:**

1. **`user.role` não está sendo 'master'** - talvez venha como `null`, `undefined`, ou outro valor
2. **`isMaster(user)` está retornando FALSE** mesmo quando deveria ser true
3. **O user não está sendo definido corretamente após login** - reset em algum lugar

### ✅ Navegação Inicial (VERIFICADA)
Linha 238 - getRecommendedInitialView():
```typescript
if (isMaster(user)) {
  return 'agencies'; // Master deveria ir para agencies ✅ CORRETO
}
```

Linha 853 - handleLogin():
```typescript
setView(recommendedView); // Redireciona para 'agencies' ✅ CORRETO
```

### ✅ Renderização das Views (PROTEGIDAS CORRETAMENTE)
- Linha 2650: `{view === 'finance' && canAccessFinanceModule(user) && (` ✅
- Linha 2690: `{view === 'agencies' && isMaster(user) && (` ✅
- Linha 3076: `{view === 'audit' && isMaster(user) && (` ✅
- Linha 3164: `{view === 'settings' && isMaster(user) && (` ✅
- Linha 3350: `{view === 'agency_panel' && canViewAgenciesPanel(user) && (` ✅

\## Recomendação

O problema **NÃO está no código do menu ou nos helpers**. Tudo está codificado corretamente.

O problema está em um dos seguintes pontos:

### INVESTIGAÇÃO NECESSÁRIA:

1. **Logar o `user.role` após login**
   - No console do navegador após login, executar: `console.log(user)`
   - Verificar se `user.role === 'master'`

2. **Verificar o backend**
   - POST /api/login está retornando `user.role = 'master'`?
   - Usar curl ou Postman para testar a resposta do login

3. **Procurar por limpezas não documentadas**
   - Buscar por `setUser(null)` ou `setUser({})` que pode estar ocorrendo após o login
   - Verificar por `useEffect` que pode estar limpando o user

4. **Validar localStorage**
   - O user pode estar sendo carregado de localStorage com valores antigos
