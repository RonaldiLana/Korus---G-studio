# 🚀 SETUP LOCAL - GUIA DE EXECUÇÃO

## ✅ VERIFICAÇÃO DE REQUISITOS

### Sistema
- **Status**: ✅ Detectado
- **Node.js**: v20.11.0 (requerido: 18+)
- **npm**: Disponível

### Dependências Instaladas
- ✅ 443 pacotes auditados
- ✅ Express 5.2.1
- ✅ PostgreSQL (pg 8.20.0)
- ✅ React 19.0.0
- ✅ TypeScript 5.7.2
- ✅ Vite 6.0.3
- ℹ️ 3 vulnerabilidades detectadas (1 moderate, 2 high)

### Arquivo .env
**Status**: ✅ Corrigido
- DATABASE_URL formatado corretamente
- PORT=3000 configurada
- NODE_ENV=development

## 📋 CHECKLIST ATUAL

```
[✅] Node.js 20+ instalado
[✅] npm dependencies instaladas (npm install --legacy-peer-deps)
[✅] .env corrigido (sem espaços extras)
[⚠️] PostgreSQL - NECESSÁRIO para rodagem local
[⚠️] Docker container não está rodando
[❌] Servidor ainda não iniciado (aguardando PostgreSQL)
```

## 🗄️ PROBLEMA ATUAL

**Erro**: `Error: read ECONNRESET`

**Causa**: A DATABASE_URL aponta para servidor PostgreSQL remoto (Render), mas:
- Credenciais podem estar inválidas
- Servidor remoto pode ter rejectado a conexão
- SSL pode ter problemas
- Servidor pode estar offline

**Solução**: Usar PostgreSQL local via Docker para desenvolvimento

## 🐳 SOLUÇÃO: SETUP COM DOCKER

### Opção 1: PostgreSQL via Docker (RECOMENDADO)

#### Passo 1: Instalar Docker
- Windows: https://www.docker.com/products/docker-desktop
- Após instalar, reiniciar computador

#### Passo 2: Iniciar PostgreSQL Container

```powershell
docker run --name postgres-korus `
  -e POSTGRES_USER=korus `
  -e POSTGRES_PASSWORD=korus123 `
  -e POSTGRES_DB=korusdb `
  -p 5432:5432 `
  -d postgres:15
```

Verificar se está rodando:
```powershell
docker ps | findstr postgres-korus
```

#### Passo 3: Confirmar .env está correto

```env
DATABASE_URL=postgresql://korus:korus123@localhost:5432/korusdb
PORT=3000
NODE_ENV=development
```

#### Passo 4: Rodar servidor

```powershell
npm run dev
```

**Output esperado:**
```
🔄 Inicializando banco de dados...
📦 Executando 19 statements SQL...
✅ Banco inicializado com sucesso
[BOOT] Iniciando servidor...
[BOOT] ✓ Banco de dados conectado com sucesso
Server is running on port 3000
http://localhost:3000
```

#### Passo 5: Acessar aplicação
```
http://localhost:3000
```

---

### Opção 2: PostgreSQL Local (Manual Install)

#### Windows:
1. Download: https://www.postgresql.org/download/windows/
2. Instalar com usuário `korus`, senha `korus123`
3. Criar database `korusdb`
4. Atualizar .env com credenciais locais

#### Verificar conexão:
```powershell
psql -U korus -d korusdb -h localhost
```

---

## 🔍 TESTES PÓS-STARTUP

Após servidor rodar, testar endpoints:

### 1. Test Database Connection
```bash
curl http://localhost:3000/api/test-db
```

**Response esperado**:
```json
{
  "status": "ok",
  "users": [
    {
      "email": "master@korus.com",
      "role": "master"
    }
  ]
}
```

### 2. Frontend
```
http://localhost:3000
```

---

## 🛑 TROUBLESHOOTING

### Erro: "Porta 5432 já em uso"
```powershell
# Parar container existente
docker stop postgres-korus

# Remover container
docker rm postgres-korus

# Recriar
docker run --name postgres-korus ...
```

### Erro: "ECONNREFUSED"
- ✅ Verificar se Docker container está rodando: `docker ps`
- ✅ Verificar DATABASE_URL em .env
- ✅ Aguardar 5 segundos após iniciar container

### Erro: "ECONNRESET"
- ✅ Credenciais inválidas
- ✅ Servidor remoto (Render) tem problemas
- ✅ Usar PostgreSQL local em vez disso

### npm install com erro de peer dependencies
```powershell
npm install --legacy-peer-deps
```

### Limpar e reinstalar
```powershell
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install --legacy-peer-deps
```

---

## 📝 SCRIPTS DISPONÍVEIS

```bash
# Development (com hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run lint

# Database initialization (manual)
npm run db:init

# Preview build
npm run preview
```

---

## 🎯 ESTRUTURA DO PROJETO

```
├── server.ts                 # Backend Express
├── src/
│   ├── lib/
│   │   ├── db.ts            # PostgreSQL connection pool
│   │   └── init-db.ts       # Database initialization
│   ├── App.tsx              # Frontend main component
│   └── features/            # Frontend features
├── database/
│   └── init.sql             # PostgreSQL schema
├── .env                      # Environment variables (local)
├── .env.example             # Template com instruções
└── package.json             # Dependencies & scripts
```

---

## 📊 ARQUITETURA

```
┌─────────────────────────┐
│   Frontend (React)      │
│   http://localhost:3000 │
└────────────┬────────────┘
             │ HTTP
┌────────────▼────────────┐
│   Backend (Express)     │
│   Routes API /api/*     │
└────────────┬────────────┘
             │ PostgreSQL
┌────────────▼────────────┐
│   PostgreSQL Database   │
│   localhost:5432        │
│   (via Docker)          │
└─────────────────────────┘
```

---

## ✨ PRÓXIMOS PASSOS

1. ✅ Instalar Docker
2. ✅ Criar PostgreSQL container
3. ✅ Rodar `npm run dev`
4. ✅ Acessar http://localhost:3000
5. ✅ Testar endpoints API
6. ✅ Desenvolver features

---

## 🚀 DEPLOYMENT PARA RENDER

Quando pronto para produção:

1. Comitar todas as mudanças
2. Fazer push para GitHub
3. Conectar GitHub ao Render
4. Configurar DATABASE_URL com credenciais Render PostgreSQL
5. Deploy automático

---

**Última atualização**: 2026-04-03
**Status**: ✅ Pronto para desenvolvimento local
