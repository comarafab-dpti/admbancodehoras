# Migração Firestore → Supabase (PostgreSQL)

Este documento descreve o estado do sistema após a migração do Firebase
(Firestore + Firebase Auth + App Check) para o **Supabase** (PostgreSQL +
Supabase Auth + Supabase Realtime).

## Visão geral

| Antes (Firebase) | Depois (Supabase) |
| --- | --- |
| Cloud Firestore | PostgreSQL — tabelas em `supabase/migrations/001_schema.sql` |
| Firestore Security Rules | RLS — `supabase/migrations/002_rls.sql` (espelha `firestore.rules`, mantido como referência) |
| Firebase Auth (Google popup/redirect) | Supabase Auth (Google OAuth por redirecionamento + e-mail/senha para conta mestre) |
| App Check | Não é necessário (RLS + JWT do Supabase Auth) |
| `onSnapshot` | Leitura inicial + Supabase Realtime (refetch por canal) |
| SDK `firebase` | `@supabase/supabase-js` |

## Modelo de dados (decisão de arquitetura)

Cada coleção do Firestore virou uma **tabela documental** `(id text PK, data jsonb,
updated_at timestamptz)` — o conteúdo integral do documento é preservado em `data`
com os mesmos campos camelCase legados.

Motivo: o sistema tem ~12k linhas de código de negócio que leem/escrevem os campos
legados diretamente; o modelo documental garante migração funcional 1:1, sem risco
de perda de campos e mantendo todas as regras de negócio. Índices expressionais
(`(data->>'matricula')`, etc.) cobrem as consultas mais usadas.

Normalização incremental (extrair colunas relacionais, `contracheques_rubricas`
etc.) pode ser feita depois, tabela por tabela, sem quebrar o app.

## Passo a passo para ativar

1. **Esquema e RLS (Banco de Dados)**:
   Todos os scripts são **100% idempotentes** (com checagem `if not exists` em tabelas/índices, `drop policy if exists` em políticas RLS e verificação em `pg_publication_tables` para o Realtime). Podem ser executados repetidas vezes sem risco de erro `42710` ("already member of publication" ou "policy already exists").

   No Supabase Dashboard > **SQL Editor**, execute na ordem:
   1. `supabase/migrations/001_schema.sql` (Estrutura de tabelas e índices)
   2. `supabase/migrations/002_rls.sql` (Políticas de segurança RLS)
   3. `supabase/migrations/004_auth_claims_trigger.sql` (Triggers de Custom Claims e RBAC)
   4. `supabase/migrations/006_fix_permissions_and_invoker.sql` (Correção definitiva de permissões RLS e eliminação de avisos)

   *(Ou execute `000_bootstrap.sql`, depois `004_auth_claims_trigger.sql` e `006_fix_permissions_and_invoker.sql`).*

   **Verificação de Saúde (Sanity Check):**
   Após executar as migrações, execute o script `scripts/check-supabase-setup.sql` no SQL Editor para confirmar que todas as tabelas, RLS, políticas de segurança, hardening contra avisos do Linter e triggers de Custom Claims estão ativos.

2. **Autenticação (Supabase Auth com E-mail e Senha + Google OAuth)**:
   - **Login Nativo por E-mail/Senha**:
     - Cada usuário (administrador ou gestor de RH) possui login em `auth.users` via e-mail e senha.
     - Para colaboradores (acesso ao extrato/auditoria), utiliza-se o e-mail sintético `{matricula}@comara.local` com senha inicial padrão (ex.: data de nascimento `DDMMAAAA`) e a flag `must_change_password: true`. No primeiro acesso, o sistema detecta a flag e solicita a definição de uma nova senha pessoal.
     - O perfil RBAC (`nivelAcesso`, `role`, `canteiroSede`, `status`, `ativo`) é mantido na tabela `admin_users` e sincronizado automaticamente via triggers (`004_auth_claims_trigger.sql`) para o `raw_app_meta_data` do token JWT. As políticas RLS consom esses dados a custo zero (0ms) sem consultas adicionais ao banco.
   - **Google Workspace OAuth (Opcional/Alternativo)**:
     - Ative o provedor **Google** (Authentication > Providers > Google) se desejar permitir acesso com a conta Google corporativa.
     - O frontend solicita explicitamente o escopo `https://www.googleapis.com/auth/userinfo.email` para compatibilidade total com contas do Google Workspace.
     - Em **Authentication > URL Configuration**, cadastre em *Site URL* e *Redirect URLs* a URL onde o sistema roda (ex.: `https://ais-dev-...run.app/admin`).
     - **Atenção aos campos Client ID e Client Secret**: Ao copiar e colar do Google Cloud Console para o Supabase, certifique-se de que não haja espaços em branco invisíveis no início ou no fim dos valores, pois isso invalida a autenticação no Google OAuth.
   - Para o acesso mestre de contingência (`coari.comara@gmail.com` / `comarafab@gmail.com`), crie o usuário em **Authentication > Users** com uma senha forte.
