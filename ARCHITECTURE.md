# 🏗️ Arquitetura da Refatoração - Diagrama Visual.

## Fluxo Completo de Importação

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ORIGEM DOS DADOS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   [CSV]                    [PDF CONTRACHEQUE]                       │
│    ├─ Matricula             ├─ Matricula                             │
│    ├─ Nome                  ├─ Nome                                  │
│    ├─ Funcao                ├─ Cargo                                 │
│    ├─ CPF                   ├─ CPF                                   │
│    ├─ Departamento   ◄──────┼─ Sede/Depto                            │
│    └─ Sede                  └─ DataInicio                            │
│                                                                       │
└────────────┬────────────────────────────────────┬────────────────────┘
             │                                    │
             ▼                                    ▼
┌──────────────────────────┐      ┌──────────────────────────────┐
│  csvSyncHelper.ts        │      │  pdfSyncHelper.ts            │
│  parseAndSync...         │      │  syncPaystubsToEmployees()   │
└────────────┬─────────────┘      └──────────────┬───────────────┘
             │                                   │
             └───────────────┬───────────────────┘
                             │
                             ▼
      ┌──────────────────────────────────────────────────┐
      │       employeeSyncService.ts                     │
      │  (Motor Unificado de UPSERT)                     │
      ├──────────────────────────────────────────────────┤
      │                                                   │
      │  1. findConstructionSiteByBigram()               │
      │     └─ Busca canteiro por departamento           │
      │                                                   │
      │  2. syncEmployeeUpsert()                         │
      │     ├─ Limpa CPF                                 │
      │     ├─ Gera Hash SHA-256                         │
      │     ├─ Busca duplicata no Firestore              │
      │     ├─ Se encontrado → UPDATE                    │
      │     └─ Se não → CREATE                           │
      │                                                   │
      │  3. batchSyncEmployees()                         │
      │     └─ Processa múltiplos com progresso          │
      │                                                   │
      └────────────────┬─────────────────────────────────┘
                       │
                       ▼
      ┌──────────────────────────────────────────────────┐
      │  lgpdUtils.ts                                    │
      │  (Segurança & Conformidade LGPD)                │
      ├──────────────────────────────────────────────────┤
      │                                                   │
      │  ├─ generateCPFHash() → SHA-256                  │
      │  │  └─ Irreversível, seguro para busca           │
      │  │                                                │
      │  ├─ maskCPF() → ***.XXX.XXX-**                   │
      │  │  └─ Para exibição em telas                    │
      │  │                                                │
      │  ├─ cleanCPF() → Remove caracteres               │
      │  └─ isValidCPF() → Valida formato                │
      │                                                   │
      └────────────────┬─────────────────────────────────┘
                       │
                       ▼
      ┌──────────────────────────────────────────────────┐
      │  Firestore Collections                           │
      ├──────────────────────────────────────────────────┤
      │                                                   │
      │  ✓ colaboradores                                 │
      │    ├─ id: "13974"                                │
      │    ├─ matricula: "13974"                         │
      │    ├─ nome: "JOÃO SILVA"                         │
      │    ├─ canteiroId: "site-uuid-001"  ◄─ Novo      │
      │    ├─ cpfHash: "abc123..."        ◄─ Novo       │
      │    ├─ cpfMascarado: "***.456.789-**" ◄─ Novo   │
      │    └─ ... (outros campos)                        │
      │                                                   │
      │  ✓ canteiros_obras                               │
      │    ├─ id: "site-uuid-001"                        │
      │    ├─ nome: "Canteiro DECO-KO"                   │
      │    ├─ bigramasImportacao:        ◄─ Novo        │
      │    │  ["KO", "DECO-KO", "DACO-KO"]               │
      │    └─ ... (outros campos)                        │
      │                                                   │
      │  ✓ contracheques (if PDF)                        │
      │    ├─ id: "13974_12-2024"                        │
      │    ├─ matricula: "13974"                         │
      │    ├─ nome: "JOÃO SILVA"                         │
      │    └─ ... (campos de folha)                      │
      │                                                   │
      └────────────────┬─────────────────────────────────┘
                       │
                       ▼
      ┌──────────────────────────────────────────────────┐
      │  Componentes da UI                               │
      ├──────────────────────────────────────────────────┤
      │                                                   │
      │  CanteirosManagement.tsx                         │
      │  ├─ ✓ Campo "Bigramas para Importação"  ◄─ Novo │
      │  └─ Entrada: "KO, DECO-KO, DACO-KO"             │
      │                                                   │
      │  EmployeeManagement.tsx                          │
      │  ├─ ✓ Coluna "Canteiro / Frente"        ◄─ Novo │
      │  │   └─ Exibe código (resolve canteiroId)        │
      │  ├─ ✓ Coluna "CPF (LGPD)"              ◄─ Novo │
      │  │   └─ Exibe cpfMascarado                       │
      │  └─ ✓ Desduplicação automática                   │
      │                                                   │
      └──────────────────────────────────────────────────┘
