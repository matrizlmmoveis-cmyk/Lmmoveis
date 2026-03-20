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
    
    // Caso 1: /file/d/FILE_ID/view
    if (url.includes('/file/d/')) {
      fileId = url.split('/file/d/')[1].split('/')[0].split('?')[0];
    } 
    // Caso 2: ?id=FILE_ID ou &id=FILE_ID
    else if (url.includes('id=')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      fileId = urlParams.get('id') || '';
    }

    if (fileId) {
      // Retorna o link direto usando o endpoint uc
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  } catch (e) {
    console.error('Erro ao processar link do Google Drive:', e);
  }

  return url;
};
