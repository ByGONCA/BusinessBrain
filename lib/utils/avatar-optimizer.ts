/**
 * Client-side avatar optimization utility for BusinessBrain.
 * 
 * - Validates file types and sizes.
 * - Center-crops to square aspect ratio (1:1).
 * - Scales to max 256x256 resolution.
 * - Compresses to modern WebP format (with JPEG fallback) at ~82% quality.
 * - Strips EXIF metadata automatically to ensure privacy and minimal byte footprint.
 * - Resulting data URL is only ~8 KB - 25 KB, keeping database and network overhead near zero.
 */
export async function optimizeAvatarImage(
  file: File,
  maxDimension = 256,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Por favor seleciona um ficheiro de imagem válido (PNG, JPEG, WebP, GIF).");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A imagem selecionada é demasiado grande (máximo 10 MB antes da otimização).");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler o ficheiro selecionado."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Não foi possível inicializar o processador gráfico do navegador."));
          }

          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          const minSide = Math.min(width, height);

          // Center square crop coordinates
          const sx = (width - minSide) / 2;
          const sy = (height - minSide) / 2;

          const targetSize = Math.min(minSide, maxDimension);
          canvas.width = targetSize;
          canvas.height = targetSize;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

          // WebP format check with JPEG fallback
          let dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
