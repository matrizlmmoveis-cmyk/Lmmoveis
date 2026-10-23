export const getSaoPauloDateString = (dateInput?: string | Date | number): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(d);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
};

export const formatSaoPauloDateBR = (dateInput?: string | Date | number): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Converte com segurança uma data (especialmente string YYYY-MM-DD) para Date local sem problemas de fuso horário UTC.
 */
export const parseLocalDate = (dateInput?: string | Date | number | null): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && !trimmed.includes('T')) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Formata qualquer data para padrão brasileiro DD/MM/AAAA de forma consistente.
 */
export const formatLocalDateBR = (dateInput?: string | Date | number | null): string => {
  if (!dateInput) return '—';
  const parsed = parseLocalDate(dateInput);
  if (!parsed) return '—';
  return parsed.toLocaleDateString('pt-BR');
};

/**
 * Adiciona N dias úteis (segunda a sexta-feira) a uma data base.
 */
export const addBusinessDays = (startDate: Date, businessDays: number): Date => {
  const result = new Date(startDate);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

/**
 * Calcula o limite de montagem: 6 dias úteis após a venda.
 */
export const calculateAssemblyDeadline = (saleDateInput?: string | Date | null, businessDays: number = 6): Date | null => {
  const parsed = parseLocalDate(saleDateInput);
  if (!parsed) return null;
  return addBusinessDays(parsed, businessDays);
};

export interface AssemblyDeadlineInfo {
  hasDeadline: boolean;
  deadlineDate: Date | null;
  formattedDeadline: string;
  isOverdue: boolean;
  daysRemaining: number;
  statusText: string;
  badgeClass: string;
  alertType: 'overdue' | 'today' | 'tomorrow' | 'normal' | 'pending_delivery' | 'completed';
}

/**
 * Retorna informações completas e estilização destacada para o prazo de montagem (6 dias úteis após a venda).
 */
export const getAssemblyDeadlineInfo = (
  saleDateInput?: string | Date | null,
  isCompleted?: boolean,
  completedAtInput?: string | Date | null,
  businessDays: number = 6
): AssemblyDeadlineInfo => {
  const deadline = calculateAssemblyDeadline(saleDateInput, businessDays);

  if (!deadline) {
    return {
      hasDeadline: false,
      deadlineDate: null,
      formattedDeadline: `${businessDays} dias úteis pós-venda`,
      isOverdue: false,
      daysRemaining: 0,
      statusText: 'Sem Data de Venda',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      alertType: 'pending_delivery'
    };
  }

  const formattedDeadline = deadline.toLocaleDateString('pt-BR');

  if (isCompleted) {
    let completedText = 'Montagem Concluída';
    if (completedAtInput) {
      const compDate = parseLocalDate(completedAtInput);
      if (compDate) {
        compDate.setHours(12, 0, 0, 0);
        const deadNoon = new Date(deadline);
        deadNoon.setHours(12, 0, 0, 0);
        completedText = compDate.getTime() <= deadNoon.getTime() ? 'Concluído no Prazo' : 'Concluído com Atraso';
      }
    }
    return {
      hasDeadline: true,
      deadlineDate: deadline,
      formattedDeadline,
      isOverdue: false,
      daysRemaining: 0,
      statusText: completedText,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      alertType: 'completed'
    };
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const deadlineNoon = new Date(deadline);
  deadlineNoon.setHours(12, 0, 0, 0);

  const diffMs = deadlineNoon.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      hasDeadline: true,
      deadlineDate: deadline,
      formattedDeadline,
      isOverdue: true,
      daysRemaining: diffDays,
      statusText: `Atrasado há ${overdueDays} ${overdueDays === 1 ? 'dia' : 'dias'}!`,
      badgeClass: 'bg-red-100 text-red-800 border-red-300 font-black',
      alertType: 'overdue'
    };
  } else if (diffDays === 0) {
    return {
      hasDeadline: true,
      deadlineDate: deadline,
      formattedDeadline,
      isOverdue: false,
      daysRemaining: 0,
      statusText: 'Vence Hoje!',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse',
      alertType: 'today'
    };
  } else if (diffDays === 1) {
    return {
      hasDeadline: true,
      deadlineDate: deadline,
      formattedDeadline,
      isOverdue: false,
      daysRemaining: 1,
      statusText: 'Vence amanhã',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      alertType: 'tomorrow'
    };
  } else {
    return {
      hasDeadline: true,
      deadlineDate: deadline,
      formattedDeadline,
      isOverdue: false,
      daysRemaining: diffDays,
      statusText: `${diffDays} dias restantes`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
      alertType: 'normal'
    };
  }
};

