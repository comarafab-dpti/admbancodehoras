/**
 * @deprecated Fase C: o fluxo de atualização periódica de colaboradores foi
 * consolidado em importacaoColaboradores.ts + classificacaoInterativa.ts.
 * Este arquivo permanece apenas para compatibilidade histórica e não deve ser usado.
 *
 * Employee Sync Service (UPSERT)
 * Handles deduplication and synchronized import from CSV and PDF paystubs
 * 
 * Features:
 * - CPF-based deduplication using SHA-256 hashing (LGPD-compliant)
 * - Bigram-based construction site matching
 * - Atomic UPSERT operations (create or update)
 */

import { collection, query, where, getDocs, doc, setDoc, updateDoc } from './db';
import { db } from './db';
import { Employee, ConstructionSite } from '../types';
import { generateCPFHash, maskCPF, cleanCPF, isValidCPF } from '../utils/lgpdUtils';
import { dbService, prepareEmployeeForDb, COLLECTIONS } from './dbService';

/**
 * Result of an employee sync operation
 */
export interface EmployeeSyncResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  employeeId: string;
  matricula: string;
  nome: string;
  message: string;
}

/**
 * Finds a construction site by matching a department/location code against bigramasImportacao
 * Matching is case-insensitive and searches the entire bigram array
 * 
 * @param departmentCode The department/location code from the import file (e.g., "DECO-KO", "KO", "MN")
 * @param constructionSites Array of construction sites to search
 * @returns The matching ConstructionSite or undefined if no match found
 * 
 * @example
 * const site = findConstructionSiteByBigram("DECO-KO", sites);
 * // Returns site where bigramasImportacao contains "DECO-KO" or "KO"
 */
export function findConstructionSiteByBigram(
  departmentCode: string | undefined,
  constructionSites: ConstructionSite[]
): ConstructionSite | undefined {
  if (!departmentCode) return undefined;

  const searchCode = departmentCode.trim().toUpperCase();
  
  return constructionSites.find(site => {
    const bigramas = site.bigramasImportacao || [];
    
    // Match against any bigram in the array (case-insensitive)
    return bigramas.some(bigram => 
      bigram.toUpperCase() === searchCode
    );
  });
}

/**
 * Searches Firestore for an existing employee by cpfHash or matricula
 * Returns the first match found
 * 
 * @param cpfHash SHA-256 hash of the cleaned CPF
 * @param matricula Employee registration number
 * @param constructionSites Array of all construction sites for caching
 * @returns Existing employee record or null
 */
export async function findExistingEmployee(
  cpfHash: string,
  matricula: string
): Promise<Employee | null> {
  try {
    // First, try to find by cpfHash (most secure)
    if (cpfHash) {
      const hashQuery = query(
        collection(db, COLLECTIONS.COLABORADORES),
        where('cpfHash', '==', cpfHash)
      );
      
      const hashDocs = await getDocs(hashQuery);
      
      if (!hashDocs.empty) {
        return hashDocs.docs[0].data() as Employee;
      }
    }

    // Fallback: try to find by matricula
    if (matricula) {
      const matQuery = query(
        collection(db, COLLECTIONS.COLABORADORES),
        where('matricula', '==', matricula)
      );
      
      const matDocs = await getDocs(matQuery);
      
      if (!matDocs.empty) {
        return matDocs.docs[0].data() as Employee;
      }
    }

    return null;
  } catch (err) {
    console.error('[findExistingEmployee] Firestore query error:', err);
    return null;
  }
}

/**
 * Performs an atomic UPSERT operation for an employee
 * 
 * Workflow:
 * 1. Validates CPF and generates hash for secure matching
 * 2. Finds construction site using departmentCode and bigramasImportacao
 * 3. Searches for existing employee by cpfHash or matricula
 * 4. If found: Updates the record, preserving original ID
 * 5. If not found: Creates new record with cpfHash, masked CPF, and canteiroId
 * 
 * @param employeeData Partial employee record from import
 * @param departmentCode Department/location code to match against bigramasImportacao
 * @param constructionSites Array of all construction sites for matching
 * @returns Result object with status, action, and details
 * 
 * @example
 * const result = await syncEmployeeUpsert(
 *   { matricula: '13974', nome: 'JOÃO SILVA', cpf: '123.456.789-01' },
 *   'DECO-KO',
 *   constructionSites
 * );
 */
