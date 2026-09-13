# 📋 Bateria de Testes Manuais — Sistema COMARA

**Versão:** 1.0  
**Data de criação:** 2025-09-13  
**Escopo:** Validação completa do sistema após migrations Supabase, ajustes de RLS e otimizações de UI.

---

## 📖 Como usar este documento

Este documento fornece uma **bateria estruturada de testes manuais** para validar o funcionamento de todas as áreas críticas do sistema COMARA. É destinado a usuários não técnicos e gestores de QA.

### O que você vai fazer
1. Executar cada teste na ordem sugerida.
2. Preencher o campo **Resultado obtido** com o que você observou.
3. Marcar o **Status** (✅ Passou / ❌ Falhou / ⚠️ Aviso) na coluna correspondente.
4. Reportar qualquer anomalia ao time técnico com: **ID do teste**, **resultado obtido** e **captura de tela**.

### Ambientes
- 🔵 **DEV:** `http://localhost:3000` (local, após `npm run dev`)
- 🟢 **STAGING:** URL do servidor de testes (configurar conforme sua infra)
- 🔴 **PROD:** URL do servidor de produção

### Ferramentas úteis (abra com F12)
- **DevTools → Network:** Filtre por "Fetch/XHR" para visualizar requisições HTTP.
  - ✅ **200** = Sucesso
  - ❌ **403** = Sem permissão (RLS negou)
  - ❌ **401** = Não autenticado
  - ❌ **500** = Erro do servidor

- **DevTools → Application → Storage:**
  - `localStorage` = Dados persistidos localmente (temas, preferências)
  - `sessionStorage` = Dados da sessão atual
  - `Cookies` = Sessão JWT do Supabase Auth

- **DevTools → Console:** Procure por erros em vermelho (ex: `error TS2448`, `Uncaught Error`).

- **Supabase Dashboard → Logs → Edge Functions:** Visualizar execução das funções serverless (create-admin-user, update-admin-user).

### Dica: Testar múltiplos perfis
Abra duas abas lado a lado com usuários diferentes (ex: Super Admin + AUX_DA) para testar RLS cruzado.

---

## 1. Autenticação (AUTH)

### AUTH-01: Login Google (conta nova → status pendente)

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-01 |
| **Descrição** | Novo usuário cria conta via Google OAuth |
| **Pré-requisito** | Google Workspace OAuth configurado no Supabase |
| **Passo a passo** | 1. Abra a URL da aplicação<br>2. Clique em "Entrar com Google"<br>3. Selecione uma conta Google não cadastrada<br>4. Autorize acesso ao e-mail<br>5. Observe o redirecionamento |
| **Resultado esperado** | 1. Modal "Aguardando aprovação do administrador" exibido<br>2. Mensagem clara sobre status pendente<br>3. Botão "Fazer logout" disponível<br>4. Campo admin_users criado com `status = 'pendente'` |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### AUTH-02: Login Google (conta ativa → painel)

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-02 |
| **Descrição** | Usuário ativo entra via Google OAuth |
| **Pré-requisito** | Conta Google já aprovada e ativa no `admin_users` |
| **Passo a passo** | 1. Abra a URL da aplicação<br>2. Clique em "Entrar com Google"<br>3. Selecione a conta aprovada<br>4. Autorize acesso |
| **Resultado esperado** | 1. Redirecionamento para `/admin` (painel)<br>2. Navbar exibida com nome do usuário<br>3. Permissões carregadas corretamente (conforme seu perfil)<br>4. Nenhum erro 403 no console |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### AUTH-03: Login e-mail/senha (conta mestre)

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-03 |
| **Descrição** | Super Admin entra com e-mail e senha |
| **Pré-requisito** | Usuário criado em Supabase Auth (Authentication > Users) com email e senha |
| **Passo a passo** | 1. Abra a URL da aplicação<br>2. Selecione aba "E-mail e Senha"<br>3. Digite e-mail corporativo e senha<br>4. Clique "Entrar"<br>5. Espere redirecionamento |
| **Resultado esperado** | 1. Redirecionamento para `/admin`<br>2. Painel carregado completamente<br>3. Nenhum erro 401 no console<br>4. Dados de colaboradores/lançamentos carregados |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### AUTH-04: Logout

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-04 |
| **Descrição** | Usuário faz logout com sucesso |
| **Passo a passo** | 1. Estando logado, localize menu de usuário (ícone de engrenagem ou nome)<br>2. Clique em "Logout" ou "Sair"<br>3. Observe redirecionamento e limpeza de dados |
| **Resultado esperado** | 1. Redirecionamento para página de login<br>2. LocalStorage limpo (verificar DevTools > Application)<br>3. Sessão encerrada (token JWT removido)<br>4. Não há dados do usuário anterior em cache |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### AUTH-05: Sessão expirada (após 30 min inativo)

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-05 |
| **Descrição** | Sessão expira automaticamente após inatividade |
| **Passo a passo** | 1. Faça login<br>2. Aguarde 30 minutos sem interagir com a página<br>3. Tente qualquer ação (clicar em botão, navegar)<br>4. Observe o comportamento |
| **Resultado esperado** | 1. Modal de "Sessão expirada" exibido ou<br>2. Redirecionamento automático para login<br>3. Mensagem clara: "Sua sessão expirou. Faça login novamente"<br>4. Dados não perdidos (página está "congelada") |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### AUTH-06: Usuário bloqueado vê mensagem correta

| Campo | Valor |
|-------|-------|
| **ID** | AUTH-06 |
| **Descrição** | Usuário com status "inativo" não consegue entrar |
| **Pré-requisito** | Usuário deve ter `status = 'inativo'` em `admin_users` |
| **Passo a passo** | 1. Tente fazer login com e-mail de usuário inativo<br>2. Insira senha correta<br>3. Observe a resposta |
| **Resultado esperado** | 1. Login recusado<br>2. Mensagem exibida: "Sua conta foi desativada. Contacte o administrador"<br>3. Redirecionamento para tela de login (sem painel)<br>4. Nenhum dado carregado |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 2. RBAC — Role-Based Access Control (RBAC)

