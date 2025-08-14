import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler, createError } from '@/middleware/errorHandler';

import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { DateTime } from 'luxon';
import { AntivirusService } from '@/services/antivirusService';

const router = Router();

/**
 * Multer config
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF, JPEG, JPG, and PNG files are allowed.'));
  },
});

// All upload routes require authentication
router.use(authenticateToken);

/**
 * POST /api/upload/invoice
 * - Validates file
 * - Extracts text (PDF -> pdf-parse, image -> Tesseract)
 * - Parses amount/currency/date/vendor (heuristic)
 */
router.post(
  '/invoice',
  upload.single('invoice'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const file = req.file;
    if (!file) throw createError('No file uploaded', 400);

    const maxBytes = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
    if (file.size > maxBytes) throw createError('File too large', 413);

    if (!validateFileType(file.buffer, file.mimetype)) {
      throw createError('Invalid file format', 400);
    }

    // Antivirus scan
    const scanResult = await AntivirusService.scanFile(file.buffer, file.originalname, file.mimetype);
    if (!scanResult.isClean) {
      const recommendation = AntivirusService.getSecurityRecommendation(scanResult);
      throw createError(`Security scan failed: ${scanResult.threats.join(', ')}. ${recommendation}`, 403);
    }

    // Extract text (with Hebrew support by default)
    let text: string;
    let engine: 'pdf-parse' | 'tesseract';
    let ocrConfidence: number | undefined;

    try {
      const out = await extractText(file.buffer, file.mimetype);
      text = out.text;
      engine = out.engine;
      ocrConfidence = out.ocrConfidence;
    } catch (e: any) {
      throw createError(`Extraction failed: ${e?.message || e}`, 422);
    }

    if (!text || !text.trim()) {
      // Likely an image-only PDF if type is PDF. For now we fail closed with a clear message.
      // (If you want, I can add a PDF rasterize->OCR fallback in a follow-up.)
      if (file.mimetype === 'application/pdf') {
        throw createError(
          'No selectable text in PDF (likely a scanned image). PDF OCR fallback is not enabled yet.',
          422
        );
      }
      throw createError('Could not extract text from file', 422);
    }

    const extractedData = parseInvoiceData(text);

    // Keep payload light; store full text server-side if needed
    const textPreviewLimit = parseInt(process.env.TEXT_PREVIEW_LIMIT || '5000', 10);
    const textPreview = text.length > textPreviewLimit ? `${text.slice(0, textPreviewLimit)}…` : text;

    res.json({
      success: true,
      message: 'File uploaded and processed successfully',
      file: { originalName: file.originalname, size: file.size, type: file.mimetype },
      ocrResults: {
        engine,                    // 'pdf-parse' | 'tesseract'
        confidence: ocrConfidence, // 0..1 (images) | undefined (pdf-parse)
        text: textPreview,
        extractedData,             // { amount, currency, date, vendor }
      },
    });
  })
);

/**
 * GET /api/upload/history
 * No mocks: returns an empty list until you wire DB.
 */
router.get(
  '/history',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    res.json({
      uploads: [],
      stats: { totalUploads: 0, totalSize: 0, processingQueue: 0 },
    });
  })
);

// ---------------- Helpers ----------------

async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; engine: 'pdf-parse' | 'tesseract'; ocrConfidence?: number }> {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();

    // If very short, likely scanned; fail with explicit message (caller will throw)
    if (text.length < 20) {
      throw new Error('PDF appears to be scanned (no extractable text).');
    }
    return { text, engine: 'pdf-parse' };
  }

  // Images -> OCR (default to Hebrew+English)
  const tessLang = process.env.TESS_LANG || 'eng+heb';
  const { data } = await Tesseract.recognize(buffer, tessLang, { logger: () => {} });
  const conf = typeof data.confidence === 'number' ? data.confidence / 100 : undefined; // 0..1
  const text = (data.text || '').trim();
  return { text, engine: 'tesseract', ocrConfidence: conf };
}

