import { ENV } from '../config/env';
import type {
  DocumentItem,
  FormQuestion,
  StudentCustomProfile,
  StudentDocuments,
  StudentRegistrationPayload,
} from '../types';

export const PHOTO_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);
const DOC_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const DOC_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export interface UploadFileDescriptor {
  name?: string | null;
  mimeType?: string | null;
  type?: string | null;
  size?: number | null;
}

export function getUploadMaxBytes(kind: 'photo' | 'document'): number {
  return kind === 'photo' ? PHOTO_MAX_UPLOAD_BYTES : DOCUMENT_MAX_UPLOAD_BYTES;
}

/**
 * Resolves a backend relative or absolute media/document path into an absolute URL.
 * Mirrors the website wo() resolver and handles launchpaad.tech /public/uploads mapping.
 */
export function resolveBackendMediaUrl(
  rawPath?: string | null,
  apiBaseUrl: string = ENV.API_URL
): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const backendBase = apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  let clean = trimmed.replace(/\\/g, '/');
  while (clean.startsWith('/')) {
    clean = clean.substring(1);
  }
  if (clean.startsWith('public/')) {
    clean = clean.substring(7);
  }
  if (clean.startsWith('uploads/') && backendBase.includes('launchpaad.tech')) {
    clean = `public/${clean}`;
  }

  const encodedPath = clean.includes('%') ? clean : encodeURI(clean);
  return `${backendBase}/${encodedPath}`;
}

/**
 * Validates file type, extension, and size before starting a public upload request.
 */
export function isAllowedUploadFile(
  file: UploadFileDescriptor,
  options?: { imageOnly?: boolean; maxBytes?: number }
): { valid: boolean; reason?: string } {
  const imageOnly = Boolean(options?.imageOnly);
  const maxBytes =
    options?.maxBytes ?? (imageOnly ? PHOTO_MAX_UPLOAD_BYTES : DOCUMENT_MAX_UPLOAD_BYTES);

  if (typeof file.size === 'number' && file.size > 0 && file.size > maxBytes) {
    const limitMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return {
      valid: false,
      reason: `File size exceeds the ${limitMb} MB limit.`,
    };
  }

  const fileName = (file.name || '').trim().toLowerCase();
  const extMatch = /\.([a-z0-9]+)$/.exec(fileName);
  const ext = extMatch ? extMatch[1] : '';
  const mime = (file.mimeType || file.type || '').trim().toLowerCase();

  const allowedExtensions = imageOnly ? IMAGE_EXTENSIONS : DOC_EXTENSIONS;
  const allowedMimes = imageOnly ? IMAGE_MIME_TYPES : DOC_MIME_TYPES;

  if (ext) {
    if (!allowedExtensions.has(ext)) {
      return {
        valid: false,
        reason: imageOnly
          ? 'Unsupported photo format. Allowed types: .jpg, .jpeg, .png.'
          : 'Unsupported file type. Allowed types: .pdf, .jpg, .jpeg, .png.',
      };
    }
    return { valid: true };
  }

  if (mime) {
    if (!allowedMimes.has(mime)) {
      return {
        valid: false,
        reason: imageOnly
          ? 'Unsupported photo format. Allowed types: JPG or PNG.'
          : 'Unsupported file type. Allowed types: PDF, JPG, or PNG.',
      };
    }
    return { valid: true };
  }

  return {
    valid: false,
    reason: 'Could not determine file extension or MIME type.',
  };
}

/**
 * Sanitizes text input for dynamic form questions matching the web registration rules.
 */
export function sanitizeDynamicFieldInput(
  question: Pick<FormQuestion, 'key' | 'label' | 'type'>,
  rawValue: string
): string {
  const key = question.key || '';
  const label = question.label || '';
  const type = (question.type || '').toUpperCase();

  const isTel =
    type === 'TEL' ||
    type === 'PHONE' ||
    /phone|mobile|contact|tel/i.test(key) ||
    /phone|mobile|contact|tel/i.test(label);
  if (isTel) {
    return rawValue.replace(/[^0-9()+\- ]/g, '');
  }

  const isNumericOnly =
    (type === 'NUMBER' ||
      /\b(pin|zip|postal|age)\b/i.test(key) ||
      /\b(pin\s*code|zip\s*code|postal\s*code|age)\b/i.test(label)) &&
    !/lang/i.test(key) &&
    !/lang/i.test(label);
  if (isNumericOnly) {
    return rawValue.replace(/\D/g, '');
  }

  return rawValue;
}

/**
 * Validates and normalizes YYYY-MM-DD (also accepting DD-MM-YYYY or DD/MM/YYYY) into ISO YYYY-MM-DD.
 */