### RBAC-01: Super Admin cria novo usuário no painel

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-01 |
| **Descrição** | Super Admin cria novo usuário via painel administrativo |
| **Pré-requisito** | Estar logado como SUPER_ADMIN |
| **Passo a passo** | 1. Navegue para "Gestão de Usuários" ou "Permissões"<br>2. Clique em "Novo Usuário" ou "+"<br>3. Preencha: nome, e-mail, perfil (ex: RH_ADMIN), canteiro<br>4. Clique em "Criar"<br>5. Consulte logs ou dashboard de usuários |
| **Resultado esperado** | 1. Novo usuário criado com status "pendente"<br>2. E-mail visível em Supabase Auth (Authentication > Users)<br>3. Entrada criada em `admin_users` com nome, e-mail, perfil<br>4. Supabase Edge Function `create-admin-user` executada (verificar logs)<br>5. Mensagem de sucesso exibida |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RBAC-02: Super Admin aprova usuário pendente

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-02 |
| **Descrição** | Super Admin muda status de "pendente" para "ativo" |
| **Pré-requisito** | Usuário com status "pendente" deve existir |
| **Passo a passo** | 1. Abra painel de "Gestão de Usuários"<br>2. Localize usuário com status "pendente"<br>3. Clique em editar ou ícone de aprovação<br>4. Mude status para "ativo"<br>5. Clique "Salvar"<br>6. Peça ao novo usuário para testar login em nova aba |
| **Resultado esperado** | 1. Status alterado para "ativo" no banco<br>2. Usuário consegue fazer login (AUTH-02 funciona)<br>3. Edge Function `update-admin-user` executada<br>4. Nenhum erro 403 na tentativa de login do novo usuário |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RBAC-03: Super Admin muda perfil de usuário (rebaixar/promover)

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-03 |
| **Descrição** | Alterar role de um usuário ativo (ex: RH_ADMIN → AUX_DA) |
| **Pré-requisito** | Usuário ativo deve estar em `admin_users` |
| **Passo a passo** | 1. Abra painel de "Gestão de Usuários"<br>2. Clique em editar do usuário alvo<br>3. Mude o campo "Perfil" (ex: RH_ADMIN → AUX_DA)<br>4. Clique "Salvar"<br>5. Usuário deve fazer logout/login em nova aba para ver mudança<br>6. Observe mudança de permissões no painel |
| **Resultado esperado** | 1. Perfil atualizado no banco (`nivelAcesso` em `admin_users`)<br>2. JWT atualizado no próximo login<br>3. Menu/botões habilitados/desabilitados conforme novo perfil<br>4. Permissões de leitura refletem novo role (ex: AUX_DA vê menos colaboradores)<br>5. Auditoria registrada em `logs_auditoria` |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RBAC-04: Super Admin desativa usuário

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-04 |
| **Descrição** | Desativar um usuário ativo (status → inativo) |
| **Passo a passo** | 1. Abra painel de "Gestão de Usuários"<br>2. Localize usuário ativo<br>3. Clique em editar ou ícone de desativação<br>4. Mude status para "inativo"<br>5. Salve<br>6. Teste login do usuário desativado em nova aba |
| **Resultado esperado** | 1. Status mudado para "inativo"<br>2. Usuário desativado recebe mensagem de bloqueio ao tentar login (AUTH-06)<br>3. Auditoria registrada em `logs_auditoria`<br>4. Nenhum erro 500; transação bem-sucedida |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RBAC-05: Mudança de perfil exige relogin do usuário

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-05 |
| **Descrição** | Usuário vê aviso e precisa fazer relogin para novo perfil valer |
| **Pré-requisito** | Executar RBAC-03 enquanto usuário está logado em outra aba |
| **Passo a passo** | 1. Super Admin abre painel de usuários em aba 1<br>2. Usuário afetado está no painel em aba 2 (logado)<br>3. Super Admin muda perfil do usuário (aba 1)<br>4. Volta para aba 2 e aguarde alguns segundos<br>5. Tente qualquer ação (navegar, criar registro)<br>6. Observe se há modal de relogin ou se permissões mudaram silenciosamente |
| **Resultado esperado** | 1. **Opção A:** Modal exibido: "Suas permissões foram alteradas. Faça relogin"<br>2. **Opção B:** Sistema detecta JWT inválido e redireciona para login automaticamente<br>3. Após relogin, novo perfil está ativo com permissões corretas |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RBAC-06: Novo usuário aparece em Supabase Auth → Users

| Campo | Valor |
|-------|-------|
| **ID** | RBAC-06 |
| **Descrição** | Usuário criado pelo painel aparece em Supabase Dashboard |
| **Pré-requisito** | Executar RBAC-01 (criar novo usuário) |
| **Passo a passo** | 1. Abra Supabase Dashboard do seu projeto<br>2. Navegue para "Authentication" → "Users"<br>3. Procure pelo e-mail do usuário criado em RBAC-01<br>4. Clique para ver detalhes (email_confirmed_at, metadata, etc.) |
| **Resultado esperado** | 1. E-mail do novo usuário está visível na lista<br>2. Status "Confirmed" ou flag de confirmação visível<br>3. Campo `raw_app_meta_data` contém `nivelAcesso`, `canteiroSede`, `ativo` (populado pela trigger de Custom Claims)<br>4. Sem erros 500 ou entradas duplicadas |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 3. Lançamentos (LANCE)

