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
    if (this.authMode === 'alb') {
      return !!this.userSignal();
    }
    return !!this.accessToken;
  }

  hasPermission(permission: string): boolean {
    return this.userSignal()?.permissions?.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.userSignal()?.roles?.includes(role) ?? false;
  }

  getAuthConfig(): Promise<AuthConfig> {
    return firstValueFrom(
      this.http.get<AuthConfig>(apiPath('auth/config')),
    );
  }

  async devLogin(username: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<{ accessToken: string }>(
        apiPath('auth/dev-login'),
        { username },
      ),
    );
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    await this.loadProfile();
  }

  loginWithAlb(): void {
    window.location.href = apiPath('auth/login');
  }

  private profileRequest: Promise<AuthProfile> | null = null;

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
    const profile = await firstValueFrom(
      this.http.get<AuthProfile>(apiPath('auth/me')),
    );
    this.userSignal.set(profile);
    return profile;
  }

  logout(): void {
    if (this.authMode === 'alb') {
      this.userSignal.set(null);
      window.location.href = apiPath('auth/logout');
      return;
    }

    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    this.userSignal.set(null);
  }
}
