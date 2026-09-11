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

1. **Esquema**: no Supabase Dashboard > SQL Editor, execute:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
2. **Autenticação** (Authentication):
   - Ative o provedor **Google** (Authentication > Providers > Google) com o
     client ID/secret do seu Google Cloud.
   - Em **Authentication > URL Configuration**, cadastre em *Site URL* e
     *Redirect URLs* a URL onde o sistema roda (ex.: `https://seudominio/admin`
     e, em desenvolvimento, a URL do preview).
   - Para o acesso mestre de contingência ("Acessar Painel" com conta
     `coari.comara@gmail.com` / `comarafab@gmail.com`), crie em
     **Authentication > Users** um usuário **e-mail/senha** (Auto Confirm ON)
     com esse e-mail e uma senha forte. A senha é digitada no login mestre.
3. **Variáveis de ambiente** (Settings > API):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` = apenas na máquina onde
     rodar o script de migração (nunca no frontend).
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
