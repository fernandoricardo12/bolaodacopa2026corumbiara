# Recapitulação — status de cada ponto

| # | Item | Status atual | Ação |
|---|---|---|---|
| 1 | Bolão por pontos + individual, 80% p/ campeão pontos | ✅ Modalidades existem. ❌ **Não há regra/cálculo do prêmio final do bolão de pontos (80% do total arrecadado p/ o 1º do ranking)** | Adicionar card "Prêmio final" no dashboard admin + aba ranking dos jogadores |
| 2 | Acompanhamento automatizado dos ganhadores individuais + confirmar pagamento | ✅ Já existe ("A pagar" no admin com botão "Confirmar pagamento") | Apenas reforçar visualmente, OK |
| 3 | Mais cores verde/amarelo + imagens no dashboard, ranking e página inicial | ⚠️ Já tem gradiente verde/amarelo no header; **faltam imagens/ilustrações e mais cor nos cards** | Gerar 2-3 imagens (hero copa, troféu, estádio) + revisar cards |
| 4 | Texto informativo "plataforma para diversão entre amigos, desenvolvida por mim" na aba Individual | ❌ Não existe | Adicionar banner na `IndividualBetsTab` |
| 5 | Rodar teste de fluxo | — | Verificar build + checar console/network após implementação |
| 6 | Exportar PDF/imagem do ranking, classificação e divisão de prêmios (**só admin**) | ❌ Não existe | Adicionar botões "Baixar PDF" e "Baixar imagem" no painel admin usando `jspdf` + `html2canvas` |
| 7 | Cadastrar chave PIX + link do grupo WhatsApp (admin configura, usuários veem) | ❌ Hardcoded hoje (`PIX_KEY` e número WhatsApp fixos no código) | Criar tabela `app_settings` (key/value) + aba "Configurações" no admin + ler em `PaymentTab` e Footer |

# Implementação

### 1. Banco
Migração criando `public.app_settings (key text PK, value text, updated_at)` com 3 chaves iniciais: `pix_key`, `whatsapp_group_url`, `whatsapp_support_phone`. RLS: leitura pública, escrita só admin.

### 2. Admin — nova aba "Configurações"
Inputs para PIX, link do grupo WhatsApp, telefone de suporte. Salva no `app_settings`.

### 3. Admin — Dashboard
- Novo card "🏆 Prêmio final bolão de pontos" mostrando `total_arrecadado_pontos * 0.80` e o líder atual (preview do ganhador).
- Botões **"📄 Exportar PDF"** e **"🖼️ Exportar imagem"** que capturam: ranking top 10, lista de ganhadores individuais e divisão de prêmios. Lib: `jspdf` + `html2canvas`.

### 4. Página inicial (usuário)
- Adicionar imagem hero (troféu/estádio) no topo do Dashboard.
- Reforçar paleta verde/amarelo nos cards de stats e tabs.
- Ilustração leve na aba Ranking.

### 5. IndividualBetsTab
- Banner topo: *"Plataforma criada para diversão e apostas entre amigos — desenvolvida por [seu nome]."* (uso o nome do admin logado ou texto fixo; **preciso saber qual nome colocar**).

### 6. PaymentTab + Footer
- Ler `pix_key` e `whatsapp_support_phone` do `app_settings` em vez de hardcoded.
- Footer ganha botão "💬 Entrar no grupo do WhatsApp" usando `whatsapp_group_url`.

### 7. Teste de fluxo
Após build, validar:
- `/admin` renderiza sem erro
- Configurações salvam
- Export PDF gera arquivo
- Página inicial mostra imagens
- Banner individual aparece

### Dependências novas
`bun add jspdf html2canvas`

### Imagens a gerar
1. Hero copa 2026 (estádio + troféu, paleta verde/amarelo) — topo do dashboard usuário
2. Ilustração ranking (pódio) — aba ranking
3. Banner admin (gráfico/troféu) — topo do painel

---

**Antes de começar preciso confirmar 1 coisa:** no item 4, qual nome colocar na frase "desenvolvida por ___"?