```

---

## Fluxo de Desduplicação (UPSERT)

```
   ENTRADA
    │
    │  { matricula: "13974", nome: "JOÃO", cpf: "123.456.789-01", dept: "DECO-KO" }
    │
    ▼
┌─────────────────────────────────────┐
│ 1. LIMPAR E VALIDAR                 │
├─────────────────────────────────────┤
│ CPF: "123.456.789-01"               │
│ ├─ Remove: . - espaços              │
│ └─ Resultado: "12345678901" ✓       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. GERAR HASH                       │
├─────────────────────────────────────┤
│ CPF limpo: "12345678901"            │
│ ├─ SHA-256 (crypto.subtle.digest)   │
│ └─ Hash: "abc123def456..." ✓        │
│    (Irreversível e seguro)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. BUSCAR CANTEIRO                  │
├─────────────────────────────────────┤
│ Departamento: "DECO-KO"             │
│ ├─ Iterar bigramasImportacao de     │
│ │  todos os canteiros               │
│ ├─ Match case-insensitive           │
│ └─ Encontrado: site.id              │
│    "site-uuid-001" ✓                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. PESQUISAR DUPLICATAS             │
├─────────────────────────────────────┤
│ Firestore Query:                    │
│ WHERE cpfHash = "abc123def456..."   │
│ OR matricula = "13974"              │
│                                     │
│ Resultado:                          │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
   ENCONTRADO    NÃO ENCONTRADO
      │             │
      ▼             ▼
  ┌────────┐   ┌──────────┐
  │ UPDATE │   │  CREATE  │
  └────┬───┘   └────┬─────┘
       │            │
       │            ▼
       │        ┌────────────────────┐
       │        │ novo ID = matricula│
       │        │ ou emp-${time}     │
       │        └────┬───────────────┘
       │             │
       ▼             ▼
  ┌────────────────────────────────┐
  │ SALVAR NO FIRESTORE            │
  ├────────────────────────────────┤
  │ {                              │
  │   "id": "13974",               │
  │   "matricula": "13974",        │
  │   "nome": "JOÃO SILVA",        │
  │   "funcao": "OP. MOTONÍVEL",   │
  │   "canteiroId": "site-uuid",   │
  │   "cpfHash": "abc123...",      │
  │   "cpfMascarado": "***.456.789-**",
  │   "atualizadoEm": "2024-12-15" │
  │ }                              │
  └────────────┬───────────────────┘
               │
               ▼
         RESULTADO
         ├─ action: "created" | "updated"
         ├─ success: true
         ├─ employeeId: "13974"
         └─ message: "✓ Sincronizado com sucesso"
