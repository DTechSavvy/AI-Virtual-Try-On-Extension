import {
  AuthResponse,
  UserSummary,
  CreateTryOnJobRequest,
  CreateTryOnJobResponse,
  TryOnJob,
  TryOnResult,
  ProfilePhotoType,
} from '@vton/shared';

const DEFAULT_API_BASE = 'http://localhost:4000/api/v1';

export interface PaginatedHistoryResponse {
  results: TryOnResult[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StoredAuthData {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

class ApiClient {
  private apiBase: string;

  constructor() {
    this.apiBase = (import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_API_BASE;
  }

  // --- Token Management via chrome.storage.local ---

  async getStoredAuth(): Promise<StoredAuthData | null> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['vton_auth'], (res) => {
          resolve(res.vton_auth || null);
        });
      });
    }
    // Fallback to localStorage for unit tests / browser tab preview
    const raw = localStorage.getItem('vton_auth');
    return raw ? JSON.parse(raw) : null;
  }

  async setStoredAuth(data: StoredAuthData | null): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        if (data) {
          chrome.storage.local.set({ vton_auth: data }, () => resolve());
        } else {
          chrome.storage.local.remove(['vton_auth'], () => resolve());
        }
      });
    }
    if (data) {
      localStorage.setItem('vton_auth', JSON.stringify(data));
    } else {
      localStorage.removeItem('vton_auth');
    }
  }

  async getAccessToken(): Promise<string | null> {
    const auth = await this.getStoredAuth();
    return auth?.accessToken || null;
  }

  // --- Base Request Method with Auto Token Refresh ---

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized by attempting token refresh
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const refreshed = await this.attemptTokenRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      let errorMsg = data?.error?.message;
      if (!errorMsg && Array.isArray(data?.invalidParams) && data.invalidParams.length > 0) {
        errorMsg = data.invalidParams.map((p: any) => p.reason || `${p.name} is invalid`).join('. ');
      }
      if (!errorMsg) {
        errorMsg = data?.detail || `HTTP ${response.status} error`;
      }
      const err = new Error(errorMsg) as any;
      err.status = response.status;
      err.code = data?.error?.code || 'API_ERROR';
      throw err;
    }

    return (data?.data ?? data) as T;
  }

  private async attemptTokenRefresh(): Promise<string | null> {
    const auth = await this.getStoredAuth();
    if (!auth?.refreshToken) {
      await this.setStoredAuth(null);
      return null;
    }

    try {
      const res = await fetch(`${this.apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      if (!res.ok) {
        await this.setStoredAuth(null);
        return null;
      }

      const body = await res.json();
      const newTokens = body.data.tokens;
      const updatedAuth: StoredAuthData = {
        ...auth,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      };

      await this.setStoredAuth(updatedAuth);
      return newTokens.accessToken;
    } catch {
      await this.setStoredAuth(null);
      return null;
    }
  }

  // --- Auth API ---

  async register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const cleanName = displayName?.trim() || undefined;
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password, displayName: cleanName }),
    });

    await this.setStoredAuth({
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
      user: res.user,
    });

    return res;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    await this.setStoredAuth({
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
      user: res.user,
    });

    return res;
  }

  async logout(): Promise<void> {
    const auth = await this.getStoredAuth();
    try {
      if (auth?.refreshToken) {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
      }
    } finally {
      await this.setStoredAuth(null);
    }
  }

  async getMe(): Promise<UserSummary> {
    const res = await this.request<{ user: UserSummary }>('/auth/me');
    return res.user;
  }

  // --- Profile API ---

  async getProfile(): Promise<any> {
    const res = await this.request<any>('/profile');
    return res.profile;
  }

  async uploadProfileAsset(photoType: ProfilePhotoType, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('photoType', photoType);
    formData.append('file', file);

    const res = await this.request<any>('/profile/assets', {
      method: 'POST',
      body: formData,
    });
    return res.asset;
  }

  // --- Virtual Try-On API ---

  async createTryOnJob(payload: CreateTryOnJobRequest): Promise<CreateTryOnJobResponse> {
    return await this.request<CreateTryOnJobResponse>('/try-on/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTryOnJobStatus(jobId: string): Promise<TryOnJob & { result?: TryOnResult }> {
    return await this.request<TryOnJob & { result?: TryOnResult }>(`/try-on/jobs/${jobId}`);
  }

  async getHistory(page: number = 1, limit: number = 12): Promise<PaginatedHistoryResponse> {
    return await this.request<PaginatedHistoryResponse>(`/try-on/history?page=${page}&limit=${limit}`);
  }

  async deleteResult(resultId: string): Promise<void> {
    await this.request(`/try-on/results/${resultId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
