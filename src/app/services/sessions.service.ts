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
  /** DDM internal session ID (use for all subsequent DDM API calls) */
  sessionId: string;
  sessionToken: string;
  websocketUrl: string;
  expiresAt: string;
  scopedJwt: string;
}

export interface SessionConnectionResponse {
  sessionId: string;
  sessionToken: string;
  websocketUrl: string;
  expiresAt: string;
  scopedJwt: string;
}

/** Matches the gateway spec's SessionCandidate schema. */
export interface GatewayRejoinCandidate {
  sessionId: string;
  hostId: string;
  crId: string;
  connectionType: string;
  status: string;
  createdAt: string;
  lastHeartbeatAt: string;
  leaseExpiresAt: string;
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

  /** Ask the gateway which sessions can be rejoined for the given host/CR.
   *  Gateway returns { sessions: SessionCandidate[] } per spec. */
  rejoinCandidates(hostId: string, crId?: string): Observable<{ sessions: GatewayRejoinCandidate[] }> {
    const params: Record<string, string> = { hostId };
    if (crId) params['crId'] = crId;
    return this.http.get<{ sessions: GatewayRejoinCandidate[] }>(`${this.base}/rejoin-candidates`, { params });
  }

  /** Rejoin an existing session — gateway issues a fresh WebSocket ticket. */
  rejoin(id: string): Observable<SessionConnectionResponse> {
    return this.http.post<SessionConnectionResponse>(`${this.base}/${id}/rejoin`, {});
  }

  /** Get a read-only observe ticket for watching an active session. */
  observe(id: string): Observable<SessionConnectionResponse> {
    return this.http.post<SessionConnectionResponse>(`${this.base}/${id}/observe`, {});
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