### LANCE-01: Criar lançamento individual

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-01 |
| **Descrição** | Usuário com permissão cria lançamento de dia trabalhado |
| **Pré-requisito** | Estar logado; colaborador e competência devem existir |
| **Passo a passo** | 1. Navegue para "Lançamentos" ou abra modal de "Novo Lançamento"<br>2. Selecione colaborador<br>3. Selecione data (hoje ou data recente)<br>4. Digite horas (ex: 8.00)<br>5. Selecione tipo (Normal, Extra, Falta, etc.)<br>6. Clique "Salvar"<br>7. Observe se aparece na lista imediatamente |
| **Resultado esperado** | 1. Lançamento criado e visível na lista/tabela<br>2. Registro armazenado em `lancamentos` com campos: colaborador, data, horas, tipo<br>3. Mensagem de sucesso exibida<br>4. Log criado em `logs_auditoria` (quem criou, quando)<br>5. Competência derivada corretamente (YYYY-MM extraído de data) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### LANCE-02: Editar lançamento existente

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-02 |
| **Descrição** | Usuário edita horas ou tipo de lançamento |
| **Pré-requisito** | Lançamento deve existir (criar via LANCE-01) |
| **Passo a passo** | 1. Localize lançamento na lista<br>2. Clique em editar (ícone de lápis ou duplo-clique)<br>3. Mude a quantidade de horas (ex: 8.00 → 9.50)<br>4. Mude o tipo se desejar<br>5. Clique "Salvar"<br>6. Verifique se mudança refletiu na lista |
| **Resultado esperado** | 1. Horas atualizadas no banco<br>2. Campo `updated_at` do documento atualizado (não `created_at`)<br>3. Auditoria registra: usuário, timestamp, valores antigo/novo<br>4. Competência permanece a mesma (derivada do `dataRegistro` ou `data`) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### LANCE-03: Excluir lançamento

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-03 |
| **Descrição** | Usuário deleta um lançamento |
| **Passo a passo** | 1. Localize lançamento na lista<br>2. Clique em ícone de exclusão (lixeira)<br>3. Confirme exclusão em modal de confirmação<br>4. Observe se desaparece da lista |
| **Resultado esperado** | 1. Lançamento removido da tabela `lancamentos`<br>2. Auditoria registra deleção (suave: documento marcado como deletado ou rígida: não há linha)<br>3. Nenhum erro 403 (permissão validada)<br>4. Banco de horas não fica inconsistente (compensações não são deletadas) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### LANCE-04: Preenchimento em lote de dias úteis

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-04 |
| **Descrição** | Modal de preenchimento rápido para múltiplos dias em sequência |
| **Passo a passo** | 1. Abra modal "Lançamento em Lote" ou "Preenchimento Rápido"<br>2. Selecione colaborador<br>3. Selecione mês/ano ou data inicial e final<br>4. Escolha "preencher dias úteis" com X horas/dia<br>5. Revise dia a dia os que serão preenchidos<br>6. Clique "Confirmar"<br>7. Aguarde processamento |
| **Resultado esperado** | 1. Múltiplos lançamentos criados em batch (uma requisição, não ~20)<br>2. Apenas dias úteis (seg-sex) preenchidos (fins de semana ignorados)<br>3. Feriados ignorados (se implementado)<br>4. Mensagem de progresso ou "X lançamentos criados"<br>5. Todos visíveis na lista após conclusão |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### LANCE-05: Lançamento em competência fechada (deve bloquear)

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-05 |
| **Descrição** | Sistema bloqueia lançamento em competência já fechada |
| **Pré-requisito** | Competência anterior deve estar fechada (ex: agosto/2025 fechado) |
| **Passo a passo** | 1. Tente criar lançamento com data em mês fechado<br>2. Preencha dados normalmente<br>3. Clique "Salvar"<br>4. Observe bloqueio ou mensagem de erro |
| **Resultado esperado** | 1. Modal de erro exibido: "Não é possível lançar em competência fechada"<br>2. Nenhum registro criado no banco<br>3. Mensagem sugere reabertura por Admin<br>4. Nenhum erro 500 no console (é um erro esperado 400 ou similar) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### LANCE-06: Bypass de Super Admin (com auditoria)

| Campo | Valor |
|-------|-------|
| **ID** | LANCE-06 |
| **Descrição** | Super Admin consegue lançar em competência fechada com confirmação |
| **Pré-requisito** | Competência fechada e estar logado como SUPER_ADMIN |
| **Passo a passo** | 1. Tente criar lançamento em competência fechada (LANCE-05)<br>2. Super Admin vê modal adicional: "Atenção: competência fechada. Pressione OK para bypass com auditoria"<br>3. Clique "OK"<br>4. Lançamento é criado<br>5. Verifique auditoria |
| **Resultado esperado** | 1. Lançamento criado mesmo com competência fechada<br>2. Campo de auditoria marca: `bypass_admin: true`, `dataBypass: timestamp`<br>3. Entrada em `logs_auditoria`: "Lançamento criado em competência fechada por SUPER_ADMIN"<br>4. Mensagem clara no histórico indicando bypass |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 4. Competências (COMP)

### COMP-01: Abrir novo mês (criar novo `competencias_controle`)

| Campo | Valor |
|-------|-------|
| **ID** | COMP-01 |
| **Descrição** | RH_ADMIN abre novo mês de competência |
| **Pré-requisito** | Estar logado como RH_ADMIN ou SUPER_ADMIN |
| **Passo a passo** | 1. Navegue para "Competências" ou "Gestão de Competências"<br>2. Clique em "Novo Mês" ou "Abrir Competência"<br>3. Selecione mês/ano (ex: outubro/2025)<br>4. Clique "Criar"<br>5. Confirme visibilidade no dashboard |
| **Resultado esperado** | 1. Novo documento criado em `competencias_controle` (id: YYYY-MM)<br>2. Status inicial: "aberta"<br>3. Contador de lançamentos: 0<br>4. Data de criação: hoje<br>5. Competência agora aparece nos filtros de lançamentos |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### COMP-02: Fechar mês (exige anterior fechado)

| Campo | Valor |
|-------|-------|
| **ID** | COMP-02 |
| **Descrição** | RH_ADMIN fecha mês; sistema exige mês anterior fechado |
| **Pré-requisito** | Mês anterior já deve estar fechado; mês atual deve estar aberto |
| **Passo a passo** | 1. Navegue para "Competências"<br>2. Localize mês atual (ex: setembro/2025)<br>3. Clique em "Fechar" ou ícone correspondente<br>4. Modal exibe: "Fechar competência: resumo de lançamentos (total de horas, extras, faltas)"<br>5. Clique "Confirmar"<br>6. Aguarde processamento |
| **Resultado esperado** | 1. Status mudado para "fechada"<br>2. Campo `dataFechamento` preenchido com data/hora<br>3. Resumo mensal criado em `resumo_mensal` com métricas (minutosGerados, minutosCompensados, etc.)<br>4. Próximo mês pode ser aberto automaticamente<br>5. Auditoria registrada |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### COMP-03: Reabrir mês (bloqueia o seguinte)

