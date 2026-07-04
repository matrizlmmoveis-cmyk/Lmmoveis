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
