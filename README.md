# Korus - Sistema de Gestão de Vistos

## Migração para PostgreSQL

Este projeto foi migrado de SQLite para PostgreSQL para suporte a produção no Render.

### Configuração

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure as variáveis de ambiente no `.env`:
   - `DATABASE_URL`: URL de conexão PostgreSQL (ex: `postgresql://user:pass@host:port/db`)
   - `PORT`: Porta do servidor (padrão: 3000)
   - `NODE_ENV`: Ambiente (development/production)

### Desenvolvimento Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure o banco de dados PostgreSQL local ou use um serviço como Neon, Supabase, etc.

3. Inicialize o banco (opcional, feito automaticamente na inicialização):
   ```bash
   npm run db:init
   ```

4. Execute o servidor:
   ```bash
   npm run dev
   ```

### Deploy no Render

1. Configure as variáveis de ambiente no painel do Render:
   - `DATABASE_URL`: URL do banco PostgreSQL fornecido pelo Render
   - `PORT`: Porta fornecida pelo Render (geralmente 10000)
   - `NODE_ENV`: production

2. O comando de start é: `npm start`

### Arquivos Modificados

- `server.ts`: Removida dependência SQLite, adicionada inicialização PostgreSQL
- `src/lib/db.ts`: Nova camada de conexão PostgreSQL
- `src/lib/init-db.ts`: Inicialização e seed do banco
- `src/lib/compat-db.ts`: Camada de compatibilidade com API SQLite
- `database/init.sql`: Schema PostgreSQL
- `package.json`: Scripts atualizados, dependência 'pg' adicionada
- `.env.example`: Exemplo de variáveis de ambiente

### Notas da Migração

- O schema foi adaptado de SQLite para PostgreSQL (SERIAL, TIMESTAMP, etc.)
- Mantida compatibilidade com código existente através de camada de abstração
- Dados iniciais são inseridos automaticamente na primeira execução
- Conexão testada na inicialização do servidor
