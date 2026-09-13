-- ============================================================================
-- COMARA — Script de Diagnóstico da Normalização de Dados Migrados
-- ============================================================================
--
-- Execute este script ANTES e DEPOIS de rodar a migration 010
-- para validar o sucesso das normalizações.
--
-- ============================================================================

-- ============================================================================
-- 1. LANÇAMENTOS COM COMPETÊNCIA INVÁLIDA
-- ============================================================================
-- Conta documentos sem competência ou com formato inválido
-- Esperado ANTES: pode haver alguns
-- Esperado DEPOIS: 0

SELECT 
  count(*) AS total_lancamentos_sem_competencia_valida,
  'lancamentos' AS tabela
FROM public.lancamentos
WHERE data->>'competencia' IS NULL
   OR data->>'competencia' !~ '^\d{4}-\d{2}$';

-- ============================================================================
-- 2. LANÇAMENTOS ÓRFÃOS
-- ============================================================================
-- Conta lançamentos sem colaborador vinculado (referência quebrada)
-- Esperado ANTES e DEPOIS: ~0 (pode indicar problema nos dados originais)

SELECT 
  count(*) AS total_lancamentos_orfaos,
  'lancamentos' AS tabela
FROM public.lancamentos l
LEFT JOIN public.colaboradores c ON upper(c.id) = upper(l.data->>'matricula')
WHERE c.id IS NULL;

-- ============================================================================
-- 3. CONTRACHEQUES ÓRFÃOS
-- ============================================================================
-- Conta contracheques sem colaborador vinculado
-- Esperado ANTES e DEPOIS: ~0 (pode indicar problema nos dados originais)

SELECT 
  count(*) AS total_contracheques_orfaos,
  'contracheques' AS tabela
FROM public.contracheques p
LEFT JOIN public.colaboradores c ON upper(c.id) = upper(p.data->>'matricula')
WHERE c.id IS NULL;

-- ============================================================================
-- 4. COLABORADORES SEM SEDE PREENCHIDA
-- ============================================================================
-- Conta colaboradores sem sedeCodigo e sem sede
-- Esperado ANTES: pode haver alguns
-- Esperado DEPOIS: 0 (ou valores legítimos sem sede)

SELECT 
  count(*) AS total_colaboradores_sem_sede,
  'colaboradores' AS tabela
FROM public.colaboradores
WHERE data->>'sedeCodigo' IS NULL
  AND data->>'sede' IS NULL;

-- ============================================================================
-- 5. DOCUMENTOS COM TIMESTAMP FIRESTORE NÃO CONVERTIDO
-- ============================================================================
-- Verifica se ainda existem timestamps em formato {_seconds, _nanoseconds}
-- Esperado ANTES: pode haver vários
-- Esperado DEPOIS: 0 (todos convertidos)

WITH timestamp_checks AS (
  SELECT 'lancamentos' AS tabela, count(*) AS total
  FROM public.lancamentos
  WHERE jsonb_typeof(data->'criadoEm') = 'object'
     OR jsonb_typeof(data->'atualizadoEm') = 'object'
     OR jsonb_typeof(data->'dataRegistro') = 'object'
  
  UNION ALL
  
  SELECT 'dispensas_sptf', count(*)
  FROM public.dispensas_sptf
  WHERE jsonb_typeof(data->'emitidoEm') = 'object'
     OR jsonb_typeof(data->'data') = 'object'
  
  UNION ALL
  
  SELECT 'contracheques', count(*)
  FROM public.contracheques
  WHERE jsonb_typeof(data->'importadoEm') = 'object'
  
  UNION ALL
  
  SELECT 'insalubridade_records', count(*)
  FROM public.insalubridade_records
  WHERE jsonb_typeof(data->'criadoEm') = 'object'
     OR jsonb_typeof(data->'dataEvento') = 'object'
  
  UNION ALL
  
  SELECT 'competencias_controle', count(*)
  FROM public.competencias_controle
  WHERE jsonb_typeof(data->'fechadoEm') = 'object'
  
  UNION ALL
  
  SELECT 'admin_users', count(*)
  FROM public.admin_users
  WHERE jsonb_typeof(data->'criadoEm') = 'object'
     OR jsonb_typeof(data->'atualizadoEm') = 'object'
  
  UNION ALL
  
  SELECT 'logs_auditoria', count(*)
  FROM public.logs_auditoria
  WHERE jsonb_typeof(data->'criadoEm') = 'object'
)
SELECT tabela, total AS total_documentos_com_timestamp_firestore
FROM timestamp_checks
WHERE total > 0
ORDER BY tabela;

-- ============================================================================
-- 6. DUPLICATAS DE MATRÍCULA (CRÍTICO)
-- ============================================================================
-- Se houver múltiplos colaboradores com mesma matrícula, é um problema sério
-- Esperado ANTES e DEPOIS: 0 (ou investigar se é intenção)

SELECT 
  data->>'matricula' AS matricula,
  count(*) AS total_duplicatas
FROM public.colaboradores
WHERE data->>'matricula' IS NOT NULL
GROUP BY data->>'matricula'
HAVING count(*) > 1
ORDER BY total_duplicatas DESC;

-- ============================================================================
-- 7. RESUMO DO LOG DE NORMALIZAÇÃO
-- ============================================================================
-- Mostra quantas alterações foram registradas por tabela e campo
-- Executar APÓS a migration 010 para conferir o que foi normalizado

SELECT 
  tabela,
  campo,
  count(*) AS total_alteracoes
FROM public.logs_normalizacao
GROUP BY tabela, campo
ORDER BY tabela, campo;

-- ============================================================================
-- 8. COMPETÊNCIAS COM FORMATO INVÁLIDO (MAIS DETALHES)
-- ============================================================================
-- Listar exemplos de competências inválidas encontradas

SELECT 
  id,
  data->>'matricula' AS matricula,
  data->>'competencia' AS competencia,
  data->>'dataRegistro' AS dataRegistro,
  updated_at
FROM public.lancamentos
WHERE data->>'competencia' IS NULL
   OR data->>'competencia' !~ '^\d{4}-\d{2}$'
LIMIT 10;

-- ============================================================================
-- 9. SEDES NORMALIZADAS (AMOSTRA)
-- ============================================================================
-- Mostra alguns exemplos de sedeCodigo normalizado com sucesso

SELECT 
  id,
  data->>'sedeCodigo' AS sedeCodigo,
  data->>'sede' AS sede_original
FROM public.colaboradores
WHERE data->>'sedeCodigo' IS NOT NULL
LIMIT 10;

-- ============================================================================
-- 10. TIMESTAMPS CONVERTIDOS (AMOSTRA)
-- ============================================================================
-- Mostra exemplos de timestamps convertidos com sucesso (ISO-8601)

SELECT 
  id,
  data->>'criadoEm' AS criadoEm,
  data->>'dataRegistro' AS dataRegistro,
  updated_at
FROM public.lancamentos
WHERE (data->>'criadoEm') ~ '^\d{4}-\d{2}-\d{2}T'
LIMIT 10;

-- ============================================================================
-- FIM DO DIAGNÓSTICO
-- ============================================================================