export function validateAndNormalizeDateString(
  raw: string,
  options?: { maxDate?: Date; allowFuture?: boolean }
): { valid: boolean; normalized?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Date is required (YYYY-MM-DD).' };
  }

  let year: number;
  let month: number;
  let day: number;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmyMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(trimmed);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (dmyMatch) {
    day = Number(dmyMatch[1]);
    month = Number(dmyMatch[2]);
    year = Number(dmyMatch[3]);
  } else {
    return { valid: false, error: 'Use YYYY-MM-DD format (e.g., 1998-05-14).' };
  }

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: 'Enter a valid calendar date.' };
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return { valid: false, error: 'Enter a valid calendar date.' };
  }

  const normalized = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;

  if (!options?.allowFuture) {
    const ref = options?.maxDate ?? new Date();
    const maxIso = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(
      ref.getDate()
    ).padStart(2, '0')}`;
    if (normalized > maxIso) {
      return { valid: false, error: 'Date cannot be in the future.' };
    }
  }

  return { valid: true, normalized };
}

/**
 * Normalizes NestJS / Axios error payloads into clean user-facing error lines.
 */
export function extractBackendErrorMessages(
  payload: unknown,
  fallback: string = 'An unexpected error occurred.'
): string[] {
  if (!payload || typeof payload !== 'object') {
    return [fallback];
  }

  const obj = payload as Record<string, unknown>;
  const nested = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : null;
  const candidate = obj.message ?? nested?.message ?? obj.errors ?? obj.error;

  if (Array.isArray(candidate)) {
    const cleaned = candidate
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
    if (cleaned.length > 0) return cleaned;
  }

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return [candidate.trim()];
  }

  return [fallback];
}

export interface BuildRegistrationPayloadInput {
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  organizationCode: string;
  regionId: string;
  ataStatus: string;
  countryOfCitizenship: string;
  countryLivingIn: string;
  dynamicAnswers: Record<string, string | boolean>;
  formQuestions: FormQuestion[];
  documents: StudentDocuments;
  declarationAccepted: boolean;
}

function toCleanDocumentItem(doc: DocumentItem | null | undefined): DocumentItem | undefined {
  if (!doc || !doc.url || !doc.url.trim()) return undefined;
  return {
    url: doc.url.trim(),
    name: doc.name || 'Document',
    size: typeof doc.size === 'number' ? doc.size : 0,
  };
}

/**
 * Constructs the exact POST /auth/register JSON payload expected by the backend.
 * Matches the website Bx() form submission without inventing placeholder values.
 */
export function buildStudentRegistrationPayload(
  input: BuildRegistrationPayloadInput
): StudentRegistrationPayload {
  const customProfile: Record<string, unknown> = {
    ataStatus: input.ataStatus,
    countryOfCitizenship: input.countryOfCitizenship.trim(),
    countryLivingIn: input.countryLivingIn.trim(),
    declarationAccepted: Boolean(input.declarationAccepted),
  };

  const questionMap = new Map(input.formQuestions.map((q) => [q.key, q]));

  Object.entries(input.dynamicAnswers).forEach(([key, rawVal]) => {
    if (
      key === 'declarationAccepted' ||
      key === 'countryOfCitizenship' ||
      key === 'countryLivingIn' ||
      key === 'documents' ||
      key === 'ataStatus'
    ) {
      return;
    }

    if (typeof rawVal === 'boolean') {
      customProfile[key] = rawVal;
      return;
    }

    const trimmed = typeof rawVal === 'string' ? rawVal.trim() : '';
    const q = questionMap.get(key);
    if (q?.type === 'DATE' && trimmed) {
      const dateCheck = validateAndNormalizeDateString(trimmed);
      customProfile[key] = dateCheck.normalized ?? trimmed;
    } else {
      customProfile[key] = trimmed;
    }
  });

  const cleanDocuments: StudentDocuments = {
    photo: toCleanDocumentItem(input.documents.photo),
    aadhaarFront: toCleanDocumentItem(input.documents.aadhaarFront),
    aadhaarBack: toCleanDocumentItem(input.documents.aadhaarBack),
    tenthCert: toCleanDocumentItem(input.documents.tenthCert),
    interCert: toCleanDocumentItem(input.documents.interCert),
    degreeCert: toCleanDocumentItem(input.documents.degreeCert),
    degreeTranscript: toCleanDocumentItem(input.documents.degreeTranscript),
    referenceLetter: toCleanDocumentItem(input.documents.referenceLetter),
    otherCertificates: (input.documents.otherCertificates || [])
      .map((item) => toCleanDocumentItem(item))
      .filter((item): item is DocumentItem => item !== undefined),
  };

  customProfile.documents = cleanDocuments;

  return {
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    mobile: input.mobile.trim(),
    organizationCode: input.organizationCode.trim(),
    regionId: input.regionId.trim(),
    ataStatus: input.ataStatus.trim(),
    customProfile: customProfile as unknown as StudentCustomProfile,
  };
}
