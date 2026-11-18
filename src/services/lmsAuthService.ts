import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { ApiClient } from './api';
import { AuthStorage } from './authStorage';
import {
  ApiResponse,
  StudentRegistrationPayload,
  StudentRegistrationResponse,
  FacultyRegistrationPayload,
  LoginPayload,
  LoginResponseData,
  RegionOption,
  ProgramOption,
  FormQuestion,
  PublicSubscriptionPlan,
  DocumentItem,
  UploadResponseData,
  OrganizationInfo,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from '../types';
import { getUploadMaxBytes, isAllowedUploadFile } from '../utils/registrationHelpers';

/**
 * Resolves standard MIME types from file extensions with fallback.
 */
function getMimeType(fileName: string, fallbackMime?: string): string {
  if (fallbackMime && fallbackMime !== 'application/octet-stream') {
    return fallbackMime;
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt':
      return 'text/plain';
    case 'zip':
      return 'application/zip';
    default:
      return fallbackMime || 'application/octet-stream';
  }
}

/**
 * Builds React Native Expo compatible FormData.
 * Uses native file descriptor { uri, name, type } on Android/iOS,
 * and standard Blob on Web.
 */
export async function buildUploadFormData(file: {
  uri: string;
  name: string;
  mimeType?: string;
  fieldName?: string;
}): Promise<FormData> {
  const formData = new FormData();
  const mimeType = getMimeType(file.name, file.mimeType);
  const field = file.fieldName || 'file';

  if (Platform.OS === 'web') {
    const blobRes = await fetch(file.uri);
    const blob = await blobRes.blob();
    formData.append(field, blob, file.name || 'upload.pdf');
  } else {
    // React Native Expo native multipart descriptor
    formData.append(field, {
      uri: file.uri,
      name: file.name || 'upload.pdf',
      type: mimeType,
    } as unknown as Blob);
  }

  return formData;
}

const PUBLIC_CACHE_TTL_MS = 60_000;
const inFlightPublicRequests = new Map<string, Promise<ApiResponse<unknown>>>();
const publicResponseCache = new Map<string, { expiresAt: number; response: ApiResponse<unknown> }>();

async function fetchPublicCached<T>(
  cacheKey: string,
  fetcher: () => Promise<ApiResponse<T>>,
  forceRefresh: boolean = false
): Promise<ApiResponse<T>> {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = publicResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.response as ApiResponse<T>;
    }
    const existing = inFlightPublicRequests.get(cacheKey);
    if (existing) {
      return existing as Promise<ApiResponse<T>>;
    }
  } else {
    publicResponseCache.delete(cacheKey);
  }

  const pending = (async (): Promise<ApiResponse<T>> => {
    try {
      const result = await fetcher();
      if (result.success) {
        publicResponseCache.set(cacheKey, {
          expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS,
          response: result,
        });
      }
      return result;
    } finally {
      inFlightPublicRequests.delete(cacheKey);
    }
  })();

  inFlightPublicRequests.set(cacheKey, pending as Promise<ApiResponse<unknown>>);
  return pending;
}

