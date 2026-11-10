import { ENV } from '../config/env';
import { ApiResponse, RequestOptions } from '../types';
import { AuthStorage } from './authStorage';

/**
 * Reusable HTTP API Client
 * 
 * Provides centralized network request handling, error boundaries, 
 * token management, and configuration validation.
 */
export class ApiClient {
  private static readonly DEFAULT_TIMEOUT_MS = 15000;

  /**
   * Helper to build standard request headers, including Bearer token if present
   */
  private static async buildHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    if (!headers['Authorization']) {
      try {
        const token = await AuthStorage.getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('[ApiClient] Failed to get access token for request headers:', err);
      }
    }

    return headers;
  }

  /**
   * Executes a network request with error handling and backend availability verification.
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit,
    customOptions?: RequestOptions,
    isRetry = false
  ): Promise<ApiResponse<T>> {
    // 1. Guard against unconfigured backend URL
    if (!ENV.IS_API_CONFIGURED || !ENV.API_URL) {
      const errorMsg = 'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env once backend details are available.';
      console.warn(`[ApiClient] Request blocked: ${errorMsg}`);
      return {
        status: 0,
        success: false,
        error: errorMsg,
      };
    }

    // 2. Format URL
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanBaseUrl = ENV.API_URL.replace(/\/+$/, '');
    const fullUrl = `${cleanBaseUrl}${cleanEndpoint}`;

    // 3. Setup timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, customOptions?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS);

    try {
      const headers = await this.buildHeaders(customOptions?.headers);
      let response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // 4. Handle 401 Unauthorized with silent token refresh
      if (
        response.status === 401 &&
        !isRetry &&
        !cleanEndpoint.includes('auth/login') &&
        !cleanEndpoint.includes('auth/register') &&
        !cleanEndpoint.includes('auth/refresh-token')
      ) {
        const savedRefreshToken = await AuthStorage.getRefreshToken();
        if (savedRefreshToken) {
          try {
            const refreshRes = await fetch(`${cleanBaseUrl}/auth/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: savedRefreshToken }),
            });
            if (refreshRes.ok) {
              const refreshJson = await refreshRes.json();
              const newAccessToken = refreshJson?.data?.accessToken || refreshJson?.accessToken;
              if (newAccessToken) {
                const currentUser = await AuthStorage.getUser();
                const currentRole = await AuthStorage.getUserRole();
                await AuthStorage.saveSession({
                  accessToken: newAccessToken,
                  refreshToken: refreshJson?.data?.refreshToken || savedRefreshToken,
                  role: currentRole || 'student',
                  user: currentUser || { id: '', fullName: '', email: '' },
                });

                // Retry original request with renewed access token
                headers['Authorization'] = `Bearer ${newAccessToken}`;
                response = await fetch(fullUrl, {
                  ...options,
                  headers,
                  signal: controller.signal,
                });
              }
            }
          } catch (refreshErr) {
            console.warn('[ApiClient] Silent token refresh failed:', refreshErr);
          }
        }
      }

      clearTimeout(timeout);

      // Handle non-JSON or empty bodies gracefully
      let parsedData: T | undefined;
      const text = await response.text();
      if (text && text.trim().length > 0) {
        try {
          parsedData = JSON.parse(text) as T;
        } catch {
          parsedData = text as unknown as T;
        }
      }

      if (!response.ok) {
        const errorData = parsedData as Record<string, unknown> | undefined;
        const backendMessage =
          (typeof errorData?.message === 'string' && errorData.message) ||
          (Array.isArray(errorData?.message) && (errorData.message as string[]).join(', ')) ||
          (typeof errorData?.error === 'string' && errorData.error) ||
          (Array.isArray(errorData?.errors) && (errorData.errors as string[]).join(', ')) ||
          `HTTP Error ${response.status}: ${response.statusText || 'Request failed'}`;

        return {
          status: response.status,
          success: false,
          data: parsedData,
          error: backendMessage,
        };
      }

      return {
        status: response.status,
        success: true,
        data: parsedData,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);

      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errorMessage = isAbort
        ? 'Request timed out'
        : err instanceof Error
        ? err.message
        : 'Network request failed';

      return {
        status: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * GET Request
   */
  public static async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, options);
  }

  /**
   * POST Request
   */
  public static async post<T, B = unknown>(
    endpoint: string,
    body: B,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      options
    );
  }

  /**
   * PUT Request
   */
  public static async put<T, B = unknown>(
    endpoint: string,
    body: B,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      options
    );
  }

  /**
   * PATCH Request
   */
  public static async patch<T, B = unknown>(
    endpoint: string,
    body: B,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      options
    );
  }

  /**
   * DELETE Request
   */
  public static async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, options);
  }

  /**
   * Multipart Form-Data Upload Request (e.g. POST /upload/public?folder=profiles)
   * Uses XMLHttpRequest to natively support React Native Expo { uri, name, type } file descriptors
   * without encountering "Unsupported FormDataPart implementation" errors.
   */
  public static async upload<T>(
    endpoint: string,
    formData: FormData,
    customOptions?: RequestOptions & {
      onProgress?: (progress: number) => void;
    }
  ): Promise<ApiResponse<T>> {
    if (!ENV.IS_API_CONFIGURED || !ENV.API_URL) {
      const errorMsg =
        'Backend API URL is not configured. Please set EXPO_PUBLIC_API_URL in .env.';
      return { status: 0, success: false, error: errorMsg };
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanBaseUrl = ENV.API_URL.replace(/\/+$/, '');
    const fullUrl = `${cleanBaseUrl}${cleanEndpoint}`;

    const token = await AuthStorage.getAccessToken();

    return new Promise<ApiResponse<T>>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', fullUrl);
      xhr.timeout = customOptions?.timeoutMs ?? 60000;

      // Add custom headers (e.g. Authorization: Bearer token).
      // DO NOT manually set Content-Type header so native layer generates the multipart boundary.
      let hasAuthHeader = false;
      if (customOptions?.headers) {
        for (const [key, value] of Object.entries(customOptions.headers)) {
          if (key.toLowerCase() !== 'content-type') {
            xhr.setRequestHeader(key, value);
            if (key.toLowerCase() === 'authorization') {
              hasAuthHeader = true;
            }
          }
        }
      }
      if (!hasAuthHeader && token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('Accept', 'application/json');

      if (xhr.upload && customOptions?.onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            customOptions.onProgress?.(event.loaded / event.total);
          }
        };
      }

      xhr.onload = () => {
        let parsedData: T | undefined;
        const text = xhr.responseText;
        if (text && text.trim().length > 0) {
          try {
            parsedData = JSON.parse(text) as T;
          } catch {
            parsedData = text as unknown as T;
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            status: xhr.status,
            success: true,
            data: parsedData,
          });
        } else {
          const errorData = parsedData as Record<string, unknown> | undefined;
          const backendMessage =
            (typeof errorData?.message === 'string' && errorData.message) ||
            (typeof errorData?.error === 'string' && errorData.error) ||
            (Array.isArray(errorData?.errors) && errorData.errors.join(', ')) ||
            `HTTP Error ${xhr.status}: ${xhr.statusText || 'Upload failed'}`;

          resolve({
            status: xhr.status,
            success: false,
            data: parsedData,
            error: backendMessage,
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          status: xhr.status || 0,
          success: false,
          error:
            'Network connection error during file upload. Please ensure your backend server is running and accessible.',
        });
      };

      xhr.ontimeout = () => {
        resolve({
          status: 408,
          success: false,
          error: 'File upload request timed out.',
        });
      };

      try {
        xhr.send(formData);
      } catch (err: unknown) {
        resolve({
          status: 0,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to send upload request',
        });
      }
    });
  }
}

export default ApiClient;
