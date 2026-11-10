import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { ApiClient } from './api';
import { AuthStorage } from './authStorage';
import {
  ApiResponse,
  StudentRegistrationPayload,
  FacultyRegistrationPayload,
  LoginPayload,
  LoginResponseData,
  RegionOption,
  ProgramOption,
  DocumentItem,
  UploadResponseData,
  OrganizationInfo,
} from '../types';

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
    default:
      return fallbackMime || 'application/octet-stream';
  }
}

/**
 * Builds React Native Expo compatible FormData.
 * Uses native file descriptor { uri, name, type } on Android/iOS,
 * and standard Blob on Web.
 */
async function buildUploadFormData(file: {
  uri: string;
  name: string;
  mimeType?: string;
}): Promise<FormData> {
  const formData = new FormData();
  const mimeType = getMimeType(file.name, file.mimeType);

  if (Platform.OS === 'web') {
    const blobRes = await fetch(file.uri);
    const blob = await blobRes.blob();
    formData.append('file', blob, file.name || 'upload.jpg');
  } else {
    // React Native Expo native multipart descriptor
    formData.append('file', {
      uri: file.uri,
      name: file.name || 'upload.jpg',
      type: mimeType,
    } as unknown as Blob);
  }

  return formData;
}

/**
 * LMS Authentication & Registration Service
 * 
 * Implemented directly against 'Student LMS API Collection' Postman collection:
 * - Complete Student Registration: POST /auth/register
 * - Get Available Regions: GET /regions?slug={{orgSlug}}&localOnly=true
 * - Get Available Programs: GET /programs/public?limit=100&slug={{orgSlug}}
 * - Upload Public Document: POST /upload/public?folder=profiles
 * - Login: POST /auth/login
 * - Refresh Token: POST /auth/refresh-token
 * - Logout: POST /auth/logout
 */
