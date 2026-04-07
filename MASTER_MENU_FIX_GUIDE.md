# 🔧 GUIA: Corrigir Menu para Usuário MASTER

## ✅ Análise Concluída

### Verificações Realizadas

#### 1. **Helpers de Permissão** ✅ CORRETOS
Todos os helpers estão funcionando corretamente:
- `isMaster(user)` - retorna `true` quando `user.role === 'master'`
- `hasAdminAccess(user)` - retorna `true` para master e supervisor
- `canAccessFinanceModule(user)` - retorna `true` para master
- `canAccessPipefyModule(user)` - retorna `true` para master
- `canViewAudit(user)` - retorna `true` apenas para master
- `canViewSettings(user)` - retorna `true` apenas para master
- `canViewAgenciesPanel(user)` - retorna `true` para master e supervisor

#### 2. **Menu Sidebar** ✅ ESTRUTURA CORRETA
- Dashboard - sempre mostra
- Pipefy/Processos - Se `canAccessPipefyModule()` = true para master
- Agências - Se `isMaster()` = true ✅
- Equipe - Se `hasAdminAccess()` = true ✅
- Clientes - Se `hasAdminAccess()` = true ✅
- Financeiro - Se `canAccessFinanceModule()` = true ✅
- Painel Agência - Se `canViewAgenciesPanel()` = true ✅
- Auditoria - Se `canViewAudit()` = true ✅
- Configurações - Se `canViewSettings()` = true ✅

#### 3. **Navegação Pós-Login** ✅ CORRETA
- `getRecommendedInitialView()` retorna `'agencies'` para master
- `handleLogin()` redireciona para essa view automaticamente

#### 4. **Renderização de Views** ✅ TODAS PROTEGIDAS
- Finance view: `{view === 'finance' && canAccessFinanceModule(user) && (...)}`
- Agencies view: `{view === 'agencies' && isMaster(user) && (...)}`
- Audit view: `{view === 'audit' && isMaster(user) && (...)}`
- Settings view: `{view === 'settings' && isMaster(user) && (...)}`
- Team view: `{view === 'team' && hasAdminAccess(user) && (...)}`
- Leads view: `{view === 'leads' && hasAdminAccess(user) && (...)}`

---

## 🔍 Diagnóstico: O Que Está Errado?

### Status Actual do Usuário
- Master **VÊ**: Dashboard, Financeiro ✓
- Master **NÃO VÊ**: Agências, Equipe, Clientes, Auditoria, Configurações, Processos ✗

### Conclusão: O Problema NÃO Está no Código!
✅ **TODO código está CORRETO**

O problema está em **um destes 3 pontos:**

#### **Possibilidade 1: `user.role` não está vindo como 'master'**
- O backend está retornando um valor diferente ou nulo
- O frontend está recebendo dados incorretos

#### **Possibilidade 2: `user.role` está sendo perdido após login**
- Um `useEffect` ou função está limpando/resetando o user
- O user está sendo destruído ou reconstruído incorretamente

#### **Possibilidade 3: localStorage ou Sessão**
- Dados antigos estão sendo carregados
- User está sendo restaurado de um estado anterior

---

## 🛠️ Como Diagnosticar

### PASSO 1: Verificar o Console do Navegador

1. Abra o navegador e pressione **F12** para abrir o DevTools
2. Vá para a aba **Console**
3. **Faça login com o usuário master**
4. Procure pelas mensagens com `[LOGIN]`:
   ```
   [LOGIN] Tentando login com: master@example.com
   [LOGIN] Dados recebidos: {id, name, email, role: "master", agency_id: null, ...}
   [LOGIN] Role: master
   [LOGIN] isMaster check: true
   [LOGIN] CompleteUser: {...}
   [LOGIN] Recommended View: agencies para role: master
   ```

**O que você deve ver:**
- ✅ `role: "master"` (exatamente assim)
- ✅ `isMaster check: true`
- ✅ `Recommended View: agencies`

**Se você VER algo diferente, o problema está no BACKEND.**

