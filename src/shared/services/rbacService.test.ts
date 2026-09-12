import { rbacService } from './rbacService';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(rbacService.canValidateInsalubrity('AUX_DA'), 'AUX_DA deve validar insalubridade como DA');
assert(rbacService.canManagePaystubs('AUX_DA'), 'AUX_DA deve gerir contracheques como DA');
assert(rbacService.canManagePaystubs('CHEFE_DA'), 'CHEFE_DA deve gerir contracheques como DA');
assert(rbacService.canViewContracheques('AUX_DA'), 'AUX_DA deve visualizar contracheques');
assert(rbacService.canViewContracheques('CHEFE_DA'), 'CHEFE_DA deve visualizar contracheques');
assert(!rbacService.canManageFolha('AUX_DA'), 'AUX_DA não deve gerenciar folha (importar/excluir)');
assert(!rbacService.canManageFolha('CHEFE_DA'), 'CHEFE_DA não deve gerenciar folha (importar/excluir)');
assert(rbacService.canManageFolha('SUPER_ADMIN'), 'SUPER_ADMIN deve gerenciar folha');
assert(rbacService.canManageFolha('RH_ADMIN'), 'RH_ADMIN deve gerenciar folha');

console.log('rbacService test ok');