function parseInvoiceData(rawText: string) {
  const text = rawText.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // ---- Amount + Currency ----
  // Handles: $1,234.56 | 1,234.56 USD | ₪ 450.00 | EUR 99,00
  const currencySymbols = ['$', '€', '£', '₪', '₪‎'];
  const currencyCodes = ['USD', 'EUR', 'GBP', 'ILS', 'NIS', 'AUD', 'CAD'];
  const currencyRegex = new RegExp(
    `(?:(${currencySymbols.map((s) => '\\' + s).join('|')})\\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)|` +
      `([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\\s*(${currencyCodes.join('|')}))`,
    'i'
  );

  let amount: string | undefined;
  let currency: string | undefined;

  const m = text.match(currencyRegex);
  if (m) {
    if (m[1] && m[2]) {
      currency = symbolToCode(m[1]);
      amount = normalizeAmount(m[2]);
    } else if (m[3] && m[4]) {
      currency = normalizeCurrencyCode(m[4]);
      amount = normalizeAmount(m[3]);
    }
  }

  // ---- Date (try several formats; return ISO) ----
  const dateCandidates = findDateCandidates(text);
  let parsedDate: string | undefined;
  for (const cand of dateCandidates) {
    const dt = tryParseDate(cand);
    if (dt) {
      parsedDate = dt;
      break;
    }
  }

  // ---- Vendor (heuristic) ----
  // Prefer first “company-like” line (not a keyword row). Works with Hebrew/English.
  let vendor: string | undefined = lines.find((l) =>
    /[A-Za-z\u0590-\u05FF]/.test(l) && // includes Hebrew range
    !/invoice|tax|total|amount|date/i.test(l) &&
    l.length >= 3 &&
    l.length <= 80
  );
  if (!vendor) {
    const idx = lines.findIndex((l) => /\b(from|supplier|vendor|billed by|issued by)\b/i.test(l));
    if (idx >= 0 && idx + 1 < lines.length) vendor = lines[idx + 1];
  }

  return { amount, currency, date: parsedDate, vendor };
}

function symbolToCode(symbol: string): string | undefined {
  switch (symbol) {
    case '$':
      return 'USD';
    case '€':
      return 'EUR';
    case '£':
      return 'GBP';
    case '₪':
    case '₪‎':
      return 'ILS';
    default:
      return undefined;
  }
}

function normalizeCurrencyCode(code: string): string {
  const upper = code.toUpperCase();
  return upper === 'NIS' ? 'ILS' : upper;
}

function normalizeAmount(raw: string): string {
  let s = raw.trim();
  // 1.234,56 -> 1234.56 (EU style)
  if (/,[0-9]{2}$/.test(s) && !/\.[0-9]{2}$/.test(s)) {
    s = s.replace(/\./g, ''); // remove thousand separators
    s = s.replace(/,/g, (m, off) => (off === s.lastIndexOf(',') ? '.' : ''));
  } else {
    // 1,234.56 -> 1234.56 (US style)
    s = s.replace(/,/g, '');
  }
  return s;
}

function findDateCandidates(text: string): string[] {
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g, // 2024-01-15
    /\b\d{2}\/\d{2}\/\d{4}\b/g, // 15/01/2024 or 01/15/2024
    /\b\d{2}\.\d{2}\.\d{4}\b/g, // 15.01.2024
    /\b\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}\b/g, // 15 January 2024
    /\b[A-Za-z]{3,}\s+\d{1,2},\s+\d{4}\b/g, // January 15, 2024
  ];
  const found: string[] = [];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) found.push(...m);
  }
  return found;
}

function tryParseDate(s: string): string | undefined {
  const fmts = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy', 'd LLLL yyyy', 'LLLL d, yyyy'];
  for (const f of fmts) {
    const dt = DateTime.fromFormat(s, f);
    if (dt.isValid) return dt.toISODate();
  }
  const iso = DateTime.fromISO(s);
  return iso.isValid ? iso.toISODate() : undefined;
}

/**
 * Magic bytes validation (defense-in-depth).
 */
function validateFileType(buffer: Buffer, mimeType: string): boolean {
  const magic = buffer.slice(0, 10);
  switch (mimeType) {
    case 'application/pdf':
      return magic.toString('ascii', 0, 4) === '%PDF';
    case 'image/jpeg':
    case 'image/jpg':
      return magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
    case 'image/png':
      return magic.toString('hex', 0, 8) === '89504e470d0a1a0a';
    default:
      return false;
  }
}

export default router;