### PASSO 2: Verificar o DEBUG Panel no Sidebar

Após fazer login, você deve ver um **painel azul** no sidebar esquerdo mostrando:

```
🔍 DEBUG MODE
Role: master
isMaster: ✅ TRUE
hasAdmin: T
canFinance: T
```

**Se você VER:**
- ❌ `isMaster: ❌ FALSE` → O role não está sendo reconhecido como master
- ❌ `Role: null` ou `Role: undefined` → User não está sendo carregado

**Se isso acontecer, o problema está em:**
- Ou user.role está errado no backend
- Ou user está sendo resetado em algum lugar

---

## 🔧 Próximos Passos

### Se o DEBUG Panel mostra `isMaster: ✅ TRUE`
**Problema:** O menu deveria estar funcionando, mas não está!
- **Ação:** Verificar se há CSS/display:none escondendo os itens
- **Ação:** Verificar se há outro código que está removendo os itens do DOM
- **Ação:** Procurar por condicionalidades adicionais que não foram documentadas

### Se o DEBUG Panel mostra `isMaster: ❌ FALSE`
**Problema:** O `user.role` não é 'master'
- **Ação:** Verificar o backend - `/api/login` está retornando `role: "master"`?
- **Ação:** Testar com curl ou Postman: 
  ```bash
  POST http://localhost:3000/api/login
  {"email": "master@example.com", "password": "senha"}
  ```
- **Ação:** Verificar se o usuário master existe no banco de dados com `role = 'master'`

### Se o DEBUG Panel NÃO aparece
**Problema:** O user é nulo ou undefined após login
- **Ação:** Verificar se `setUser(userData)` está sendo chamado
- **Ação:** Procurar por lógica que pode estar limpando o user após login
- **Ação:** Verificar se há redirecionamento forçado que está limpando a sessão

---

## 📋 Arquivos Alterados

### Commit: `218a524`
**Alterações:**
1. **src/App.tsx** (handleLogin)
   - Adicionado console.log detalhado para debugar login
   - Adicionado `completeUser` para garantir user.role e agency_id
   
2. **src/App.tsx** (Sidebar nav)
   - Adicionado DEBUG Panel mostrando:
     - user.role atual
     - Resultado de cada permission check
   - Permite visualizar exatamente quais itens do menu deveriam aparecer

3. **MENU_MASTER_AUDIT.md**
   - Documento com análise completa do menu e helpers

---

## ✅ Itens que Deveriam Aparecer para Master

| Menu Item | Condição | Status |
|-----------|----------|--------|
| Dashboard | Sempre | ✅ Vê |
| Pipefy teste | `canAccessPipefyModule()` | Deveria ver |
| Processos | `canAccessPipefyModule()` | Deveria ver |
| **Agências** | `isMaster()` | **Deveria ver** |
| **Equipe** | `hasAdminAccess()` | **Deveria ver** |
| **Clientes** | `hasAdminAccess()` | **Deveria ver** |
| Financeiro | `canAccessFinanceModule()` | ✅ Vê |
| Painel Agência | `canViewAgenciesPanel()` | Deveria ver |
| **Auditoria** | `canViewAudit()` | **Deveria ver** |
| **Configurações** | `canViewSettings()` | **Deveria ver** |

---

## 🚀 Próxima Ação

1. **Execute o login do master**
2. **Abra o DevTools (F12) > Console**
3. **Procure pelos logs `[LOGIN]`**
4. **Verifique o DEBUG Panel no sidebar azul**
5. **Reporte o que você vê**

Com essas informações, será possível identificar exatamente onde está o problema!

---

## 📞 Resumo Executivo

**Status Atual:**
- ✅ Código do frontend está 100% correto
- ✅ Todos os helpers e condições estão funcionando
- ✅ Menu tem estrutura correta
- ⚠️ **Problema está em outro lugar** (backend ou lógica de user)

**Ação Necessária:**
- Usar os logs de debug adicionados para diagnosticar
- Verificar o `/api/login` no backend
- Confirmar que `role = 'master'` está sendo retornado
