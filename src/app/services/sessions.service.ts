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

export interface SessionConnectionResponse {
  websocketUrl: string;
  sessionToken: string;
  scopedJwt: string;
}

export interface GatewayRejoinCandidate {
  sessionId: string;
  hostId: string;
  crId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private http = inject(HttpClient);
  private base = apiPath('sessions');

  start(payload: {
    hostId: string;
    crId?: string;
    osUser?: string;
    connectionType?: string;
  }): Observable<SessionStartResponse> {
    return this.http.post<SessionStartResponse>(`${this.base}/start`, payload);
  }

  /** Ask the gateway which sessions can be rejoined for the given host/CR. */
  rejoinCandidates(hostId: string, crId?: string): Observable<GatewayRejoinCandidate[]> {
    const params: Record<string, string> = { hostId };
    if (crId) params['crId'] = crId;
    return this.http.get<GatewayRejoinCandidate[]>(`${this.base}/rejoin-candidates`, { params });
  }

  /** Rejoin an existing session — gateway issues a fresh WebSocket ticket. */
  rejoin(id: string): Observable<SessionConnectionResponse> {
    return this.http.post<SessionConnectionResponse>(`${this.base}/${id}/rejoin`, {});
  }

  /** Get a read-only observe ticket for watching an active session. */
  observe(id: string): Observable<{ websocketUrl: string; sessionToken: string }> {
    return this.http.post<{ websocketUrl: string; sessionToken: string }>(
      `${this.base}/${id}/observe`,
      {},
    );
  }

  listActive(hostId?: string): Observable<SessionRecord[]> {
    const params: Record<string, string> = {};
    if (hostId) params['hostId'] = hostId;
    return this.http.get<SessionRecord[]>(`${this.base}/active`, { params });
  }

  listMine(): Observable<SessionRecord[]> {
    return this.http.get<SessionRecord[]>(`${this.base}/mine`);
  }

  getOne(id: string): Observable<SessionRecord> {
    return this.http.get<SessionRecord>(`${this.base}/${id}`);
  }

  end(id: string): Observable<SessionRecord> {
    return this.http.patch<SessionRecord>(`${this.base}/${id}/end`, {});
  }
}
