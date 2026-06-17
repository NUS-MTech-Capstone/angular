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
  mode: 'dev' | 'cognito';
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
const ID_TOKEN_KEY = 'ddm.idToken';
const PKCE_VERIFIER_KEY = 'ddm.pkceVerifier';
const OAUTH_STATE_KEY = 'ddm.oauthState';

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

  // --- Dev mode login (no AWS required) ---

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

  // --- Cognito Hosted UI login (OAuth2 authorization code + PKCE) ---

  async loginWithSso(): Promise<void> {
    const { verifier, challenge } = await this.generatePkce();
    const state = this.base64Url(crypto.getRandomValues(new Uint8Array(16)));
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(OAUTH_STATE_KEY, state);

    const cognito = environment.auth.cognito;
    const params = new URLSearchParams({
      client_id: cognito.clientId,
      response_type: 'code',
      scope: cognito.scopes,
      redirect_uri: cognito.redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    window.location.href = `${cognito.domain}/oauth2/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    if (!verifier || !expectedState || state !== expectedState) {
      throw new Error('Login state mismatch; please try again.');
    }

    const cognito = environment.auth.cognito;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognito.clientId,
      code,
      redirect_uri: cognito.redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch(`${cognito.domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error('Token exchange with Cognito failed.');
    }

    const tokens = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.id_token) {
      localStorage.setItem(ID_TOKEN_KEY, tokens.id_token);
    }
    await this.loadProfile();
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
    const profile = await firstValueFrom(
      this.http.get<AuthProfile>(apiPath('auth/me')),
    );
    const idClaims = this.decodeIdTokenClaims();
    const merged: AuthProfile = {
      ...profile,
      name: profile.name || (idClaims?.['name'] as string | undefined),
      email: profile.email || (idClaims?.['email'] as string | undefined),
    };
    this.userSignal.set(merged);
    return merged;
  }

  logout(): void {
    this.clearSession();
    if (environment.auth.mode === 'cognito') {
      const cognito = environment.auth.cognito;
      const params = new URLSearchParams({
        client_id: cognito.clientId,
        logout_uri: cognito.logoutUri,
      });
      window.location.href = `${cognito.domain}/logout?${params.toString()}`;
    } else {
      this.router.navigate(['/login']);
    }
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    this.userSignal.set(null);
  }

  // --- Helpers ---

  private decodeIdTokenClaims(): Record<string, unknown> | null {
    const idToken = localStorage.getItem(ID_TOKEN_KEY);
    if (!idToken) {
      return null;
    }
    try {
      const payload = idToken.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized));
    } catch {
      return null;
    }
  }

  private async generatePkce(): Promise<{ verifier: string; challenge: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = this.base64Url(bytes);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    );
    const challenge = this.base64Url(new Uint8Array(digest));
    return { verifier, challenge };
  }

  private base64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
