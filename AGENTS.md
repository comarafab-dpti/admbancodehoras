# Base44 development notes

- Run the app with `docker compose -f docker-compose.base44.yml up -d`.
- The frontend is a Vite development server on port 3000 with source bind-mounted for live reload.
- Firebase client configuration is committed in `firebase-applet-config.json`; the UI falls back to browser-local data when Firestore is unavailable or access is denied.
- `GEMINI_API_KEY` appears only as an optional template entry and is not required by the current source or at boot.
- Verify locally with `curl -f http://localhost:3000/` and externally with a non-localhost Host header.
- Type-check with `docker compose -f docker-compose.base44.yml exec -T web npm run lint`.
- Máquina de Competências (Fase 1–4): rodar as suítes com `npx tsx src/shared/services/competenciaEngine.test.ts` (44 testes), `npx tsx src/shared/services/competenciaService.test.ts` (16) e `npx tsx src/shared/services/competenciaBlindagem.test.ts` (33) dentro do serviço `web`.

## Estrutura modular (Admin × Shared)

- `src/admin/` — componentes da gestão (dashboard, lançamentos, relatórios, competências, permissões, extrato/EmployeeStatement, settings/). `src/admin/settings/` é a subpasta de configuração institucional.
- `src/shared/` — `services/`, `types/` (types.ts + instituição), `utils/`, `constants/`, `contexts/`, `hooks/` e `components/` (ui/, ComaraLogo, ErrorBoundary, InfoTooltip, IconButton, MonthYearPicker, OfflineIndicator, SessionTimeoutModal, PWAInstallButton, MobilePWAInstallBanner).
- Imports entre camadas usam o alias `@/src/...` (vite + tsconfig); imports internos de cada camada permanecem relativos.
- Rotas simplificadas sem router: `/admin` (gestão; sem sessão abre o login). A raiz `/` redireciona para `/admin`. O efeito de rota em App.tsx sincroniza `window.location.pathname` no login/logout.
- O portal do colaborador foi removido desta versão. Entry points: `index.html` (redireciona para `/admin`) e `admin.html` (aplicação administrativa).

## Correções de estabilidade (Fase 1 da auditoria técnica)

- **Trava de competência:** ausência de controle do mês anterior (documento ou entrada do canteiro em `statusCanteiros`) = LIBERADO, no cliente (`validarLancamentoCanteiro` em competenciaEngine) e nas rules (`competenciaAnteriorFechada`). Bloqueia somente quando o controle existe e o canteiro está explicitamente não-fechado. Isso também elimina o bloqueio durante o carregamento dos listeners.
- **Campo `competencia`** agora é gravado em `dispensas_sptf`, `contracheques` e `insalubridade_records` (preparadores em firestoreService) — necessário para as Rules.
- **Dispensas:** gravam `employeeSede` (código do canteiro, herdado do lançamento); a query de subscription filtra por `employeeSede` em vez do prefixo hardcoded `DECO-`.
- **Cache removido:** `localCache` não é mais usado para dados operacionais (`admin_users`, `system_config`, `canteiros_obras`, insalubridade por período) — tudo via `onSnapshot` ou fetch fresco. `setorService` mantém cache próprio (configuração).
- **Subscriptions unificadas:** um único conjunto no App.tsx — colaboradores, lançamentos, insalubridade e contracheques sempre ativos (gestão, com filtro de canteiro para perfis restritos); admins, dispensas, canteiros e system_config apenas com sessão ativa. Erros de leitura mostram banner claro; sem fallback silencioso para localStorage (este permanece apenas como camada de emergência offline/populada pelos snapshots).
- **Rules:** leitura restrita por RBAC em `colaboradores`, `lancamentos`, `insalubridade_records` e `contracheques`. Escritas restritas: credenciais/cadastros somente perfis globais. `logs_auditoria`/`logs_acesso` permitem create autenticado. Contracheques sem exigência de competência. `documentoDoMeuCanteiro` aceita `sedeCodigo`/`employeeSede`/`sede`. **As rules alteradas precisam de deploy manual com `npm run deploy:rules`** (requer Firebase CLI — fora do sandbox).
- Fase 4 (blindagem): `firestore.rules` bloqueia create/update/delete de `lancamentos` em competência FECHADO (bypass Super Admin); todo lançamento persiste o campo `competencia` (YYYY-MM) derivado de `dataRegistro`; `fecharCompetencia` exige C-1 FECHADO, apura delta de refechamento e dispara cascata automática nas competências posteriores. As regras alteradas precisam ser publicadas com `npm run deploy:rules` (requer Firebase CLI autenticado — fora do sandbox).
- Fase 5 (rastreabilidade/LGPD/otimização): suíte `npx tsx src/shared/services/competenciaValidade.test.ts` (40 testes). `PRAZO_BANCO_HORAS_MESES` (competenciaEngine.ts) é a única fonte do prazo (6 meses; usada também por `getRecordPrescriptionInfo`). O fechamento grava metadados no `resumo_mensal` (minutosGerados/Compensados/Disponiveis, dataGeracao, prazoMeses, dataVencimento, situacaoValidade) calculados em memória — zero leituras extras. `CompetenciaManagementModal` embute `ValidityAlertsPanel` (alertas 30/60 dias, dados em memória) e abre `LiquidacaoReportModal` (extrato de liquidação/rescisão, somente leitura, `window.print()`). Auditoria de fechamento/reabertura registra valor anterior→novo por servidor via `detalhesJson` (apenas matrícula — LGPD). Zero novas leituras em todos os cenários normais.
- Recomendações futuras NÃO implementadas (aguardando aprovação): (1) migrar listener global de lançamentos (limit 2000) para `subscribeLancamentosPorCompetencia` — maior consumo de cota hoje; (2) restringir `allow read` de `resumo_mensal` nas regras (exige deploy); (3) UI de configuração do prazo (hoje constante central).
- Fase 6 (fechamento obrigatório por canteiro): `statusCanteiros` é mantido em `competencias_controle/{YYYY-MM}`; lançamentos em M exigem o canteiro correspondente de M-1 fechado, inclusive na virada de ano. `competenciaService` expõe `fecharCanteiro`, `reabrirCanteiro`, `verificarTravaCanteiro` e `subscribeControleCompetencia`; `CanteiroLockBanner` recebe o status por listener em tempo real. `CHEFE_DA`/`CHEFE_CANTEIRO` atualizam somente seu item de `statusCanteiros`; `RH_ADMIN` e `SUPER_ADMIN` gerenciam todos; bypass de `SUPER_ADMIN` exige confirmação e auditoria. As regras estão em `firestore.rules` e precisam de deploy manual com `npm run deploy:rules`. Suíte: `npx tsx src/shared/services/competenciaCanteiro.test.ts` (14 testes). O fluxo normal mantém dois listeners de controle (M e M-1); guardas de interface não fazem `get()` por clique, e as regras do Firestore permanecem a autoridade final.