| Campo | Valor |
|-------|-------|
| **ID** | COMP-03 |
| **Descrição** | Super Admin reabre mês fechado; sistema bloqueia próximo mês |
| **Pré-requisito** | Mês já deve estar fechado |
| **Passo a passo** | 1. Navegue para "Competências"<br>2. Localize mês fechado (ex: setembro/2025)<br>3. Clique em "Reabertura" ou dropdown de ações<br>4. Selecione "Reabrir"<br>5. Digite motivo (ex: "Correção de lançamentos")<br>6. Clique "Confirmar" |
| **Resultado esperado** | 1. Status retorna para "aberta"<br>2. Próximo mês é automaticamente **fechado** (para evitar inconsistência)<br>3. Auditoria registra: `tipo: 'reabertura'`, `motivo`, `dataReabertura`<br>4. Resumo mensal NOT deletado (histórico preservado) mas marcado como "reabertura em progresso" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### COMP-04: Fechar por canteiro independente

| Campo | Valor |
|-------|-------|
| **ID** | COMP-04 |
| **Descrição** | CHEFE_CANTEIRO fecha competência apenas do seu canteiro |
| **Pré-requisito** | Estar logado como CHEFE_CANTEIRO; lançamentos do canteiro devem estar completos |
| **Passo a passo** | 1. Estando logado como CHEFE_CANTEIRO, vá para "Competências"<br>2. Localize competência atual<br>3. Clique "Fechar Canteiro" (não "Fechar Global")<br>4. Modal exibe resumo **apenas do seu canteiro**<br>5. Clique "Confirmar"<br>6. Aguarde processamento |
| **Resultado esperado** | 1. Entrada em `statusCanteiros` criada/atualizada: `{competencia: 'YYYY-MM', canteiroId, status: 'fechado'}`<br>2. Outros canteiros ainda conseguem lançar<br>3. Auditoria registra: quem fechou, canteiro, data<br>4. Mensagem: "Canteiro X fechado para competência YYYY-MM" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 5. Contracheques (CONTRA)

### CONTRA-01: RH importa contracheques (PDF/CSV)

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-01 |
| **Descrição** | RH_ADMIN importa arquivo de contracheques (folha de pagamento) |
| **Pré-requisito** | Estar logado como RH_ADMIN; arquivo de teste disponível (CSV ou PDF com campos: matrícula, nome, valor bruto, etc.) |
| **Passo a passo** | 1. Navegue para "Contracheques" → "Importar"<br>2. Selecione arquivo (PDF ou CSV)<br>3. Verifique preview dos registros (matrícula, nome, valor)<br>4. Clique "Confirmar Importação"<br>5. Observe mensagem de progresso |
| **Resultado esperado** | 1. Registros importados em `contracheques` com status "ativo"<br>2. Campos mapeados corretamente: matricula, nomeFuncionario, valorBruto, etc.<br>3. Competência derivada do período da folha (ex: 09/2025 → 2025-09)<br>4. Auditoria registra: arquivo, quantidade de registros, quem importou<br>5. Mensagem: "X contracheques importados com sucesso" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-02: Super Admin vê todos os contracheques

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-02 |
| **Descrição** | SUPER_ADMIN consegue filtrar e visualizar contracheques de todos canteiros |
| **Pré-requisito** | Estar logado como SUPER_ADMIN; deve haver contracheques em canteiros diferentes |
| **Passo a passo** | 1. Abra aba "Contracheques"<br>2. Não aplique filtro de canteiro (ou selecione "TODAS")<br>3. Observe lista de todos os contracheques<br>4. Filtre por canteiro diferente e confirme existência de registros |
| **Resultado esperado** | 1. Lista mostra contracheques de todos os canteiros<br>2. Sem filtro ou com filtro "TODAS", ~100% dos registros visível<br>3. RLS não restringe leitura para SUPER_ADMIN<br>4. Performance aceitável (< 3 segundos de carregamento) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-03: CHEFE_DA/AUX_DA vê contracheques do seu canteiro

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-03 |
| **Descrição** | Usuário restrito a canteiro vê apenas seus contracheques (RLS flexível com prefixo/sufixo) |
| **Pré-requisito** | Estar logado como AUX_DA ou CHEFE_DA; contracheques devem existir com campos `employeeSede`, `sedeCodigo`, ou `sede` contendo código do canteiro |
| **Passo a passo** | 1. Faça login com conta de AUX_DA (ex: canteiro "KO")<br>2. Abra "Contracheques"<br>3. Observe lista (deve mostrar apenas contracheques onde canteiro = "KO" ou contém "KO" com prefixo/sufixo)<br>4. Tente forçar URL com canteiro diferente (ex: ?canteiro=XX) e volte<br>5. Confirme que não há registros de outro canteiro |
| **Resultado esperado** | 1. Apenas contracheques do canteiro "KO" visível<br>2. RLS funciona com match flexível (KO, KO-DL, DECO-KO, etc. — todos incluídos)<br>3. Nenhum erro 403 (permissão OK, apenas filtro aplicado)<br>4. Se tentar acessar DB diretamente com seu token, RLS nega registros de outro canteiro |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-04: AUX_DA NÃO vê botão "Importar"

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-04 |
| **Descrição** | AUX_DA não consegue importar contracheques (botão não exibido) |
| **Pré-requisito** | Estar logado como AUX_DA |
| **Passo a passo** | 1. Faça login como AUX_DA<br>2. Navegue para "Contracheques"<br>3. Procure por botão "Importar", "Upload", ou "+"<br>4. Observe se está desabilitado ou oculto |
| **Resultado esperado** | 1. Botão "Importar" **não existe** ou está desabilitado (cinzento)<br>2. Nenhuma aba de upload visível<br>3. Se tentar acesso direto (URL ou API), retorna erro 403<br>4. UI reflete permissões: apenas RH_ADMIN e SUPER_ADMIN veem "Importar" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-05: AUX_DA NÃO vê botão "Excluir"

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-05 |
| **Descrição** | AUX_DA não consegue deletar contracheques (botão/ícone de exclusão não visível) |
| **Passo a passo** | 1. Faça login como AUX_DA<br>2. Abra lista de contracheques<br>3. Procure por ícone de lixeira, X, ou "Deletar" em cada linha<br>4. Observe se desabilitado ou oculto |
| **Resultado esperado** | 1. Ícone de exclusão **não exibido** para AUX_DA<br>2. Apenas SUPER_ADMIN e RH_ADMIN veem/conseguem deletar<br>3. Se tentar DELETE via API com token de AUX_DA, retorna 403 |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-06: AUX_DA consegue IMPRIMIR contracheque

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-06 |
| **Descrição** | AUX_DA tem permissão de leitura + impressão do contracheque (sem editar) |
| **Passo a passo** | 1. Faça login como AUX_DA<br>2. Abra lista de contracheques do seu canteiro<br>3. Clique no registro para expandir/abrir<br>4. Procure por botão "Imprimir" ou "PDF"<br>5. Clique e aguarde download/print dialog |
| **Resultado esperado** | 1. Botão "Imprimir" está **visível e habilitado**<br>2. PDF gerado ou print dialog exibido<br>3. Nenhum erro 403<br>4. Documento impresso/salvo com informações corretas (matrícula, nome, valores) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CONTRA-07: Colaborador vê últimos 3 contracheques

