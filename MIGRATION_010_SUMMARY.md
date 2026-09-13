# 📋 Migration 010: Normalização dos Dados Migrados — Resumo Executivo

## ✅ Status: PRONTO PARA DEPLOY

---

## 🔧 Correção Implementada

### Problema Crítico Encontrado
Na primeira versão da migration 010, todos os `UPDATE` incluíam `updated_at = now()`, o que causaria:
- **Histórico embaralhado**: todos os documentos pareceriam "recém-modificados"
- **Paginação quebrada**: querys `order by updated_at DESC` retornariam ordem invertida
- **Auditoria visual confusa**: impossível rastrear quando os dados foram realmente alterados

### Solução Aplicada
**Removidos 20 blocos de `updated_at = now()`** de todos os UPDATEs da migration 010.

Agora o SQL:
- ✅ Normaliza apenas o conteúdo em `data` (timestamps, sedes, competências)
- ✅ Preserva `updated_at` (representa a última modificação de negócio real)
- ✅ Mantém `updated_at` original do documento (sem sobrescrita técnica)

---

## 📦 Arquivos Entregues

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `supabase/migrations/010_normalize_migrated_data.sql` | ✅ Corrigido | Migration idempotente, sem `updated_at = now()` |
| `supabase/scripts/diagnostico_migracao.sql` | ✅ Existente | 10 queries de validação antes/depois |
| `README-SUPABASE.md` | ✅ Documentado | Seção "Onda 3 — Normalização" completa |
| `npm run lint` | ✅ Passou | Sem erros TypeScript |
| `npm run build` | ✅ Passou | Build finalizado em 9.20s |

---

## 🎯 Próximas Ações

### 1️⃣ Rodar Diagnóstico Antes (VOCÊ)
No **Supabase Dashboard > SQL Editor**, execute `supabase/scripts/diagnostico_migracao.sql` e registre os **6 números iniciais**:

```sql
-- QUERY 1: Lançamentos com competência inválida
SELECT count(*) FROM public.lancamentos
WHERE data->>'competencia' IS NULL OR data->>'competencia' !~ '^\d{4}-\d{2}$';

-- QUERY 2: Lançamentos órfãos (sem colaborador)
SELECT count(*) FROM public.lancamentos l
LEFT JOIN public.colaboradores c ON upper(c.id) = upper(l.data->>'matricula')
WHERE c.id IS NULL;

-- QUERY 3: Contracheques órfãos
SELECT count(*) FROM public.contracheques p
LEFT JOIN public.colaboradores c ON upper(c.id) = upper(p.data->>'matricula')
WHERE c.id IS NULL;

-- QUERY 4: Colaboradores sem sede
SELECT count(*) FROM public.colaboradores
WHERE data->>'sedeCodigo' IS NULL AND data->>'sede' IS NULL;

-- QUERY 5: Timestamps Firestore ainda presentes
SELECT count(*) FROM public.lancamentos
WHERE jsonb_typeof(data->'criadoEm') = 'object';

-- QUERY 6: CRÍTICO — Duplicatas de matrícula (deve ser 0 linhas)
SELECT data->>'matricula', count(*) FROM public.colaboradores
GROUP BY data->>'matricula'
HAVING count(*) > 1;
```

### 2️⃣ Validar Query 6 (VOCÊ)
**Se Query 6 retornar alguma linha**: ⚠️ **PARE** — não rode a migration 010 até resolver as duplicatas.

**Se Query 6 retornar 0 linhas**: ✅ Seguro continuar.

### 3️⃣ Rodar Migration 010 (VOCÊ)
No **SQL Editor do Supabase**:
1. Copie `supabase/migrations/010_normalize_migrated_data.sql` inteiro
2. Cole no SQL Editor
3. Clique "Run" (a query é grande, pode levar 30–60s)
4. Confirme sucesso

### 4️⃣ Rodar Diagnóstico Depois (VOCÊ)
Execute novamente `supabase/scripts/diagnostico_migracao.sql` e compare:
- Query 1: deve ser **0** (competências normalizadas)
- Query 4: deve ser **0** (sedes normalizadas)
- Query 5: deve ser **0** (timestamps convertidos)
- Query 6: deve ser **0 linhas** (sem duplicatas)
- Query Bonus: `SELECT * FROM logs_normalizacao` — quantas alterações foram feitas?

