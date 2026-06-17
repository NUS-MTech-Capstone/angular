import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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
  private base = '/ddm/sessions';

  /** UC: Start Session — start a new SSH session */
  start(payload: {
    hostId: string;
    crId: string;
    osUser?: string;
    connectionType?: string;
  }): Observable<SessionStartResponse> {
    return this.http.post<SessionStartResponse>(`${this.base}/start`, payload);
  }

  /** UC: Select Existing Session — all active sessions; optionally filter by hostId */
  listActive(hostId?: string): Observable<SessionRecord[]> {
    const params: Record<string, string> = {};
    if (hostId) params['hostId'] = hostId;
    return this.http.get<SessionRecord[]>(`${this.base}/active`, { params });
  }

  /** UC: Reconnect Session — the current user's own sessions */
  listMine(): Observable<SessionRecord[]> {
    return this.http.get<SessionRecord[]>(`${this.base}/mine`);
  }

  /** UC: Reconnect Session — get stored gateway credentials for an existing session */
  getToken(id: string): Observable<{ websocketUrl: string; sessionToken: string; scopedJwt: string }> {
    return this.http.get<{ websocketUrl: string; sessionToken: string; scopedJwt: string }>(
      `${this.base}/${id}/token`,
    );
  }

  getOne(id: string): Observable<SessionRecord> {
    return this.http.get<SessionRecord>(`${this.base}/${id}`);
  }

  /** End a session explicitly */
  end(id: string): Observable<SessionRecord> {
    return this.http.patch<SessionRecord>(`${this.base}/${id}/end`, {});
  }
}