| Campo | Valor |
|-------|-------|
| **ID** | CONTRA-07 |
| **Descrição** | Perfil "COLABORADOR" (se implementado) vê extrato com últimos 3 contracheques |
| **Pré-requisito** | Sistema deve ter colaborador logado ou perfil específico para colaboradores |
| **Passo a passo** | 1. Faça login como colaborador ou acesse módulo "Meu Extrato"<br>2. Observe seção "Últimos Contracheques"<br>3. Conte a quantidade de registros exibidos |
| **Resultado esperado** | 1. Exatamente 3 contracheques exibidos (mais recentes)<br>2. Ordenados por data decrescente<br>3. Botão "Ver histórico completo" pode redirecionar (se implementado)<br>4. Nenhum contracheque de outro colaborador visível |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 6. Insalubridade (INSAL)

### INSAL-01: RH lança insalubridade

| Campo | Valor |
|-------|-------|
| **ID** | INSAL-01 |
| **Descrição** | RH_ADMIN cria novo registro de insalubridade (adicional, laudo, etc.) |
| **Pré-requisito** | Estar logado como RH_ADMIN |
| **Passo a passo** | 1. Navegue para "Insalubridade" ou "Laudos"<br>2. Clique em "Novo Laudo" ou "Lançar Insalubridade"<br>3. Selecione colaborador, grau (ex: 10%, 20%), período (data início/fim)<br>4. Selecione tipo (adicional insalubridade, periculosidade, etc.)<br>5. Clique "Salvar"<br>6. Observe criação na lista |
| **Resultado esperado** | 1. Registro criado em `insalubridade_records` com campos: colaborador, grau, dataInicio, dataFim, tipo<br>2. Status inicial: "ativo"<br>3. Mensagem de sucesso<br>4. Auditoria registrada (quem criou, quando)<br>5. Competências afetadas marcadas para recalculação (se houver sistema de consolidação) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### INSAL-02: CHEFE_CANTEIRO lança insalubridade

| Campo | Valor |
|-------|-------|
| **ID** | INSAL-02 |
| **Descrição** | CHEFE_CANTEIRO consegue lançar insalubridade do seu canteiro |
| **Pré-requisito** | Estar logado como CHEFE_CANTEIRO |
| **Passo a passo** | 1. Navegue para "Insalubridade"<br>2. Clique "Novo Laudo"<br>3. Selecione colaborador do seu canteiro<br>4. Preencha dados conforme INSAL-01<br>5. Clique "Salvar" |
| **Resultado esperado** | 1. Registro criado (mesma estrutura de INSAL-01)<br>2. Campo `canteiroOrigem` ou similar registra canteiro do CHEFE_CANTEIRO<br>3. Nenhum erro 403<br>4. Colaborador de outro canteiro não pode ser selecionado (filtrado) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### INSAL-03: CHEFE_DA lança insalubridade

| Campo | Valor |
|-------|-------|
| **ID** | INSAL-03 |
| **Descrição** | CHEFE_DA consegue lançar insalubridade |
| **Pré-requisito** | Estar logado como CHEFE_DA |
| **Passo a passo** | 1. Navegue para "Insalubridade"<br>2. Clique "Novo Laudo"<br>3. Selecione colaborador do seu canteiro<br>4. Preencha e clique "Salvar" |
| **Resultado esperado** | 1. Registro criado com sucesso (mesma estrutura)<br>2. Nenhum erro 403<br>3. Permissão concedida (diferente de AUX_DA, ver INSAL-04) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### INSAL-04: AUX_DA NÃO consegue lançar insalubridade

| Campo | Valor |
|-------|-------|
| **ID** | INSAL-04 |
| **Descrição** | AUX_DA não tem permissão para criar/editar insalubridade |
| **Passo a passo** | 1. Faça login como AUX_DA<br>2. Navegue para "Insalubridade"<br>3. Procure por botão "Novo Laudo" ou "Adicionar"<br>4. Observe se desabilitado ou oculto<br>5. Se encontrar, tente clicar |
| **Resultado esperado** | 1. Botão **não visível** ou **desabilitado**<br>2. Se tentar via API/DevTools, retorna erro 403<br>3. Mensagem clara: "Você não tem permissão para lançar insalubridade"<br>4. AUX_DA consegue apenas **ler** (ver CONTRA-03) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### INSAL-05: Consolidação mensal funciona

| Campo | Valor |
|-------|-------|
| **ID** | INSAL-05 |
| **Descrição** | Sistema consolida insalubridade por mês (total de horas a adicionar) |
| **Pré-requisito** | Múltiplos registros de insalubridade devem existir no mesmo período |
| **Passo a passo** | 1. Lançar 2-3 registros de insalubridade (INSAL-01) com mesma competência<br>2. Navegue para "Relatórios" → "Consolidação Insalubridade"<br>3. Selecione mês com registros<br>4. Clique "Calcular" ou "Consolidar"<br>5. Aguarde resultado |
| **Resultado esperado** | 1. Tabela exibida com consolidação: colaborador, total horas insalubres, período<br>2. Valores somados corretamente<br>3. Documento em `resumo_mensal` contém campo `insalubridadeConsolidada`<br>4. Nenhum erro de cálculo<br>5. Botão para exportar (PDF/Excel) se implementado |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 7. Dispensas (DISP)