3. **Variáveis de ambiente** (Settings > API):
   - `VITE_SUPABASE_URL` = Project URL (ex: `https://tfglkitsxbhkrjykxfmp.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` = anon public key (`eyJhbGciOi...`)
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` = apenas na máquina onde
     rodar o script de migração (nunca no frontend).
   - ⚠️ **IMPORTANTE (Injeção em Tempo de Build)**:
     Como o Vite substitui variáveis `import.meta.env.VITE_*` estaticamente durante o empacotamento (`npm run build`), `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` **devem estar obrigatoriamente configuradas no ambiente de build** da plataforma de hospedagem (AI Studio / Cloud Run / Base44 / Vercel), e não apenas em arquivos locais. Caso as variáveis não estejam presentes no momento do build, o bundle gerará erro explícito de inicialização em vez de falhas silenciosas. Após alterar essas variáveis em qualquer painel de CI/CD, force sempre um **novo build/deploy** da aplicação.
4. **Migração dos dados** (Firestore → Supabase):
   - Exporte as coleções do Firebase Console (JSON) para
     `scripts/firestore-export/` — um arquivo por coleção
     (`colaboradores.json`, `lancamentos.json`, ...). Se os documentos não
     tiverem o campo `id`, exporte no formato `{ "idDocumento": {campos} }`.
   - Execute `npm run migrate:firestore` e confira o resumo de contagens.
   - Coleções esperadas: `canteiros_obras, canteiros, unidades_organizacionais,
     admin_users, usuarios_sistema, colaboradores_auth, colaboradores,
     competencias_controle, lancamentos, dispensas_sptf, contracheques,
     insalubridade_records, insalubridade, resumo_mensal, system_config,
     institution_settings, system_logs, logs_auditoria, logs_acesso`.
5. **Não apague o Firestore** até validar tudo em produção (backup prévio).

## O que mudou no código

- `src/shared/services/supabase.ts` — cliente Supabase (env `VITE_SUPABASE_*`).
- `src/shared/services/db.ts` — camada de acesso a dados sobre o Supabase
  (mantém a API interna `doc/collection/setDoc/onSnapshot/writeBatch/runTransaction`
  para não reescrever as regras de negócio) + shims de autenticação.
- `src/shared/services/authService.ts` — Supabase Auth (Google OAuth +
  `signInWithPassword` para conta mestre).
- `src/shared/services/dbService.ts` (ex `firestoreService.ts`) — todos os
  serviços continuam com a mesma API; `firestoreService` foi renomeado para
  `dbService`.
- Removidos: `firebase` (dependência), `src/shared/services/firebase.ts`,
  `firebase-applet-config.json` (pode deletar), `firestore.rules` (mantido
  apenas como referência da política de segurança).

## Limitações conhecidas / próximos passos

- **OAuth Google é sempre por redirecionamento** (o Supabase Auth não tem modo
  popup). A sessão é detectada automaticamente ao voltar.
- **`runTransaction` é emulado** (leitura + escrita ordenada, sem isolamento
  atômico como no Firestore). Para as operações do sistema (controle de
  competências, uso administrativo concorrente baixo) é equivalente; se
  necessário, migrar para funções transacionais no Postgres.
- **`contracheques_rubricas` (normalização das rubricas)**: as rubricas seguem
  como array jsonb dentro de `contracheques.data.rubricas` (como no legado).
  A normalização em tabela própria pode ser feita depois sem impacto no app.
- Comentários no código podem citar o Firestore como referência histórica.

## Fase 2 — performance frontend

- O painel usa `React.lazy`/`Suspense` para telas e modais administrativos. A
  importação de PDF também é isolada; `pdfjs-dist` só é carregado ao abrir o
  fluxo de contracheques.
- `vite.config.ts` separa os chunks `vendor`, `supabase`, `pdf` e `csv`. No
  build medido em setembro de 2026, o chunk inicial caiu de 2,37 MB (592,54 KB
  gzip) para 319 KB (80,19 KB gzip). O chunk `pdf` ficou separado em 482 KB
  (143,90 KB gzip) e não participa do boot.
- `src/shared/services/db.ts` expõe `getDocsPage`, usando `count: 'exact'` e
  `.range()` com páginas de até 100 registros. `dbService.getEmployeesPage`
  fornece a primeira adoção tipada dessa primitive; a migração das telas que
  dependem de arrays globais permanece planejada para a próxima fase.
- As queries de performance exibem `console.time` somente quando
  `import.meta.env.DEV` está ativo.
- O filtro de insalubridade por competência usa `sedeCodigo`, o campo
  canônico. Dados legados continuam sendo normalizados na leitura quando
  necessário.

## Fase 3 — cache e cálculo consolidado

- `src/shared/services/queryCache.ts` mantém páginas em memória por 30 segundos
  para dados quentes e 5 minutos para catálogos/configuração. Upsert, delete,
  batch e transações invalidam o prefixo da coleção afetada.
- A tela de contracheques já consulta 20 itens por página com `count: 'exact'`,
  `.range()` e filtros de matrícula, competência e sede.
- `src/shared/utils/saldo.ts` calcula os saldos em uma única passagem indexada
  por matrícula. Dashboard e gestão de colaboradores usam o mapa memoizado.
- `supabase/migrations/007_composite_indexes.sql` contém os índices compostos
  da Fase 3. Execute-a no SQL Editor do Supabase; ela não altera RLS/policies.
- As demais telas CRUD ainda dependem de arrays globais para relatórios e
  cálculos; sua migração incremental fica registrada como próximo passo.

## Fase 4 — paginação completa e piloto TanStack Query

- Colaboradores, Insalubridade, Dispensas e Auditoria usam `getCollectionPage`
  com `count: 'exact'` e `.range()` para suas tabelas. Os arrays globais seguem
  disponíveis para cálculos, formulários e relatórios.
- As buscas dessas telas usam `useDebouncedValue` com 300 ms. Contracheques
  usa `useQuery` com chave por filtros/página, `keepPreviousData` e invalidação
  após importação/exclusão. A migração em massa para TanStack Query fica para a
  Fase 5.
- `QueryClientProvider` e `ReactQueryDevtools` estão em `admin/main.tsx`; o
  Devtools só é montado quando `import.meta.env.DEV` está ativo.
- `React.memo` foi aplicado às telas de dashboard, colaboradores e
  contracheques. O cache manual continua sendo usado pelas demais leituras.
