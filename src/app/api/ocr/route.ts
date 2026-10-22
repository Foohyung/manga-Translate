import { OCR_MAX_UPLOAD_BYTES } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { isSourceLanguage } from '@/lib/languages';
import { recognizeWithOcrSpace } from '@/server/ocr-space';

export const maxDuration = 60;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const image = form?.get('file');
  const language = form?.get('language');

  if (!(image instanceof File) || !isSourceLanguage(language)) {
    return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
  }
  if (image.size > OCR_MAX_UPLOAD_BYTES) {
    return Response.json({ error: 'ไฟล์ภาพต้องมีขนาดไม่เกิน 1 MB' }, { status: 413 });
  }

  try {
    return Response.json({ lines: await recognizeWithOcrSpace(image, language) });
  } catch (error) {
    console.error('OCR failed:', error);
    return Response.json({ error: errorMessage(error, 'อ่านข้อความจากภาพไม่สำเร็จ') }, { status: 502 });
  }
}
