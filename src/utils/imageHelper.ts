/**
 * Image compression and presets helper for Incha POS products
 */

export interface ImagePreset {
  id: string;
  name: string;
  url: string;
}

export const PRESET_PRODUCT_IMAGES: ImagePreset[] = [
  {
    id: 'preset-brown-sugar',
    name: 'Brown Sugar Boba',
    url: 'https://images.unsplash.com/photo-1558857563-b37fcbf158b4?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'preset-peach-tea',
    name: 'Peach Jasmine Tea',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'preset-matcha',
    name: 'Matcha Latte Cream',
    url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'preset-oolong',
    name: 'Roasted Oolong Tea',
    url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'preset-lemon-fruit',
    name: 'Fresh Lemon Fruity',
    url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 'preset-cheese-tea',
    name: 'Cheese Foam Special',
    url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=300&q=80',
  },
];

/**
 * Kompres file gambar dari kamera HP/laptop menjadi Data URL (JPEG ringan ~15-30 KB)
 * Mencegah localStorage melebihi kuota 5-10 MB browser.
 */
export const compressImageFile = (
  file: File,
  maxDim = 320,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Background putih untuk gambar transparan PNG agar menjadi JPG rapi
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal membaca gambar'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membuka file'));
    reader.readAsDataURL(file);
  });
};