function unwrapDataPayload<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return (raw as T) ?? null;
  if ('data' in raw && (raw as { data?: T }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

function extractListPayload<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as { data?: unknown; items?: unknown; results?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

async function resolveTargetOrgSlug(explicitSlug?: string): Promise<string> {
  if (explicitSlug !== undefined) {
    const trimmed = explicitSlug.trim();
    if (trimmed) return trimmed;
  }
  const stored = (await AuthStorage.getOrganizationCode())?.trim();
  if (stored && stored.toLowerCase() !== 'cotr') {
    return stored;
  }
  return ENV.DEFAULT_ORG_SLUG || 'org1';
}

async function executeUploadRequest(
  endpoint: string,
  file: { uri: string; name: string; mimeType?: string; size?: number },
  options?: {
    headers?: Record<string, string>;
    skipAuth?: boolean;
    onProgress?: (progress: number) => void;
  }
): Promise<ApiResponse<DocumentItem>> {
  if (!ENV.IS_API_CONFIGURED) {
    return {
      status: 0,
      success: false,
      error: 'Backend API URL is not configured. Cannot upload file.',
    };
  }

  try {
    const formData = await buildUploadFormData(file);
    const response = await ApiClient.upload<UploadResponseData | { data: UploadResponseData }>(
      endpoint,
      formData,
      {
        headers: options?.headers,
        skipAuth: options?.skipAuth,
        onProgress: options?.onProgress,
      }
    );

    if (response.success && response.data) {
      const payloadData = unwrapDataPayload<UploadResponseData>(response.data);
      const uploadedUrl = payloadData?.url || payloadData?.path;
      if (uploadedUrl && typeof uploadedUrl === 'string' && uploadedUrl.trim().length > 0) {
        return {
          status: response.status,
          success: true,
          data: {
            url: uploadedUrl.trim(),
            name: payloadData.name || payloadData.originalName || file.name,
            size: payloadData.size || file.size,
          },
        };
      }

      return {
        status: response.status || 500,
        success: false,
        error: 'Upload succeeded, but the server did not return a valid file URL.',
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Server rejected the file upload.',
    };
  } catch (err: unknown) {
    return {
      status: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Network error during file upload.',
    };
  }
}

/**
 * LMS Authentication & Registration Service
 * 
 * Implemented directly against 'Student LMS API Collection' Postman collection:
 * - Get Organization by Slug: GET /public/organizations/{{orgSlug}}
 * - Get Available Regions: GET /regions?slug={{orgSlug}}&localOnly=true
 * - Get Available Programs: GET /programs/public?limit=100&slug={{orgSlug}}
 * - Get Form Questions: GET /form-questions
 * - Get Subscription Plans: GET /subscription-plans/public?regionId={{regionId}}
 * - Upload Public Document: POST /upload/public?folder=profiles
 * - Complete Student Registration: POST /auth/register
 * - Login: POST /auth/login
 * - Refresh Token: POST /auth/refresh-token
 * - Logout: POST /auth/logout
 */
export const LmsAuthService = {
  /**
   * Clears cached public lookups so switching organization always fetches fresh data.
   */
  clearPublicLookupCache(): void {
    publicResponseCache.clear();
  },

  /**
   * Get Public Organization Info by Slug
   * Matches Postman: GET /public/organizations/{{orgSlug}}
   */
  async getPublicOrganization(
    slug?: string,
    options?: { forceRefresh?: boolean; persistOnSuccess?: boolean }
  ): Promise<ApiResponse<OrganizationInfo>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const cleanSlug = await resolveTargetOrgSlug(slug);
    const cacheKey = `org:${cleanSlug.toLowerCase()}`;

    return fetchPublicCached<OrganizationInfo>(
      cacheKey,
      async () => {
        try {
          const endpoint = `public/organizations/${encodeURIComponent(cleanSlug)}`;
          const response = await ApiClient.get<OrganizationInfo | { data: OrganizationInfo }>(
            endpoint,
            { skipAuth: true }
          );
          if (response.success && response.data) {
            const orgData = unwrapDataPayload<OrganizationInfo>(response.data);
            if (orgData && (orgData.slug || orgData.id)) {
              if (options?.persistOnSuccess !== false && orgData.slug) {
                await AuthStorage.setOrganizationCode(orgData.slug);
                await AuthStorage.setOrganizationDetails(orgData);
              }
              return {
                status: response.status,
                success: true,
                data: orgData,
              };
            }
          }
          return {
            status: response.status,
            success: false,
            error: response.error || `Organization "${cleanSlug}" was not found.`,
          };
        } catch (err: unknown) {
          return {
            status: 0,
            success: false,
            error: err instanceof Error ? err.message : 'Failed to retrieve organization info',
          };
        }
      },
      options?.forceRefresh
    );
  },

  /**
   * 1. Get Available Regions for Registration
   * Matches Postman: GET /regions?slug={{orgSlug}}&localOnly=true
   */
  async getAvailableRegions(
    slugOverride?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ApiResponse<RegionOption[]>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const slug = await resolveTargetOrgSlug(slugOverride);
    const cacheKey = `regions:${slug.toLowerCase()}`;

    return fetchPublicCached<RegionOption[]>(
      cacheKey,
      async () => {
        try {
          const endpoint = `regions?slug=${encodeURIComponent(slug)}&localOnly=true`;
          const response = await ApiClient.get<RegionOption[] | { data: RegionOption[] }>(
            endpoint,
            { skipAuth: true }
          );

          if (response.success) {
            const rawList = extractListPayload<RegionOption & { _id?: string }>(response.data);
            const normalized: RegionOption[] = rawList
              .map((item) => ({
                ...item,
                id: String(item.id || item._id || ''),
              }))
              .filter((item) => item.id.length > 0 && item.name);

            return {
              status: response.status,
              success: true,
              data: normalized,
            };
          }

          return {
            status: response.status,
            success: false,
            error: response.error || 'Failed to load regions for this organization.',
          };
        } catch (err: unknown) {
          return {
            status: 0,
            success: false,
            error: err instanceof Error ? err.message : 'Network error while loading regions.',
          };
        }
      },
      options?.forceRefresh
    );
  },

  /**
   * 2. Get Available Programs for Registration Dropdown / Catalog
   * Matches Postman: GET /programs/public?limit=100&slug={{orgSlug}}
   */
  async getAvailablePrograms(
    slugOverride?: string,
    options?: { limit?: number; page?: number; forceRefresh?: boolean }
  ): Promise<ApiResponse<ProgramOption[]>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const slug = await resolveTargetOrgSlug(slugOverride);
    const limit = options?.limit ?? 100;
    const pageParam = options?.page ? `&page=${encodeURIComponent(String(options.page))}` : '';
    const cacheKey = `programs:${slug.toLowerCase()}:${limit}:${options?.page ?? 1}`;

    return fetchPublicCached<ProgramOption[]>(
      cacheKey,
      async () => {
        try {
          const endpoint = `programs/public?limit=${encodeURIComponent(String(limit))}${pageParam}&slug=${encodeURIComponent(slug)}`;
          const response = await ApiClient.get<ProgramOption[] | { data: ProgramOption[] }>(
            endpoint,
            { skipAuth: true }
          );

          if (response.success) {
            const rawList = extractListPayload<ProgramOption & { _id?: string }>(response.data);
            const normalized: ProgramOption[] = rawList
              .map((item) => ({
                ...item,
                id: String(item.id || item._id || ''),
              }))
              .filter((item) => item.id.length > 0 && item.name);

            return {
              status: response.status,
              success: true,
              data: normalized,
            };
          }

          return {
            status: response.status,
            success: false,
            error: response.error || 'Failed to load available programs.',
          };
        } catch (err: unknown) {
          return {
            status: 0,
            success: false,
            error: err instanceof Error ? err.message : 'Network error while loading programs.',
          };
        }
      },
      options?.forceRefresh
    );
  },

  /**
   * 2b. Get Dynamic Registration Form Questions
   * Matches backend: GET /form-questions
   */
  async getRegistrationFormQuestions(
    options?: { forceRefresh?: boolean }
  ): Promise<ApiResponse<FormQuestion[]>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    return fetchPublicCached<FormQuestion[]>(
      'form-questions',
      async () => {
        try {
          const response = await ApiClient.get<FormQuestion[] | { data: FormQuestion[] }>(
            'form-questions',
            { skipAuth: true }
          );

          if (response.success) {
            const rawList = extractListPayload<FormQuestion>(response.data);
            const sorted = [...rawList]
              .filter((q) => q && q.key && q.isActive !== false)
              .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

            return {
              status: response.status,
              success: true,
              data: sorted,
            };
          }

          return {
            status: response.status,
            success: false,
            error: response.error || 'Failed to load admission form questions.',
          };
        } catch (err: unknown) {
          return {
            status: 0,
            success: false,
            error:
              err instanceof Error ? err.message : 'Network error while loading form questions.',
          };
        }
      },
      options?.forceRefresh
    );
  },

  /**
   * 2c. Get Public Subscription Plans by Region
   * Matches Postman: GET /subscription-plans/public?regionId={{regionId}}
   */
  async getPublicSubscriptionPlans(
    regionId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ApiResponse<PublicSubscriptionPlan[]>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const cleanRegionId = regionId.trim();
    if (!cleanRegionId) {
      return {
        status: 400,
        success: false,
        error: 'Region ID is required to fetch subscription plans.',
      };
    }

    const cacheKey = `subscription-plans:${cleanRegionId}`;
    return fetchPublicCached<PublicSubscriptionPlan[]>(
      cacheKey,
      async () => {
        try {
          const response = await ApiClient.get<
            PublicSubscriptionPlan[] | { data: PublicSubscriptionPlan[] }
          >(`subscription-plans/public?regionId=${encodeURIComponent(cleanRegionId)}`, {
            skipAuth: true,
          });

          if (response.success) {
            const list = extractListPayload<PublicSubscriptionPlan>(response.data);
            return {
              status: response.status,
              success: true,
              data: list,
            };
          }

          return {
            status: response.status,
            success: false,
            error: response.error || 'Failed to load subscription plans.',
          };
        } catch (err: unknown) {
          return {
            status: 0,
            success: false,
            error:
              err instanceof Error
                ? err.message
                : 'Network error while loading subscription plans.',
          };
        }
      },
      options?.forceRefresh
    );
  },

  /**
   * 3. Upload Public Verification Document / Photo
   * Matches Postman: POST /upload/public?folder=profiles
   * Multipart Form-data where field key is 'file'
   */
  async uploadVerificationDocument(
    file: {
      uri: string;
      name: string;
      mimeType?: string;
      size?: number;
    },
    onProgress?: (progress: number) => void,
    options?: { imageOnly?: boolean; folder?: string }
  ): Promise<ApiResponse<DocumentItem>> {
    const kind = options?.imageOnly ? 'photo' : 'document';
    const maxBytes = getUploadMaxBytes(kind);
    const validation = isAllowedUploadFile(file, {
      imageOnly: options?.imageOnly,
      maxBytes,
    });
    if (!validation.valid) {
      return {
        status: 400,
        success: false,
        error: validation.reason || 'Invalid upload file.',
      };
    }

    const folder = options?.folder || 'profiles';
    return executeUploadRequest(
      `upload/public?folder=${encodeURIComponent(folder)}`,
      file,
      { skipAuth: true, onProgress }
    );
  },

  /**
   * 4. Upload Authenticated Document / Attachment (Student or Faculty)
   * Matches Postman: POST /upload?folder=submissions
   * Multipart Form-data where field key is 'file' (Max 25MB)
   * Requires Authorization: Bearer {{token}}
   */
  async uploadAuthenticatedFile(
    file: {
      uri: string;
      name: string;
      mimeType?: string;
      size?: number;
    },
    folder: string = 'submissions',
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<DocumentItem>> {
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;
    if (file.size && file.size > MAX_SIZE_BYTES) {
      return {
        status: 400,
        success: false,
        error: `File size exceeds the 25MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`,
      };
    }

    const token = await AuthStorage.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return executeUploadRequest(
      `upload?folder=${encodeURIComponent(folder)}`,
      file,
      { headers, onProgress }
    );
  },

  /**
   * 5. Register Student
   * Matches Postman: POST /auth/register
   * Body contains: fullName, email, password, mobile, organizationCode, regionId, ataStatus, customProfile
   */
  async registerStudent(
    payload: StudentRegistrationPayload
  ): Promise<ApiResponse<StudentRegistrationResponse & { organizationCode?: string }>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    try {
      const orgCode = await resolveTargetOrgSlug(payload.organizationCode);
      const normalizedPayload: StudentRegistrationPayload = {
        ...payload,
        organizationCode: orgCode,
      };

      const response = await ApiClient.post<
        StudentRegistrationResponse | { data: StudentRegistrationResponse }
      >('auth/register', normalizedPayload, { skipAuth: true });

      if (!response.success && response.status === 0) {
        return {
          status: 0,
          success: false,
          error: `Could not connect to backend server at ${ENV.API_URL}. Please ensure your network connection is active.`,
        };
      }

      if (response.success) {
        await AuthStorage.setOrganizationCode(orgCode);
        const unwrapped = unwrapDataPayload<StudentRegistrationResponse>(response.data) || {};
        const topObj = (response.data || {}) as StudentRegistrationResponse & {
          data?: StudentRegistrationResponse;
        };

        const msg =
          (typeof topObj.message === 'string' && topObj.message) ||
          (typeof unwrapped.message === 'string' && unwrapped.message) ||
          'Registration successful. Awaiting interview & admin approval.';

        return {
          status: response.status,
          success: true,
          data: {
            ...unwrapped,
            message: msg,
            organizationCode: orgCode,
          },
        };
      }

      return {
        status: response.status,
        success: false,
        error: response.error || 'Registration failed. Please review your details and try again.',
      };
    } catch (err: unknown) {
      return {
        status: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Registration request failed.',
      };
    }
  },

  /**
   * 5. Login Student
   * Matches Postman: POST /auth/login
   */
  async loginStudent(
    email: string,
    password: string,
    organizationCode?: string
  ): Promise<ApiResponse<LoginResponseData>> {
    const orgCodeRaw = organizationCode?.trim() || ENV.DEFAULT_ORG_SLUG || 'org1';
    const orgCode = orgCodeRaw.toLowerCase() === 'cotr' ? 'org1' : orgCodeRaw;

    const payload: LoginPayload = {
      email: email.trim(),
      password,
      organizationCode: orgCode,
    };

    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const response = await ApiClient.post<LoginResponseData | { data: LoginResponseData }>('auth/login', payload);

    if (!response.success && response.status === 0) {
      return {
        status: 0,
        success: false,
        error: `Could not connect to Global LMS backend server at ${ENV.API_URL}. Please check your network connection and try again.`,
      };
    }

    if (response.success && response.data) {
      const rawData = response.data;
      const authData: LoginResponseData | undefined =
        rawData && 'accessToken' in rawData && typeof (rawData as LoginResponseData).accessToken === 'string'
          ? (rawData as LoginResponseData)
          : rawData && 'data' in rawData && (rawData as { data: LoginResponseData }).data?.accessToken
            ? (rawData as { data: LoginResponseData }).data
            : undefined;

      if (authData?.accessToken) {
        const userRole = (authData.user?.role || authData.user?.userType || '').toUpperCase();
        // Role validation: Prevent faculty members from logging in via student portal
        if (userRole === 'FACULTY' || userRole === 'INSTRUCTOR' || userRole === 'PROFESSOR') {
          return {
            status: 403,
            success: false,
            error: 'This account has Faculty privileges. Please sign in through the Faculty Portal.',
          };
        }

        await AuthStorage.setOrganizationCode(orgCode);
        await AuthStorage.saveSession({
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          role: 'student',
          user: authData.user,
        });

        return {
          status: response.status,
          success: true,
          data: authData,
        };
      }
    }

    return response as ApiResponse<LoginResponseData>;
  },

  /**
   * 6. Register Faculty
   */
  async registerFaculty(
    payload: FacultyRegistrationPayload
  ): Promise<ApiResponse<{ message: string; faculty?: unknown }>> {
    if (!ENV.IS_API_CONFIGURED) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 201,
            success: true,
            data: {
              message: 'Faculty registered successfully (Frontend Preview Mode)',
              faculty: {
                fullName: payload.fullName,
                email: payload.email,
                specialization: payload.specialization,
              },
            },
          });
        }, 800);
      });
    }

    const response = await ApiClient.post<{ message: string; faculty?: unknown }>(
      'faculty/auth/register',
      payload
    );

    if (!response.success && response.status === 404) {
      return {
        status: 404,
        success: false,
        error: 'Backend endpoint POST /api/v1/faculty/auth/register is pending implementation by backend team.',
      };
    }

    return response;
  },

  /**
   * 7. Login Faculty
   * Matches Postman: POST /auth/login
   */
  async loginFaculty(
    email: string,
    password: string,
    organizationCode?: string
  ): Promise<ApiResponse<LoginResponseData>> {
    const orgCodeRaw = organizationCode?.trim() || ENV.DEFAULT_ORG_SLUG || 'org1';
    const orgCode = orgCodeRaw.toLowerCase() === 'cotr' ? 'org1' : orgCodeRaw;

    const payload: LoginPayload = {
      email: email.trim(),
      password,
      organizationCode: orgCode,
    };

    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    // Connects to POST /auth/login matching the Postman collection
    const response = await ApiClient.post<LoginResponseData | { data: LoginResponseData }>('auth/login', payload);

    if (!response.success && response.status === 0) {
      return {
        status: 0,
        success: false,
        error: `Could not connect to Global LMS backend server at ${ENV.API_URL}. Please check your network connection and try again.`,
      };
    }

    if (response.success && response.data) {
      const rawData = response.data;
      const authData: LoginResponseData | undefined =
        rawData && 'accessToken' in rawData && typeof (rawData as LoginResponseData).accessToken === 'string'
          ? (rawData as LoginResponseData)
          : rawData && 'data' in rawData && (rawData as { data: LoginResponseData }).data?.accessToken
            ? (rawData as { data: LoginResponseData }).data
            : undefined;

      if (authData?.accessToken) {
        const userRole = (authData.user?.role || authData.user?.userType || '').toUpperCase();
        // Role validation: Prevent student accounts from logging in via faculty portal
        if (userRole === 'STUDENT' || userRole === 'APPLICANT') {
          return {
            status: 403,
            success: false,
            error: 'This account is registered as a Student. Please sign in through the Student Portal.',
          };
        }

        await AuthStorage.saveSession({
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          role: 'faculty',
          user: authData.user,
        });

        return {
          status: response.status,
          success: true,
          data: authData,
        };
      }
    }

    return response as ApiResponse<LoginResponseData>;
  },

  /**
   * Static Login for Student (Offline / Demo Mode)
   * Logs in immediately without backend network calls.
   */
  async staticLoginStudent(
    email: string = 'vasupallivarsha@gmail.com',
    fullName?: string
  ): Promise<ApiResponse<LoginResponseData>> {
    const rawName = email.split('@')[0] || 'Student';
    const computedName =
      fullName ||
      rawName
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const mockData: LoginResponseData = {
      accessToken: 'static_mock_student_jwt_token_' + Date.now(),
      refreshToken: 'static_mock_student_refresh_token',
      user: {
        id: 'student-static-id',
        fullName: computedName,
        email: email.trim(),
        role: 'STUDENT',
      },
    };

    await AuthStorage.saveSession({
      accessToken: mockData.accessToken,
      refreshToken: mockData.refreshToken,
      role: 'student',
      user: mockData.user,
    });

    return {
      status: 200,
      success: true,
      data: mockData,
    };
  },

  /**
   * Static Login for Faculty (Offline / Demo Mode)
   * Logs in immediately without backend network calls.
   */
  async staticLoginFaculty(
    email: string = 'faculty@cotr.edu',
    fullName?: string
  ): Promise<ApiResponse<LoginResponseData>> {
    const rawName = email.split('@')[0] || 'Professor';
    const computedName =
      fullName ||
      rawName
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const mockData: LoginResponseData = {
      accessToken: 'static_mock_faculty_jwt_token_' + Date.now(),
      refreshToken: 'static_mock_faculty_refresh_token',
      user: {
        id: 'faculty-static-id',
        fullName: computedName,
        email: email.trim(),
        role: 'FACULTY',
      },
    };

    await AuthStorage.saveSession({
      accessToken: mockData.accessToken,
      refreshToken: mockData.refreshToken,
      role: 'faculty',
      user: mockData.user,
    });

    return {
      status: 200,
      success: true,
      data: mockData,
    };
  },

  /**
   * 8. Change Password for Authenticated User
   * Matches Postman: POST /auth/change-password
   * Security: Never logs passwords or request payloads.
   */
  async changePassword(
    requestData: ChangePasswordPayload
  ): Promise<ApiResponse<ChangePasswordResponse>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    const accessToken = await AuthStorage.getAccessToken();
    if (!accessToken) {
      return {
        status: 401,
        success: false,
        error: 'Your session has expired. Please sign in again to change your password.',
      };
    }

    const response = await ApiClient.post<
      ChangePasswordResponse | { data?: ChangePasswordResponse; message?: string }
    >('auth/change-password', {
      old_password: requestData.old_password,
      new_password: requestData.new_password,
    });

    if (response.success) {
      const raw = response.data as
        | { message?: string; data?: { message?: string } }
        | undefined;
      const message =
        (typeof raw?.message === 'string' && raw.message.trim()) ||
        (typeof raw?.data?.message === 'string' && raw.data.message.trim()) ||
        'Password updated successfully.';
      return {
        status: response.status,
        success: true,
        data: { message },
      };
    }

    return {
      status: response.status,
      success: false,
      error: response.error || 'Unable to change password. Please verify your current password.',
    };
  },

  /**
   * 9. Logout User
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await AuthStorage.getRefreshToken();
      if (ENV.IS_API_CONFIGURED && refreshToken) {
        await ApiClient.post('auth/logout', { refreshToken });
      }
    } catch (e) {
      console.warn('[LmsAuthService] Logout API request ignored:', e);
    } finally {
      await AuthStorage.clearSession();
    }
  },
};

export default LmsAuthService;
