# 🔧 Reconfiguração Render Studio - www.korus.me

## 📊 Diagnóstico Atual

| Serviço | URL | Status | Nota |
|---------|-----|--------|------|
| **Express Backend** | api.korus.me | ✅ HTTP 200 | Serve frontend + API |
| **Static Site** | www.korus.me | ❌ HTTP 404 | Desatualizado (Static Site antigo) |

## 🎯 Problema Raiz

- `www.korus.me` aponta para um **Render Static Site separado** (não o Express)
- Static Site não reconhece `_redirects` corretamente
- Express backend JÁ está configurado corretamente e funciona

## ✅ Solução: Remover Static Site e Unificar em Web Service

### Opção 1: VIA RENDER STUDIO (Recomendado)

1. **Ir para [Render Dashboard](https://dashboard.render.com)**
2. **Localizar seu Static Site**
   - Nome provável: algo como "korus-frontend" ou "korus-static"
   - Settings → Delete Service (deletar)
3. **Ir para Web Service: `korus-backend`**
   - Settings → Custom Domain
   - Adicionar/Verificar: `www.korus.me` 
   - Garantir que aponta ao Web Service (não ao Static Site)
4. **Aguardar DNS propagação** (~2-5 minutos)

### Opção 2: VIA DNS CNAME (se preferir não deletar Static Site)

1. **Ir para DNS Management do seu domínio no Render**
2. **Encontrar registro `www` (CNAME)**
3. **Mudar para:** `api.korus.me` (ou o CNAME exato do Web Service)
4. **Salvar e aguardar propagação**

## 🧪 Validação Após Reconfiguração

```bash
# Teste 1: www.korus.me
curl -I https://www.korus.me/acompanhamento/teste-validation
# Esperado: HTTP 200 (não 404)

# Teste 2: api.korus.me  
curl -I https://api.korus.me/acompanhamento/teste-validation
# Esperado: HTTP 200 ✅

# Teste 3: Com token real (produção)
curl -I https://www.korus.me/acompanhamento/[TOKEN_REAL]
# Esperado: HTTP 200 + HTML React
```

## ⏰ Tempo Estimado

- Configuração no Render Studio: **~1-2 minutos**
- DNS propagação: **~2-5 minutos**
- Validação em produção: **~2-3 minutos**
- **Total: ~10 minutos**

## 📝 Código Que JÁ Está Correto

### App.tsx (routing)
```tsx
if (window.location.pathname.startsWith('/acompanhamento/')) {
  return <ClientTrackingPage />;
}
```

### server.ts (SPA fallback)
```tsx
app.use(express.static(distPath, { maxAge: '1d' }));
// ... depois ...
app.use((req, res, next) => {
  // SPA fallback: serve index.html para rotas não-API
  if (!req.path.startsWith('/api/')) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  next();
});
```

### Backend Endpoint
```tsx
GET /api/processes/track/:token (público, sem JWT)
```

---

**Status: ✅ CÓDIGO 100% CORRETO | ❌ CONFIGURAÇÃO RENDER PRECISA DE AJUSTE**
