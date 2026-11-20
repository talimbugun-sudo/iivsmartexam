import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

async function compressImageToBlob(
  file: File,
  maxDimension = 640,
  quality = 0.8,
): Promise<{ blob: Blob; dataUrl: string }> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Rasmni qayta ishlash konteksti topilmadi.');
  }
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Rasmni siqishda xatolik yuz berdi.'));
      },
      'image/jpeg',
      quality,
    );
  });

  return { blob, dataUrl };
}

export async function uploadImageAsset(file: File, folder: 'students' | 'questions'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Faqat rasm fayllarini (JPG, PNG, WEBP) yuklash mumkin.');
  }

  const maxDim = folder === 'students' ? 480 : 960;
  const { blob, dataUrl } = await compressImageToBlob(file, maxDim, 0.82);

  try {
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (storageError) {
    // Graceful fallback if Firebase Storage rules require console activation
    console.warn('Storage upload fallback to compressed data URL:', storageError);
    if (dataUrl.length > 480000) {
      const tighter = await compressImageToBlob(file, 360, 0.65);
      return tighter.dataUrl;
    }
    return dataUrl;
  }
}
