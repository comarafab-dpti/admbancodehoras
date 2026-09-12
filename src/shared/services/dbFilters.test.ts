import { createClient } from '@supabase/supabase-js';
import { applyFilters, query, where, collection, db } from './db';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const supabase = createClient('https://mock-project.supabase.co', 'mock-anon-key');

console.log('--- Testando Geracao de Filtros PostgREST (Onda 2A) ---');

// 1. Consulta: getTimeRecordsByMonth (filtro em dataRegistro)
{
  const q = query(
    collection(db, 'lancamentos'),
    where('dataRegistro', '>=', '2026-09-01'),
    where('dataRegistro', '<=', '2026-09-30')
  );

  let sel = supabase.from('lancamentos').select('id, data');
  sel = applyFilters(sel, q);

  const urlSearch = decodeURIComponent((sel as any).url.search);
  console.log('[Test 1 - lancamentos]:', urlSearch);

  assert(urlSearch.includes('data->>dataRegistro=gte.2026-09-01'), 'Deve conter data->>dataRegistro=gte.2026-09-01');
  assert(urlSearch.includes('data->>dataRegistro=lte.2026-09-30'), 'Deve conter data->>dataRegistro=lte.2026-09-30');
  assert(!urlSearch.includes('>='), 'NÃO deve conter >=');
  assert(!urlSearch.includes('<='), 'NÃO deve conter <=');
}

// 2. Consulta: fetchInsalubrityRecordsByPeriod (filtro em dataEvento)
{
  const q = query(
    collection(db, 'insalubridade_records'),
    where('sede', '==', 'KO'),
    where('dataEvento', '>=', '2026-09-01'),
    where('dataEvento', '<=', '2026-09-30')
  );

  let sel = supabase.from('insalubridade_records').select('id, data');
  sel = applyFilters(sel, q);

  const urlSearch = decodeURIComponent((sel as any).url.search);
  console.log('[Test 2 - insalubridade_records]:', urlSearch);

  assert(urlSearch.includes('data->>sede=eq.KO'), 'Deve conter data->>sede=eq.KO');
  assert(urlSearch.includes('data->>dataEvento=gte.2026-09-01'), 'Deve conter data->>dataEvento=gte.2026-09-01');
  assert(urlSearch.includes('data->>dataEvento=lte.2026-09-30'), 'Deve conter data->>dataEvento=lte.2026-09-30');
  assert(!urlSearch.includes('>='), 'NÃO deve conter >=');
  assert(!urlSearch.includes('<='), 'NÃO deve conter <=');
}

// 3. Consulta: getDispensasByMonth (filtro em data)
{
  const q = query(
    collection(db, 'dispensas_sptf'),
    where('data', '>=', '2026-09-01'),
    where('data', '<=', '2026-09-30')
  );

  let sel = supabase.from('dispensas_sptf').select('id, data');
  sel = applyFilters(sel, q);

  const urlSearch = decodeURIComponent((sel as any).url.search);
  console.log('[Test 3 - dispensas_sptf]:', urlSearch);

  assert(urlSearch.includes('data->>data=gte.2026-09-01'), 'Deve conter data->>data=gte.2026-09-01');
  assert(urlSearch.includes('data->>data=lte.2026-09-30'), 'Deve conter data->>data=lte.2026-09-30');
  assert(!urlSearch.includes('>='), 'NÃO deve conter >=');
  assert(!urlSearch.includes('<='), 'NÃO deve conter <=');
}

// 4. Operadores adicionais (gt, lt, !=, in)
{
  const q = query(
    collection(db, 'teste'),
    where('valor', '>', '100'),
    where('valor', '<', '500'),
    where('status', '!=', 'CANCELADO'),
    where('tags', 'in', ['A', 'B'])
  );

  let sel = supabase.from('teste').select('id, data');
  sel = applyFilters(sel, q);

  const urlSearch = decodeURIComponent((sel as any).url.search);
  console.log('[Test 4 - outros operadores]:', urlSearch);

  assert(urlSearch.includes('data->>valor=gt.100'), 'Deve conter gt.100');
  assert(urlSearch.includes('data->>valor=lt.500'), 'Deve conter lt.500');
  assert(urlSearch.includes('data->>status=neq.CANCELADO'), 'Deve conter neq.CANCELADO');
  assert(urlSearch.includes('data->>tags=in.(A,B)'), 'Deve conter in.(A,B)');
}

console.log('✅ Todos os testes de filtros PostgREST passaram com sucesso!');
