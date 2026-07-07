import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';

export interface ManagedUser {
  sub?: string;
  username: string;
  email?: string;
  name?: string;
  enabled: boolean;
  status: string;
  roles: string[];
}

export interface CreateUserDto {
  username: string;
  email: string;
  name?: string;
  roles: string[];
}

export interface PolicyRow {
  role: string;
  permissions: string[];
}

export interface RoleCatalog {
  roles: string[];
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private apiUrl = apiPath('identity');

  constructor(private http: HttpClient) {}

  getRoleCatalog(): Observable<RoleCatalog> {
    return this.http.get<RoleCatalog>(`${this.apiUrl}/roles`);
  }

  listUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${this.apiUrl}/users`);
  }

  createUser(dto: CreateUserDto): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${this.apiUrl}/users`, dto);
  }

  setUserStatus(username: string, enabled: boolean): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(
      `${this.apiUrl}/users/${encodeURIComponent(username)}/status`,
      { enabled },
    );
  }

  setUserRoles(username: string, roles: string[]): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(
      `${this.apiUrl}/users/${encodeURIComponent(username)}/roles`,
      { roles },
    );
  }

  getPolicies(): Observable<PolicyRow[]> {
    return this.http.get<PolicyRow[]>(`${this.apiUrl}/policies`);
  }

  updatePolicies(policies: PolicyRow[]): Observable<PolicyRow[]> {
    return this.http.put<PolicyRow[]>(`${this.apiUrl}/policies`, { policies });
  }
}
