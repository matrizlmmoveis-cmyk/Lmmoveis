/**
 * Converte links de compartilhamento do Google Drive em links diretos de imagem.
 * Formatos suportados:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 */
export const getDirectImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  // Se não for um link do Google Drive, retorna o original
  if (!url.includes('drive.google.com')) return url;

  try {
    let fileId = '';
    
    // Regex para extrair o ID do arquivo em diversos formatos:
    // 1. /file/d/FILE_ID/view
    // 2. /file/u/0/d/FILE_ID/view
    // 3. /open?id=FILE_ID
    // 4. /uc?id=FILE_ID
    // 5. /thumbnail?id=FILE_ID
    const regexPatterns = [
      /\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/, // Formato /file/d/ID ou /file/u/0/d/ID
      /[?&]id=([a-zA-Z0-9_-]+)/,                 // Parâmetro ?id=ID ou &id=ID
    ];

    for (const pattern of regexPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        fileId = match[1];
        break;
      }
    }

    if (fileId) {
      // Usar o endpoint thumbnail com sz=w2000 costuma ser MAIS CONFIÁVEL que o /uc
      // pois o /uc às vezes falha em arquivos grandes devido ao aviso de vírus do Google.
      // E para exibição em interface, a miniatura de alta resolução (w2000) é perfeita.
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
    }
  } catch (e) {
    console.warn('Erro ao processar link do Google Drive:', e);
  }

  return url;
};