## Design System — Paleta Institucional Aeronáutica

- **Tokens:** `src/shared/constants/designTokens.ts` (TS reference) + CSS custom properties in `src/index.css` (`:root` for light, `[data-theme="dark"]` for dark). App.tsx syncs `data-theme` on `document.documentElement` via `useEffect`.
- **Palette:** dark mode uses navy institutional surfaces (`#0B1426` base, `#16243D` card, `#243756` border) with slate text scale (`#E2E8F0`, `#94A3B8`, `#64748B`). Light mode uses slate surfaces (`#F1F5F9` base, `#FFFFFF` card, `#E2E8F0` border). Brand accent `#3B82F6` (blue-500) preserved across both themes. Semantic colors (success/danger/warning/purple) unchanged.
- **Base components:** `src/shared/components/ui/` — `Button` (6 variants × 4 sizes, loading state), `Card`/`CardHeader`/`CardBody`, `Input` (label, icon, error, hint), `Badge` (6 semantic variants). All consume CSS variables for theme-awareness.
- **Consistency:** All inputs have `focus:ring-2` focus rings. Primary buttons use `shadow-lg shadow-blue-600/20` + `active:scale-[0.98]` tactile feedback. All buttons with `cursor-pointer` + `transition-*` have `active:scale-[0.98]`.
- **To add a new screen:** prefer importing from `src/shared/components/ui/` for buttons, cards, inputs, badges. Use CSS variables (`var(--surface-card)`, etc.) for theme-aware colors.

## Modelo organizacional simplificado

- **OM:** a organização institucional da COMARA, que contém suas unidades.
- **OU:** qualquer Unidade Organizacional cadastrada em `unidades_organizacionais`, com código, nome, sigla, tipo de compatibilidade, sede/canteiro padrão, descrição e status ativo. A OU SEDE é pré-cadastrada.
- **Setor:** unidade filha de uma OU, indicada pelo campo `pai`. Uma OU pode ter nenhum, um ou vários setores. Quando não houver setor cadastrado, a interface usa virtualmente `<codigo-da-ou>/GERAL`, sem criar documento ou opção fantasma no banco.
- **Lotação:** OU administrativa do funcionário (`lotacaoUoCodigo`). Qualquer OU pode receber funcionários.
- **UO de execução:** OU onde o trabalho é realizado (`uoExecucaoCodigo`), podendo ser diferente da lotação.
- **Canteiro:** local territorial/operacional legado, mantido quando aplicável por `sedeCodigo` e `canteiroExecucaoId`.
- **Departamento original:** valor bruto do CSV, preservado em `departamentoOriginal` para rastreabilidade.
- **DECO/DACO/SEDE:** padrões de reconhecimento na importação (`DECO-<bigrama>`, `DACO-<bigrama>`, `SEDE-<bigrama>`). Não são estruturas especiais; o bigrama apenas localiza a OU cadastrada.
- Filtros e formulários usam as UOs ativas carregadas da coleção `unidades_organizacionais`; regras de segurança e o deploy manual do Firestore permanecem inalterados.
- O pipeline oficial de colaboradores é `importacaoColaboradores.ts` + `classificacaoInterativa.ts`; módulos históricos de sincronização não devem ser usados em novas integrações.
