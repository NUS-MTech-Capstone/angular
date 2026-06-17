import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';

export interface SessionRecord {
  id: string;
  hostId: string;
  hostname: string;
  ipAddress?: string;
  sshPort?: number;
  crId?: string;
  crNumber?: string;
  osUser: string;
  createdBy: string;
  /** active | ended | disconnected */
  status: string;
  startedAt: string;
  endedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
}

export interface SessionStartResponse {
  websocketUrl: string;
  sessionToken: string;
  sessionId: string;
  scopedJwt: string;
}

@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private http = inject(HttpClient);
  private base = apiPath('sessions');

  start(payload: {
    hostId: string;
    crId: string;
    osUser?: string;
    connectionType?: string;
  }): Observable<SessionStartResponse> {
    return this.http.post<SessionStartResponse>(`${this.base}/start`, payload);
  }

  listActive(hostId?: string): Observable<SessionRecord[]> {
    const params: Record<string, string> = {};
    if (hostId) params['hostId'] = hostId;
    return this.http.get<SessionRecord[]>(`${this.base}/active`, { params });
  }

  listMine(): Observable<SessionRecord[]> {
    return this.http.get<SessionRecord[]>(`${this.base}/mine`);
  }

  getToken(id: string): Observable<{ websocketUrl: string; sessionToken: string; scopedJwt: string }> {
    return this.http.get<{ websocketUrl: string; sessionToken: string; scopedJwt: string }>(
      `${this.base}/${id}/token`,
    );
  }

  getOne(id: string): Observable<SessionRecord> {
    return this.http.get<SessionRecord>(`${this.base}/${id}`);
  }

  end(id: string): Observable<SessionRecord> {
    return this.http.patch<SessionRecord>(`${this.base}/${id}/end`, {});
  }
}
