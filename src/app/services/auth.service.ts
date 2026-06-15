import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { apiPath } from '../core/api.constants';

export interface AuthProfile {
  sub: string;
  username: string;
  email?: string;
  name?: string;
  roles: string[];
  permissions: string[];
}

export interface DevUserOption {
  username: string;
  name: string;
  roles: string[];
}

export interface AuthConfig {
  mode: 'dev' | 'alb';
  devUsers: DevUserOption[];
}

export const ALL_ROLES = [
  'Employee',
  'TechnicalStaff',
  'Manager',
  'SecurityAnalyst',
  'Auditor',
  'Admin',
];

const ACCESS_TOKEN_KEY = 'ddm.accessToken';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private userSignal = signal<AuthProfile | null>(null);
  readonly user = this.userSignal.asReadonly();

  readonly authMode = environment.auth.mode;

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get isAuthenticated(): boolean {
    return this.authMode === 'alb' || !!this.accessToken;
  }

  hasPermission(permission: string): boolean {
    return this.userSignal()?.permissions?.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.userSignal()?.roles?.includes(role) ?? false;
  }

  getAuthConfig(): Promise<AuthConfig> {
    return firstValueFrom(this.http.get<AuthConfig>(apiPath('auth/config')));
  }

  // --- Dev mode login (no AWS required) ---

  async devLogin(username: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ accessToken: string }>(apiPath('auth/dev-login'), { username }),
    );
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    await this.loadProfile();
  }

  loginWithSso(): void {
    window.location.assign('/ddm/auth/login');
  }

  // --- Session ---

  private profileRequest: Promise<AuthProfile> | null = null;

  /**
   * Returns the cached profile, or loads it once. Concurrent callers
   * (e.g. authGuard and permissionGuard on the same route) share one request.
   */
  ensureProfileLoaded(): Promise<AuthProfile> {
    const current = this.userSignal();
    if (current) {
      return Promise.resolve(current);
    }
    if (!this.profileRequest) {
      this.profileRequest = this.loadProfile().finally(() => {
        this.profileRequest = null;
      });
    }
    return this.profileRequest;
  }

  async loadProfile(): Promise<AuthProfile> {
    const profile = await firstValueFrom(this.http.get<AuthProfile>(apiPath('auth/me')));
    this.userSignal.set(profile);
    return profile;
  }

  logout(): void {
    this.clearSession();
    if (this.authMode === 'alb') {
      window.location.assign('/ddm/auth/logout');
    } else {
      this.router.navigate(['/login']);
    }
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    this.userSignal.set(null);
  }
}
