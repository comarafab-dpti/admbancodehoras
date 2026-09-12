-- COMARA — Fase 3: índices compostos para listagens paginadas
-- Não altera RLS, policies ou o modelo documental.

create index if not exists idx_colaboradores_sede_status
  on public.colaboradores ((data->>'sedeCodigo'), (data->>'status'));

create index if not exists idx_lancamentos_sede_competencia
  on public.lancamentos ((data->>'employeeSede'), (data->>'competencia'));

create index if not exists idx_lancamentos_matricula_competencia
  on public.lancamentos ((data->>'matricula'), (data->>'competencia'));

create index if not exists idx_dispensas_sede_competencia
  on public.dispensas_sptf ((data->>'employeeSede'), (data->>'competencia'));

create index if not exists idx_dispensas_data
  on public.dispensas_sptf ((data->>'data'));

create index if not exists idx_contracheques_matricula_competencia
  on public.contracheques ((data->>'matricula'), (data->>'competencia'));

create index if not exists idx_insalubridade_sede_competencia
  on public.insalubridade_records ((data->>'sede'), (data->>'competencia'));