export async function syncEmployeeUpsert(
  employeeData: Partial<Employee>,
  departmentCode: string | undefined,
  constructionSites: ConstructionSite[]
): Promise<EmployeeSyncResult> {
  try {
    await dbService.ensureAuthenticatedWriteSession();
    // 1. Validate and prepare data
    const matricula = (employeeData.matricula || employeeData.id || '').trim();
    const nome = (employeeData.nome || '').trim();
    const cpf = employeeData.cpf || '';

    if (!matricula || !nome) {
      return {
        success: false,
        action: 'skipped',
        employeeId: '',
        matricula: matricula || 'UNKNOWN',
        nome: nome || 'UNKNOWN',
        message: 'Matrícula e nome são obrigatórios'
      };
    }

    // 2. Generate CPF hash (LGPD-compliant)
    let cpfHash = '';
    let cpfMascarado = '***.***.***-**';
    
    if (cpf && isValidCPF(cpf)) {
      cpfHash = await generateCPFHash(cpf);
      cpfMascarado = maskCPF(cpf);
    }

    // 3. Find construction site by bigram matching
    const canteiroId = findConstructionSiteByBigram(departmentCode, constructionSites)?.id || '';

    // 4. Search for existing employee
    const existingEmployee = cpfHash 
      ? await findExistingEmployee(cpfHash, matricula)
      : await findExistingEmployee('', matricula);

    if (existingEmployee) {
      // UPDATE scenario: preserve original ID and update fields
      const rawUpdatePayload: Partial<Employee> = {
        ...existingEmployee,
        ...employeeData,
        nome, // Ensure latest name
        matricula, // Ensure latest matricula
        cpfHash: cpfHash || existingEmployee.cpfHash,
        cpfMascarado: cpfMascarado || existingEmployee.cpfMascarado,
        canteiroId: canteiroId || existingEmployee.canteiroId,
        atualizadoEm: new Date().toISOString()
      };
      const updatePayload = prepareEmployeeForDb(rawUpdatePayload);

      await updateDoc(
        doc(db, COLLECTIONS.COLABORADORES, existingEmployee.id),
        updatePayload
      );

      return {
        success: true,
        action: 'updated',
        employeeId: existingEmployee.id,
        matricula,
        nome,
        message: `Colaborador ${matricula} atualizado com sucesso`
      };
    } else {
      // CREATE scenario: generate new ID and save with security fields
      const newId = matricula || `emp-${Date.now()}`;
      
      const rawCreatePayload: Employee = {
        id: newId,
        matricula,
        nome,
        funcao: employeeData.funcao || 'Técnico de Manutenção',
        sede: employeeData.sede || 'KO',
        canteiroId,
        cpfHash,
        cpfMascarado,
        dataAdmissao: employeeData.dataAdmissao || new Date().toISOString().split('T')[0],
        status: employeeData.status || 'Ativo',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        ...employeeData
      };
      const createPayload = prepareEmployeeForDb(rawCreatePayload);

      await setDoc(
        doc(db, COLLECTIONS.COLABORADORES, newId),
        createPayload
      );

      return {
        success: true,
        action: 'created',
        employeeId: newId,
        matricula,
        nome,
        message: `Novo colaborador ${matricula} criado com sucesso`
      };
    }
  } catch (err: any) {
    console.error('[syncEmployeeUpsert] Error:', err);
    
    return {
      success: false,
      action: 'skipped',
      employeeId: '',
      matricula: employeeData.matricula || 'UNKNOWN',
      nome: employeeData.nome || 'UNKNOWN',
      message: `Erro ao sincronizar: ${err.message}`
    };
  }
}

/**
 * Batch syncs multiple employees with progress tracking
 * Useful for CSV imports and PDF payroll processing
 * 
 * @param employeesData Array of employees to sync
 * @param departmentCodesMap Map of employee ID/matricula to department code
 * @param constructionSites Array of all construction sites for matching
 * @param onProgress Optional callback for progress updates
 * @returns Array of sync results with statistics
 * 
 * @example
 * const results = await batchSyncEmployees(
 *   employeesList,
 *   { '13974': 'DECO-KO', '13975': 'KO' },
 *   sites,
 *   (progress) => console.log(`${progress.processed}/${progress.total}`)
 * );
 */
export async function batchSyncEmployees(
  employeesData: Partial<Employee>[],
  departmentCodesMap: Record<string, string | undefined>,
  constructionSites: ConstructionSite[],
  onProgress?: (progress: { processed: number; total: number; percent: number }) => void
): Promise<EmployeeSyncResult[]> {
  const results: EmployeeSyncResult[] = [];
  const total = employeesData.length;

  for (let i = 0; i < total; i++) {
    const emp = employeesData[i];
    const deptCode = departmentCodesMap[emp.matricula || emp.id || ''];
    
    const result = await syncEmployeeUpsert(emp, deptCode, constructionSites);
    results.push(result);

    if (onProgress) {
      onProgress({
        processed: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100)
      });
    }

    // Small delay to avoid Firestore rate limiting
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return results;
}

/**
 * Gets statistics from a batch of sync results
 * @param results Array of sync results
 * @returns Object with counts and summary
 */
export function getSyncStatistics(results: EmployeeSyncResult[]) {
  return {
    total: results.length,
    created: results.filter(r => r.action === 'created').length,
    updated: results.filter(r => r.action === 'updated').length,
    skipped: results.filter(r => r.action === 'skipped').length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
}

export const employeeSyncService = {
  findConstructionSiteByBigram,
  findExistingEmployee,
  syncEmployeeUpsert,
  batchSyncEmployees,
  getSyncStatistics
};
