import { createWorker } from 'tesseract.js';
import german from '@tesseract.js-data/deu';
import { purchaseFields } from './receipt-text';

export async function readPurchase(content: string) {
  const worker = await createWorker('deu', 1, { langPath: german.langPath, cacheMethod: 'none', errorHandler: () => { /* errors reject the active OCR request */ } });
  try {
    const { data } = await worker.recognize(Buffer.from(content, 'base64'));
    return purchaseFields(data.text);
  } finally { await worker.terminate(); }
}