### DISP-01: Emitir dispensa (gera lançamento de débito automaticamente)

| Campo | Valor |
|-------|-------|
| **ID** | DISP-01 |
| **Descrição** | Usuário autorizado emite dispensa SPTF (autorização de afastamento); sistema cria débito automático |
| **Pré-requisito** | Estar logado como CHEFE_DA, AUX_DA ou RH_ADMIN |
| **Passo a passo** | 1. Navegue para "Dispensas" ou "SPTF"<br>2. Clique "Emitir Dispensa"<br>3. Selecione colaborador<br>4. Preencha: data inicial, data final, tipo (falta, atestado, licença, etc.)<br>5. Campo "Horas" calcula automaticamente (dias × 8h, por ex.)<br>6. Clique "Emitir"<br>7. Aguarde confirmação |
| **Resultado esperado** | 1. Dispensa criada em `dispensas_sptf` com status "ativo"<br>2. **Lançamento de débito criado automaticamente** em `lancamentos` com: tipo = "Dispensa", horas = calculadas, referência à dispensa<br>3. Banco de horas do colaborador reduzido (se houver saldo disponível)<br>4. Auditoria registra: quem emitiu, data, referência a qual lançamento de débito<br>5. Mensagem: "Dispensa emitida e débito processado" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### DISP-02: Cancelar dispensa (reverte o débito)

| Campo | Valor |
|-------|-------|
| **ID** | DISP-02 |
| **Descrição** | Usuário autorizado cancela dispensa emitida; débito é revertido |
| **Pré-requisito** | Dispensa já deve estar ativa (criar via DISP-01) |
| **Passo a passo** | 1. Localize dispensa ativa na lista<br>2. Clique em ícone de cancelamento ou "Cancelar"<br>3. Digite motivo (ex: "Colaborador retornou mais cedo")<br>4. Clique "Confirmar Cancelamento"<br>5. Aguarde processamento |
| **Resultado esperado** | 1. Status mudado para "cancelada"<br>2. Lançamento de débito associado é **deletado ou marcado como cancelado**<br>3. Banco de horas do colaborador retorna ao valor anterior<br>4. Auditoria registra: quem cancelou, motivo, valor revertido<br>5. Mensagem: "Dispensa cancelada e débito revertido" |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### DISP-03: AUX_DA e CHEFE_DA conseguem emitir dispensas

| Campo | Valor |
|-------|-------|
| **ID** | DISP-03 |
| **Descrição** | Ambos perfis têm permissão de criar dispensas |
| **Passo a passo** | 1. Faça login como AUX_DA<br>2. Navegue para "Dispensas"<br>3. Clique "Emitir Dispensa"<br>4. Crie dispensa conforme DISP-01<br>5. Repita com CHEFE_DA em outra sessão |
| **Resultado esperado** | 1. Ambos conseguem clicar em "Emitir"<br>2. Modal abre sem erro 403<br>3. Dispensa criada com sucesso<br>4. Auditoria mostra ambos como emissores |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 8. Importação CSV (CSV)

### CSV-01: Importar 10 colaboradores

| Campo | Valor |
|-------|-------|
| **ID** | CSV-01 |
| **Descrição** | RH_ADMIN importa arquivo CSV com 10 novos colaboradores |
| **Pré-requisito** | Arquivo CSV com estrutura: matrícula, nome, departamento, data_admissão, etc. |
| **Passo a passo** | 1. Navegue para "Colaboradores" → "Importar"<br>2. Selecione arquivo CSV<br>3. Mapeamento automático de colunas deve ocorrer<br>4. Revise preview (10 linhas visível)<br>5. Clique "Confirmar Importação"<br>6. Aguarde processamento (< 5 segundos) |
| **Resultado esperado** | 1. 10 colaboradores criados em `colaboradores` com status "ativo"<br>2. Campos mapeados: matricula, nome, departamento, dataAdmissao, etc.<br>3. Mensagem: "10 colaboradores importados com sucesso"<br>4. Nenhum erro de validação (ex: matricula duplicada, campo obrigatório vazio)<br>5. Auditoria registra: arquivo, quantidade, quem importou |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CSV-02: Importar 400 colaboradores (teste de lote)

| Campo | Valor |
|-------|-------|
| **ID** | CSV-02 |
| **Descrição** | Performance com lote grande (400 registros); sistema usa batch otimizado |
| **Pré-requisito** | Arquivo CSV com ~400 linhas |
| **Passo a passo** | 1. Repita CSV-01 com arquivo de 400 registros<br>2. Observe barra de progresso (se houver)<br>3. Aguarde conclusão<br>4. Monitore DevTools → Network: quantas requisições HTTP enviadas? |
| **Resultado esperado** | 1. Importação completa em < 10 segundos<br>2. DevTools mostra ~1-2 requisições principais (batch otimizado com `upsert` em massa, não 400 requests)<br>3. Mensagem: "400 colaboradores importados com sucesso"<br>4. Nenhum timeout ou erro 413 (payload muito grande)<br>5. Todos os registros criados |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CSV-03: Conciliação de departamento não reconhecido

| Campo | Valor |
|-------|-------|
| **ID** | CSV-03 |
| **Descrição** | Sistema detecta departamento desconhecido e solicita mapeamento interativo |
| **Pré-requisito** | Arquivo CSV contendo coluna "departamento" com valor que não existe em `unidades_organizacionais` |
| **Passo a passo** | 1. Prepare arquivo CSV com departamento desconhecido (ex: "DEPTO-XYZ")<br>2. Inicie importação (CSV-01)<br>3. Se sistema detectar desconhecido, modal "Classificação Interativa" deve aparecer<br>4. Selecione OU existente da dropdown (ex: "Coari")<br>5. Clique "Classificar" ou "Próximo"<br>6. Confirme importação |
| **Resultado esperado** | 1. Modal exibe: "Departamento 'DEPTO-XYZ' não reconhecido. Selecione a OU correta"<br>2. Dropdown contém OUs ativas (`unidades_organizacionais`)<br>3. Mapeamento é salvo e aplicado aos registros<br>4. Colaboradores importados com OU correta (`uoExecucaoCodigo` ou `lotacaoUoCodigo`)<br>5. Nenhum erro 400 |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### CSV-04: Reimportação (upsert, não duplica)