export const LmsAuthService = {
  /**
   * Get Public Organization Info by Slug
   * Matches Postman: GET /public/organizations/{{orgSlug}}
   */
  async getPublicOrganization(slug?: string): Promise<ApiResponse<OrganizationInfo>> {
    const storedSlug = await AuthStorage.getOrganizationCode();
    const rawSlug = slug?.trim() || storedSlug || ENV.DEFAULT_ORG_SLUG || 'org1';
    const cleanSlug = rawSlug.toLowerCase() === 'cotr' ? 'org1' : rawSlug;
    const endpoint = `public/organizations/${encodeURIComponent(cleanSlug)}`;

    try {
      const response = await ApiClient.get<OrganizationInfo | { data: OrganizationInfo }>(endpoint);
      if (response.success && response.data) {
        const orgData =
          'data' in response.data && (response.data as { data: OrganizationInfo }).data
            ? (response.data as { data: OrganizationInfo }).data
            : (response.data as OrganizationInfo);

        if (orgData && orgData.slug) {
          await AuthStorage.setOrganizationCode(orgData.slug);
          await AuthStorage.setOrganizationDetails(orgData);
          return {
            status: response.status,
            success: true,
            data: orgData,
          };
        }
      }
      return response as ApiResponse<OrganizationInfo>;
    } catch (err: unknown) {
      return {
        status: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve organization info',
      };
    }
  },

  /**
   * 1. Get Available Regions for Registration
   * Matches Postman: GET /regions?slug={{orgSlug}}&localOnly=true
   */
  async getAvailableRegions(slugOverride?: string): Promise<ApiResponse<RegionOption[]>> {
    const storedSlug = await AuthStorage.getOrganizationCode();
    const rawSlug = slugOverride?.trim() || storedSlug || ENV.DEFAULT_ORG_SLUG || 'org1';
    const slug = rawSlug.toLowerCase() === 'cotr' ? 'org1' : rawSlug;
    const endpoint = `regions?slug=${encodeURIComponent(slug)}&localOnly=true`;

    const defaultFallbackRegions: RegionOption[] = [
      { id: 'reg-india-south', name: 'India - Southern Region (AP, TS, TN, KA, KL)' },
      { id: 'reg-india-north', name: 'India - Northern & Central Region' },
      { id: 'reg-india-ne', name: 'India - North East Region' },
      { id: 'reg-international', name: 'International / Global Online' },
    ];

    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 200,
        success: true,
        data: defaultFallbackRegions,
      };
    }

    try {
      const response = await ApiClient.get<RegionOption[] | { data: RegionOption[] }>(endpoint);

      if (response.success && response.data) {
        // Backend might wrap list inside response.data.data
        const raw = response.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: RegionOption[] }).data)
            ? (raw as { data: RegionOption[] }).data
            : defaultFallbackRegions;

        return {
          status: response.status,
          success: true,
          data: list.length > 0 ? list : defaultFallbackRegions,
        };
      }

      // Fallback on network or 404 error during development
      return {
        status: 200,
        success: true,
        data: defaultFallbackRegions,
      };
    } catch {
      return {
        status: 200,
        success: true,
        data: defaultFallbackRegions,
      };
    }
  },

  /**
   * 2. Get Available Programs for Registration Dropdown
   * Matches Postman: GET /programs/public?limit=100&slug={{orgSlug}}
   */
  async getAvailablePrograms(slugOverride?: string): Promise<ApiResponse<ProgramOption[]>> {
    const storedSlug = await AuthStorage.getOrganizationCode();
    const rawSlug = slugOverride?.trim() || storedSlug || ENV.DEFAULT_ORG_SLUG || 'org1';
    const slug = rawSlug.toLowerCase() === 'cotr' ? 'org1' : rawSlug;
    const endpoint = `programs/public?limit=100&slug=${encodeURIComponent(slug)}`;

    const defaultFallbackPrograms: ProgramOption[] = [
      { id: 'prog-bth', name: 'Bachelor of Theology (B.Th)' },
      { id: 'prog-mdiv', name: 'Master of Divinity (M.Div)' },
      { id: 'prog-dipth', name: 'Diploma in Theology (Dip.Th)' },
      { id: 'prog-mth', name: 'Master of Theology (M.Th)' },
      { id: 'prog-cert-ministry', name: 'Certificate in Christian Ministry' },
    ];

    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 200,
        success: true,
        data: defaultFallbackPrograms,
      };
    }

    try {
      const response = await ApiClient.get<ProgramOption[] | { data: ProgramOption[] }>(endpoint);

      if (response.success && response.data) {
        const raw = response.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: ProgramOption[] }).data)
            ? (raw as { data: ProgramOption[] }).data
            : defaultFallbackPrograms;

        return {
          status: response.status,
          success: true,
          data: list.length > 0 ? list : defaultFallbackPrograms,
        };
      }

      return {
        status: 200,
        success: true,
        data: defaultFallbackPrograms,
      };
    } catch {
      return {
        status: 200,
        success: true,
        data: defaultFallbackPrograms,
      };
    }
  },

  /**
   * 3. Upload Public Verification Document / Photo
   * Matches Postman: POST /upload/public?folder=profiles
   * Multipart Form-data where field key is 'file' (Max 5MB)
   */
  async uploadVerificationDocument(file: {
    uri: string;
    name: string;
    mimeType?: string;
    size?: number;
  }, onProgress?: (progress: number) => void): Promise<ApiResponse<DocumentItem>> {
    // 5MB max check as documented in Postman collection
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size && file.size > MAX_SIZE_BYTES) {
      return {
        status: 400,
        success: false,
        error: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`,
      };
    }

    if (!ENV.IS_API_CONFIGURED) {
      // Offline / Local preview fallback only when backend is intentionally unconfigured
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 201,
            success: true,
            data: {
              url: `/uploads/profiles/${file.name}`,
              name: file.name,
              size: file.size || 250000,
            },
          });
        }, 500);
      });
    }

    try {
      const formData = await buildUploadFormData(file);

      const response = await ApiClient.upload<UploadResponseData | { data: UploadResponseData }>(
        'upload/public?folder=profiles',
        formData,
        { onProgress }
      );

      if (response.success && response.data) {
        const payloadData =
          'data' in response.data && (response.data as { data: UploadResponseData }).data
            ? (response.data as { data: UploadResponseData }).data
            : (response.data as UploadResponseData);

        return {
          status: response.status,
          success: true,
          data: {
            url: payloadData.url || `/uploads/profiles/${file.name}`,
            name: payloadData.name || payloadData.originalName || file.name,
            size: payloadData.size || file.size,
          },
        };
      }

      // Return server rejection error without silently masking with preview data
      return {
        status: response.status,
        success: false,
        error: response.error || 'Server rejected the file upload.',
      };
    } catch (err: unknown) {
      return {
        status: 0,
        success: false,
        error: err instanceof Error ? err.message : 'Network error during file upload',
      };
    }
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
    const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB as per Postman
    if (file.size && file.size > MAX_SIZE_BYTES) {
      return {
        status: 400,
        success: false,
        error: `File size exceeds the 25MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`,
      };
    }

    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 201,
        success: true,
        data: {
          url: `/uploads/${folder}/${file.name}`,
          name: file.name,
          size: file.size || 500000,
        },
      };
    }

    try {
      const token = await AuthStorage.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const formData = await buildUploadFormData(file);
      const endpoint = `upload?folder=${encodeURIComponent(folder)}`;

      const response = await ApiClient.upload<UploadResponseData | { data: UploadResponseData }>(
        endpoint,
        formData,
        { headers, onProgress }
      );

      if (response.success && response.data) {
        const payloadData =
          'data' in response.data && (response.data as { data: UploadResponseData }).data
            ? (response.data as { data: UploadResponseData }).data
            : (response.data as UploadResponseData);

        return {
          status: response.status,
          success: true,
          data: {
            url: payloadData.url || `/uploads/${folder}/${file.name}`,
            name: payloadData.name || payloadData.originalName || file.name,
            size: payloadData.size || file.size,
          },
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
        error: err instanceof Error ? err.message : 'Network error during file upload',
      };
    }
  },

  /**
   * 4. Register Student
   * Matches Postman: POST /auth/register
   * Body contains: fullName, email, password, mobile, organizationCode, regionId, ataStatus, customProfile
   */
  async registerStudent(
    payload: StudentRegistrationPayload
  ): Promise<ApiResponse<{ message: string; user?: unknown; organizationCode?: string }>> {
    if (!ENV.IS_API_CONFIGURED) {
      return {
        status: 0,
        success: false,
        error: 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.',
      };
    }

    try {
      const orgCodeRaw = payload.organizationCode?.trim() || (await AuthStorage.getOrganizationCode()) || ENV.DEFAULT_ORG_SLUG || 'org1';
      const orgCode = orgCodeRaw.toLowerCase() === 'cotr' ? 'org1' : orgCodeRaw;
      const normalizedPayload: StudentRegistrationPayload = {
        ...payload,
        organizationCode: orgCode,
      };

      const response = await ApiClient.post<{ message: string; user?: unknown; data?: { message?: string } }>('auth/register', normalizedPayload);

      // If backend fails due to network
      if (!response.success && response.status === 0) {
        return {
          status: 0,
          success: false,
          error: `Could not connect to backend server at ${ENV.API_URL}. Please ensure your network connection is active.`,
        };
      }

      if (response.success) {
        // Save the valid registered organization code for future logins
        await AuthStorage.setOrganizationCode(orgCode);

        const respData = response.data;
        const msg =
          (respData && 'message' in respData && typeof respData.message === 'string' && respData.message) ||
          (respData && 'data' in respData && typeof respData.data?.message === 'string' && respData.data.message) ||
          'Registration successful. Awaiting interview & admin approval.';

        return {
          status: response.status,
          success: true,
          data: {
            message: msg,
            user: respData?.user,
            organizationCode: orgCode,
          },
        };
      }

      return response as ApiResponse<{ message: string; user?: unknown; organizationCode?: string }>;
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
   * 8. Logout User
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