```

---

## Arquitetura de Camadas

```
┌──────────────────────────────────────────────────────┐
│                    UI LAYER                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  CanteirosManagement.tsx      EmployeeManagement    │
│  (Gestão de Canteiros)        (Tabela + Colunas)   │
│  • Campo bigramas              • Canteiro resolvido │
│  • Modal edit/create           • CPF mascarado      │
│                                                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                  HELPER LAYER                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  csvSyncHelper.ts    pdfSyncHelper.ts               │
│  • Parse CSV         • Parse Paystubs                │
│  • Validação         • Mapeamento                    │
│  • Progresso         • Chamada ao sync service       │
│                                                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                 SERVICE LAYER                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│           employeeSyncService.ts                    │
│  • findConstructionSiteByBigram()                   │
│  • findExistingEmployee()                           │
│  • syncEmployeeUpsert()                             │
│  • batchSyncEmployees()                             │
│  • getSyncStatistics()                              │
│                                                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                UTILITY LAYER                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│           lgpdUtils.ts                              │
│  • generateCPFHash()           firestoreService     │
│  • maskCPF()                   • prepareEmployee    │
│  • cleanCPF()                  • sanitizeData       │
│  • formatCPF()                                       │
│                                                      │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                DATABASE LAYER                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│            Firestore Collections                    │
│  • colaboradores                                    │
│  • canteiros_obras                                  │
│  • contracheques                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados (Antes vs Depois)

### ❌ ANTES (Sem Refatoração)

```
CSV/PDF → Parse → Create/Update Manual → Firestore
          ├─ Sem validação de duplicação
          ├─ CPF armazenado em texto plano
          ├─ Vínculo de canteiro manual
          ├─ Possíveis duplicatas
          └─ Sem conformidade LGPD
```

### ✅ DEPOIS (Com Refatoração)

```
CSV/PDF → Parse → csvSyncHelper/pdfSyncHelper
         ↓
employeeSyncService (Motor UPSERT)
├─ generateCPFHash() ✓
├─ findConstructionSiteByBigram() ✓
├─ findExistingEmployee() ✓
├─ Validar CPF ✓
├─ Desduplicar ✓
└─ Create/Update Atômico ✓
         ↓
lgpdUtils (Segurança)
├─ Hash SHA-256 ✓
├─ Máscara CPF ✓
└─ Conformidade LGPD ✓
         ↓
Firestore (Armazenagem Segura)
└─ cpfHash, cpfMascarado, canteiroId ✓
         ↓
EmployeeManagement (Exibição)
├─ Coluna Canteiro Resolvido ✓
├─ Coluna CPF Mascarado ✓
└─ Sem duplicatas visíveis ✓
```

---

## Matriz de Responsabilidades

| Componente | Responsabilidade | Entrada | Saída |
|-----------|------------------|---------|-------|
| csvSyncHelper | Parse CSV | CSV Text | Employee[] + DeptMap |
| pdfSyncHelper | Parse Paystubs | Paystub[] | Employee[] + DeptMap |
| employeeSyncService | UPSERT Atômico | Employee + Dept | SyncResult |
| lgpdUtils | Segurança LGPD | CPF | Hash, Masked |
| firestoreService | Persistência | Employee | Firestore Doc |
| EmployeeManagement | Exibição | Employee[] | Tabela com colunas novas |
| CanteirosManagement | Cadastro Bigramas | String | ConstructionSite |

---

## Dependências Entre Módulos

```
EmployeeManagement.tsx
    ├─ Precisa de: constructionSites (para resolver canteiroId)
    └─ Exibe: CPF mascarado + Canteiro resolvido

CanteirosManagement.tsx
    └─ Permite cadastrar: bigramasImportacao

csvSyncHelper.ts
    ├─ Usa: employeeSyncService
    ├─ Usa: lgpdUtils
    └─ Produz: SyncResult

pdfSyncHelper.ts
    ├─ Usa: employeeSyncService
    ├─ Usa: pdfParser
    └─ Produz: SyncResult

employeeSyncService.ts
    ├─ Usa: lgpdUtils
    ├─ Usa: firestoreService
    └─ Usa: ConstructionSite[]

lgpdUtils.ts
    └─ Independente (apenas crypto.subtle)
```

---

**🎨 Diagrama Visual Completo da Arquitetura Refatorada**