| Campo | Valor |
|-------|-------|
| **ID** | CSV-04 |
| **Descrição** | Reimportar mesmos colaboradores não duplica registros; apenas atualiza |
| **Pré-requisito** | Executar CSV-01 ou CSV-02 primeiro; guardar mesmo arquivo |
| **Passo a passo** | 1. Anote quantidade de colaboradores importados (ex: 10)<br>2. Reimporte o mesmo arquivo CSV<br>3. Observe quantidade total após importação<br>4. Verifique se campos foram atualizados (ex: salário) |
| **Resultado esperado** | 1. Quantidade total **permanece igual** (não duplica de 10 para 20)<br>2. Registros existentes são atualizados (upsert, não insert)<br>3. Se campo mudou no CSV (ex: nome ou salário), reflexa na DB<br>4. Auditoria registra como "atualização" (update), não criação<br>5. Mensagem: "X colaboradores importados (Y atualizados)"<br>6. Nenhum erro de constraint UNIQUE |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 9. RLS — Row-Level Security por Perfil (RLS)

### RLS-01: AUX_DA vê apenas colaboradores do seu canteiro

| Campo | Valor |
|-------|-------|
| **ID** | RLS-01 |
| **Descrição** | RLS filtra automaticamente colaboradores por canteiro do usuário |
| **Pré-requisito** | Colaboradores de múltiplos canteiros devem existir; estar logado como AUX_DA (ex: canteiro "KO") |
| **Passo a passo** | 1. Faça login como AUX_DA (canteiro = "KO")<br>2. Navegue para "Colaboradores"<br>3. Observe lista exibida<br>4. Conte quantidade<br>5. Compare com Super Admin (que vê todos) |
| **Resultado esperado** | 1. Apenas colaboradores com `sedeCodigo`, `employeeSede`, ou `sede` = "KO" exibidos<br>2. Sem filtro manual necessário (RLS automático)<br>3. Quantidade menor que de Super Admin<br>4. Nenhum erro 403 (é permissão OK, apenas filtro)<br>5. Se tentar forçar outro canteiro (URL params ou API), RLS nega silenciosamente (retorna array vazio) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RLS-02: AUX_DA NÃO vê `competencias_controle`, `canteiros_obras`, `unidades_organizacionais`

| Campo | Valor |
|-------|-------|
| **ID** | RLS-02 |
| **Descrição** | Collections administrativas restritas; AUX_DA não consegue ler |
| **Pré-requisito** | Estar logado como AUX_DA |
| **Passo a passo** | 1. Abra DevTools → Console<br>2. Tente executar query (ex: `db.collection('competencias_controle').onSnapshot(...)`)<br>3. Observe erro ou resposta vazia<br>4. Verifique Network: status da requisição |
| **Resultado esperado** | 1. Erro 403 no Network (acesso negado por RLS)<br>2. Ou erro em Console: "permission denied for collection"<br>3. Array vazio retornado (sem erro, mas sem dados)<br>4. Collections administrativas **não aparecem em menu** para AUX_DA<br>5. Apenas SUPER_ADMIN, RH_ADMIN conseguem ler (`is_admin_active()` permitido) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RLS-03: RH_ADMIN vê tudo (exceto dados de super-admin exclusivos)

| Campo | Valor |
|-------|-------|
| **ID** | RLS-03 |
| **Descrição** | RH_ADMIN tem acesso amplo: colaboradores, lançamentos, contracheques, etc. |
| **Pré-requisito** | Estar logado como RH_ADMIN |
| **Passo a passo** | 1. Navegue entre abas: Colaboradores, Lançamentos, Contracheques, Insalubridade<br>2. Verifique se consegue ver dados de **todos os canteiros** (sem filtro)<br>3. Compare com SUPER_ADMIN (devem ver o mesmo, exceto botões de "Backup/Restore" ou "Configurações Globais")<br>4. Abra DevTools e monitore 403s |
| **Resultado esperado** | 1. Todas as coleções abertas e populadas<br>2. Sem erros 403 em requisições normais<br>3. Botões de "Importar", "Fechar Competência", "Excluir" visíveis (conforme RBAC)<br>4. Dados de todos os canteiros visíveis (não filtrados por canteiro)<br>5. Se tentar acessar `admin_users` ou configurações de super-admin, pode ser restrito (conforme design) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### RLS-04: Colaborador vê apenas seus dados

| Campo | Valor |
|-------|-------|
| **ID** | RLS-04 |
| **Descrição** | Colaborador (se acesso implementado) vê apenas seus lançamentos, contacheques, etc. |
| **Pré-requisito** | Sistema deve ter perfil "COLABORADOR" ou portal de colaborador com login sintético |
| **Passo a passo** | 1. Faça login com credencial de colaborador (ex: `12345@comara.local`)<br>2. Acesse seção "Meu Extrato" ou "Meus Dados"<br>3. Verifique lançamentos e contracheques exibidos<br>4. Tente acessar dados de outro colaborador via DevTools/URL<br>5. Observe restrição |
| **Resultado esperado** | 1. Apenas dados do próprio colaborador exibidos<br>2. Se tentar forçar `?colaboradorId=OUTRO`, RLS nega (403 ou array vazio)<br>3. Contracheques, lançamentos, saldo de horas do próprio colaborador<br>4. Nenhum acesso a painel administrativo<br>5. Perfil COLABORADOR tem `meu_canteiro()` igual ao seu canteiro (não "TODAS") |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 10. Performance (PERF)

### PERF-01: Tempo de carregamento inicial (< 3 segundos)