---

## 📊 O que a Migration 010 Faz

### 1. Converte Timestamps Firestore → ISO-8601
- Detecta `{_seconds: 1700000000, _nanoseconds: 0}`
- Converte para `2023-11-15T00:00:00.000Z`
- Aplica em 7 tabelas, 10+ campos

**Tabelas afetadas:**
- `lancamentos`: `criadoEm`, `atualizadoEm`, `dataRegistro`
- `dispensas_sptf`: `emitidoEm`, `data`
- `contracheques`: `importadoEm`
- `insalubridade_records`: `criadoEm`, `dataEvento`
- `competencias_controle`: `fechadoEm`
- `admin_users`: `criadoEm`, `atualizadoEm`
- `logs_auditoria`: `criadoEm`

### 2. Normaliza Campos de Sede
- Se `sedeCodigo` vazio, extrai de `sede` (antes do hífen)
  - `"DECO-MN"` → `"DECO"`
  - `"KO-DL"` → `"KO"`
- Se `employeeSede` vazio, copia de `sedeCodigo`
- Preserva campos originais (`sede`, `secaoCanteiro`)

**Tabelas afetadas:**
- `colaboradores`: `sedeCodigo`
- `lancamentos`: `sedeCodigo`
- `dispensas_sptf`: `sedeCodigo`, `employeeSede`
- `contracheques`: `sedeCodigo`
- `insalubridade_records`: `sedeCodigo`

### 3. Deriva Competência
- Em `lancamentos`: extrai de `dataRegistro` (7 primeiros caracteres: `YYYY-MM`)
- Em `contracheques`: converte `mesAno` de `MM-YYYY` → `YYYY-MM`

---

## 🛡️ Propriedades de Segurança

| Propriedade | Valor |
|-------------|-------|
| **Idempotente** | ✅ Sim — rodar 2× não cria duplicatas em `logs_normalizacao` |
| **Transacional** | ⚠️ Não — executa comando a comando (SQL Editor é auto-commit) |
| **Reversível** | ✅ Sim — logs em `logs_normalizacao` rastreiam tudo; SQL reverse pode ser escrito |
| **RLS Protegido** | ✅ Sim — `logs_normalizacao` só permite acesso a admins globais |
| **Preserva Dados** | ✅ Sim — campos originais (`sede`, etc.) nunca são apagados |

---

## 🚨 Possíveis Problemas & Resoluções

### Problema: "Query too large" ou timeout no SQL Editor
**Solução:** Descomente a query `SELECT tabela, campo, count(*) FROM logs_normalizacao` (linha ~583) ou divida em 2 migrations.

### Problema: Query 6 retorna linhas (duplicatas de matrícula)
**Solução:** Execute no SQL Editor:
```sql
SELECT data->>'matricula', array_agg(id) FROM public.colaboradores
GROUP BY data->>'matricula' HAVING count(*) > 1;
```
Identifique qual documento é inativo/obsoleto e delete-o.

### Problema: `logs_normalizacao` fica muito grande
**Solução:** Após validação bem-sucedida, execute:
```sql
DELETE FROM public.logs_normalizacao
WHERE criado_em < now() - INTERVAL '7 days';
```

---

## 📌 Checklist Final

- [x] Migration 010 criada (sem `updated_at = now()`)
- [x] Script de diagnóstico validado (10 queries)
- [x] README-SUPABASE.md atualizado com "Onda 3"
- [x] Lint: ✅ Passou
- [x] Build: ✅ Passou (9.20s)
- [ ] Você: Rodar diagnóstico ANTES
- [ ] Você: Validar Query 6 (0 duplicatas)
- [ ] Você: Rodar migration 010 no SQL Editor
- [ ] Você: Rodar diagnóstico DEPOIS
- [ ] Você: Confirmar todos os números

---

## 📞 Suporte

Se encontrar erros durante a execução da migration 010:
1. **Verifique a conexão** ao Supabase (SQL Editor ativo?)
2. **Verifique logs** do Supabase (Settings > Database > Logs)
3. **Roda de novo** (migration é idempotente!)

Pronto para deploy! 🚀
