/**
 * Compressor de imagens 100% no browser via Canvas API.
 * Converte para WebP, redimensiona para max 1200px e aplica qualidade configurável.
 * Não precisa de nenhuma biblioteca externa.
 */

interface CompressOptions {
    maxWidthOrHeight?: number;
    quality?: number; // 0 a 1
    outputType?: 'image/webp' | 'image/jpeg';
}

export async function compressImage(
    file: File,
    options: CompressOptions = {}
): Promise<File> {
    const {
        maxWidthOrHeight = 1200,
        quality = 0.75,
        outputType = 'image/webp',
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            // Calcular novas dimensões mantendo proporção
            let { width, height } = img;
            if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidthOrHeight) / width);
                    width = maxWidthOrHeight;
                } else {
                    width = Math.round((width * maxWidthOrHeight) / height);
                    height = maxWidthOrHeight;
                }
            }

            // Desenhar no canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Não foi possível criar contexto 2D no canvas.'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Exportar como blob comprimido
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Falha ao comprimir a imagem.'));
                        return;
                    }
                    // Gerar nome do arquivo com extensão correta
                    const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
                    const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
                    const compressedFile = new File([blob], name, { type: outputType });
                    resolve(compressedFile);
                },
                outputType,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Falha ao carregar a imagem para compressão.'));
        };

        img.src = objectUrl;
    });
}

/** Formata tamanho em bytes para exibição amigável */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