| Campo | Valor |
|-------|-------|
| **ID** | PERF-01 |
| **Descrição** | Página inicial carrega rapidamente após login |
| **Passo a passo** | 1. Faça login (limpar cache com Ctrl+F5 primeiro)<br>2. Observe quanto tempo até Dashboard aparecer<br>3. Abra DevTools → Performance → gere relatório<br>4. Anote tempo total |
| **Resultado esperado** | 1. Dashboard renderizado em < 3000ms (3 segundos)<br>2. Dados (colaboradores, lançamentos) carregados via listeners (não bloqueiam render)<br>3. UI responsivo: inputs, botões, cliques funcionam mesmo se dados ainda carregam<br>4. Nenhum "Long Tasks" (> 50ms) visível no Performance Profiler |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### PERF-02: Navegação entre abas (sem recarregar tudo)

| Campo | Valor |
|-------|-------|
| **ID** | PERF-02 |
| **Descrição** | Clicar em aba diferente não recarrega dados já carregados (cache) |
| **Passo a passo** | 1. Abra aba "Colaboradores" e aguarde carregamento<br>2. Observe DevTools → Network (filtrar por Fetch)<br>3. Clique em aba "Lançamentos"<br>4. Volte para "Colaboradores"<br>5. Conte requisições: segunda vez deve usar cache |
| **Resultado esperado** | 1. Primeira visita a "Colaboradores": requisição HTTP feita<br>2. Segunda visita: nenhuma requisição adicional (usa cache React Query ou localStorage)<br>3. Dados carregam instantaneamente (< 100ms)<br>4. DevTools mostra "Status Code: (from cache)" ou 304 (não modificado)<br>5. Indicador de carregamento (spinner) não aparece na 2ª vez |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### PERF-03: Busca com debounce (1 consulta, não 5)

| Campo | Valor |
|-------|-------|
| **ID** | PERF-03 |
| **Descrição** | Campo de busca usa debounce; digitar "João" envia 1 requisição, não 4 |
| **Passo a passo** | 1. Abra aba com busca (ex: "Colaboradores")<br>2. Abra DevTools → Network (filtrar por Fetch)<br>3. Clique no campo de busca<br>4. Digite "João" lentamente (4 caracteres em 2 segundos)<br>5. Conte requisições HTTP enviadas<br>6. Aguarde resultado |
| **Resultado esperado** | 1. Apenas **1 requisição** enviada (debounce ativo)<br>2. Delay de ~500ms após último keystroke antes de enviar<br>3. Se digitar rápido: nenhuma requisição intermediária<br>4. Resultado atualiza apenas após resposta da requisição final<br>5. Indicador de loading visível apenas uma vez |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

### PERF-04: Cache React Query (Contracheques)

| Campo | Valor |
|-------|-------|
| **ID** | PERF-04 |
| **Descrição** | Contracheques carregados via React Query com cache inteligente e stale-while-revalidate |
| **Passo a passo** | 1. Abra aba "Contracheques" pela primeira vez<br>2. Aguarde carregamento completo<br>3. Navegue para outra aba (ex: "Lançamentos")<br>4. Retorne para "Contracheques"<br>5. Observe se dados reaparecem instantaneamente (cache) |
| **Resultado esperado** | 1. Primeira visita: requisição HTTP, aguarda resposta<br>2. Segunda visita: dados aparecem instantaneamente (cache)<br>3. Em background, possível revalidação silenciosa (stale-while-revalidate)<br>4. Se dados mudaram no servidor, UI atualiza sem recarregar manual<br>5. DevTools → Network mostra requisições apenas quando dados expiram (ex: 5 min) |
| **Resultado obtido** | |
| **Status** | ⬜ |

---

## 📊 Tabela de Resumo

Preencha o resumo abaixo ao final dos testes:

| Área | Total de Testes | ✅ Passou | ❌ Falhou | ⚠️ Aviso | % Sucesso |
|------|-----------------|-----------|----------|---------|-----------|
| **AUTH** (Autenticação) | 6 | | | | |
| **RBAC** (Controle de Acesso) | 6 | | | | |
| **LANCE** (Lançamentos) | 6 | | | | |
| **COMP** (Competências) | 4 | | | | |
| **CONTRA** (Contracheques) | 7 | | | | |
| **INSAL** (Insalubridade) | 5 | | | | |
| **DISP** (Dispensas) | 3 | | | | |
| **CSV** (Importação) | 4 | | | | |
| **RLS** (Segurança) | 4 | | | | |
| **PERF** (Performance) | 4 | | | | |
| **TOTAL** | **49** | | | | |

---

## 📝 Notas Adicionais

Use este espaço para registrar observações, bugs encontrados ou sugestões:

```
[Espaço para notas livres]
```

---

## 📞 Como reportar bugs

1. **ID do Teste:** Ex: `AUTH-01`
2. **Passos para Reproduzir:** Descreva exatamente o que você fez
3. **Resultado Esperado:** O que deveria acontecer
4. **Resultado Obtido:** O que realmente aconteceu
5. **Captura de Tela/Vídeo:** Anexe evidence
6. **Console Error (se houver):** Copie erro completo de DevTools → Console
7. **Sugestão de Correção:** (opcional) Se souber o que corrigir

**Reporte para:** [email técnico ou link do repositório/issue tracker]

---

## ✅ Checklist de Validação Final

- [ ] Todos os testes de AUTH executados
- [ ] Todos os testes de RBAC executados
- [ ] Todos os testes de LANCE executados
- [ ] Todos os testes de COMP executados
- [ ] Todos os testes de CONTRA executados
- [ ] Todos os testes de INSAL executados
- [ ] Todos os testes de DISP executados
- [ ] Todos os testes de CSV executados
- [ ] Todos os testes de RLS executados
- [ ] Todos os testes de PERF executados
- [ ] Nenhum erro bloqueante encontrado
- [ ] Documentação atualizada com resultados
- [ ] Equipe técnica notificada de qualquer falha

---

**Data de Execução:** _______________  
**Executado por:** _______________  
**Aprovado por:** _______________

---

*Documento versão 1.0 — gerado em 2025-09-13. Atualizar após cada sprint ou mudança arquitetural.*
