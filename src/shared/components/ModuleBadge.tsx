import React from 'react';
import { Shield } from 'lucide-react';

export interface ModuleBadgeProps {
  tipo: 'admin';
  className?: string;
  size?: 'sm' | 'md';
}

export const ModuleBadge: React.FC<ModuleBadgeProps> = ({ 
  tipo, 
  className = '', 
  size = 'md' 
}) => {
  const isSm = size === 'sm';

  return (
    <span
      id="badge-module-admin"
      className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider rounded-md border shadow-xs select-none transition-colors ${
        isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } bg-amber-500/15 text-amber-300 border-amber-500/30 ${className}`}
      title="Ambiente Administrativo e de Gestão SPTF"
    >
      <Shield className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-400 shrink-0`} />
      <span>ADMINISTRATIVO</span>
    </span>
  );
};
