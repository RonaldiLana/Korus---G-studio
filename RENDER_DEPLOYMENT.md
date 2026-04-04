# Guia de Deploy no Render

## ✅ Correção Implementada

O problema `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'` foi corrigido removendo a importação top-level e usando import dinâmico.

### Mudanças Aplicadas:

**Antes:**
```typescript
import { createServer as createViteServer } from "vite";  // ❌ Falha em produção
```

**Depois:**
```typescript
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");  // ✅ Carregado apenas em dev
  const vite = await createViteServer({...});
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));  // ✅ Usa arquivos estáticos em prod
}
```

---

## 📋 Checklist para Deploy no Render

### 1. **Build (Antes de fazer push)**
```bash
npm run build
```
- Gera pasta `dist/` com React compilado
- Necessário para servir frontend em produção

### 2. **Variáveis de Ambiente no Render**
Adicionar no Dashboard do Render:
```
DATABASE_URL=postgresql://user:pass@host:port/dbname
NODE_ENV=production
PORT=3000
```

### 3. **Comando de Start**
```bash
node --loader tsx/esm server.ts
```
ou
```bash
tsx server.ts
```

### 4. **Build Command (Opcional)**
```bash
npm run build
```

---

## 🔍 Verificação Local

Simular produção localmente:
```bash
# 1. Build frontend
npm run build

# 2. Testar com NODE_ENV=production
NODE_ENV=production npm run dev
```

Expected output:
```
[BOOT] ✓ Servidor rodando em http://localhost:3000
[BOOT] ✓ Ambiente: production
```

---

## 📁 Estrutura de Produção

```
dist/                    # ← Frontend React compilado (gerado por npm run build)
src/
  lib/
    db.ts               # Conexão PostgreSQL
    init-db.ts          # Bootstrap banco de dados
server.ts               # Backend Express (após correção)
package.json
```

### Fluxo em Produção:
1. Express inicia in `NODE_ENV=production`
2. `/api/*` → Restante das rotas (banco de dados)
3. `/*` → Arquivos estáticos de `dist/` (React compilado)

---

## ✨ O que NÃO foi alterado

- ✅ Todas as rotas API continuam funcionando
- ✅ Conexão PostgreSQL mantida
- ✅ React frontend intacto
- ✅ Tailwind CSS mantido
- ✅ Banco de dados bootstrap automático

---

## 🚀 Deploy Steps

1. Fazer push para main:
   ```bash
   git push origin main
   ```

2. No Render Dashboard:
   - Conectar repositório GitHub
   - Build: `npm run build`
   - Start: `tsx server.ts`
   - Aguardar deploy

3. Testar em produção:
   - Verificar logs: `tail -f ~/render.log`
   - Acessar: `https://seu-app.onrender.com`

---

## 🔧 Troubleshooting

### Erro: "Cannot find package 'vite'"
✅ **Resolvido** - Import dinâmico implementado

### Erro: "dist" not found
```bash
npm run build  # Execute localmente ou configure build command no Render
```

### Erro: "DATABASE_URL not configured"
Verificar variáveis de ambiente no Render Dashboard

### Servidor não inicia
Verificar logs: 
```bash
render-logs
```

---

## 📖 Referências

- [Render Node.js Deployment](https://render.com/docs/deploy-node-express-app)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Build Commands](https://render.com/docs/build-command)
