# COMARA – Gestão Administrativa

Sistema de gestão administrativa para acompanhamento de horas, colaboradores, canteiros, insalubridade, dispensas SPTF, contracheques e relatórios executivos. Construído em React + TypeScript com integração ao Firebase (Authentication + Firestore) e mecanismos de fallback local para operação resiliente.

> **Esta é a versão final da área administrativa.** O portal do colaborador foi removido. O sistema roda em `admbancodehoras.ai.studio` e atende exclusivamente a gestão (RBAC, lançamentos, competências, relatórios, canteiros, etc.).

## Visão geral

O produto centraliza o ciclo de gestão de pessoal e produção em ambiente de obra, permitindo:

- cadastro e manutenção de colaboradores;
- gestão de canteiros e atribuição de responsabilidades;
- controle de banco de horas e registros de ponto;
- homologação e acompanhamento de laudos de insalubridade;
- importação e validação de contracheques e folhas;
- relatórios executivos por sede, canteiro e desempenho;
- painel administrativo com RBAC (role-based access control).

## Stack tecnológico

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication (Google Workspace)
- Cloud Firestore
- Lucide React
- PDF/CSV handling para importação e processamento de dados

## Principais módulos

- Dashboard executivo
- Gestão de colaboradores
- Gestão de canteiros
- Acompanhamento de horas / banco de horas
- Insalubridade
- Relatórios e auditoria
- Contracheques
- Backup e restauração de dados
- Configurações institucionais

## Perfis e permissões

O sistema usa role-based access control com perfis como:

- SUPER_ADMIN
- RH_ADMIN
- GERENTE_CANTEIRO
- CHEFE_CANTEIRO
- CHEFE_DA
- AUX_DA

## Como rodar

```bash
# Instalar dependências
npm install

# Modo desenvolvimento (porta 3000)
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

O build gera dois entry points no `dist/`:
- `index.html` — redireciona para `/admin`
- `admin.html` — aplicação administrativa

## Type-check e testes

```bash
# Type-check
npx tsc --noEmit

# Suítes de teste (competências, RBAC, canteiros, etc.)
npx tsx src/shared/services/competenciaEngine.test.ts
npx tsx src/shared/services/competenciaService.test.ts
npx tsx src/shared/services/competenciaBlindagem.test.ts
npx tsx src/shared/services/competenciaValidade.test.ts
npx tsx src/shared/services/competenciaCanteiro.test.ts
npx tsx src/shared/services/rbacService.test.ts
npx tsx src/shared/services/canteiroService.test.ts
```

## Firestore Rules

As regras em `firestore.rules` mantêm toda a segurança administrativa (RBAC, competências, canteiros, relatórios). As regras específicas do portal do colaborador (Custom Token, `request.auth.token.matricula`) foram removidas.

Para publicar as regras (requer Firebase CLI autenticado):

```bash
npm run deploy:rules
```
