import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { gatewayPath } from '../core/api.constants';

export interface GatewaySession {
  sessionId: string;
  userId?: string;
  hostId: string;
  crId: string;
  connectionType: string;
  status: string;
  createdAt: string;
  lastHeartbeatAt: string;
  leaseExpiresAt: string;
}

export interface SessionStartResponse {
  sessionId: string;
  sessionToken: string;
  websocketUrl: string;
  expiresAt: string;
}

export type SessionConnectionResponse = SessionStartResponse;

export interface ListSessionsResponse {
  sessions: GatewaySession[];
}

@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private http = inject(HttpClient);
  private base = gatewayPath('sessions');

  start(payload: {
    hostId: string;
    crId?: string;
    connectionType?: string;
  }): Observable<SessionStartResponse> {
    return this.http.post<SessionStartResponse>(`${this.base}/start`, payload);
  }

  list(params: {
    hostId?: string;
    crId?: string;
    status?: string;
    mine?: boolean;
  } = {}): Observable<ListSessionsResponse> {
    const query: Record<string, string> = {};
    if (params.hostId) query['hostId'] = params.hostId;
    if (params.crId) query['crId'] = params.crId;
    if (params.status) query['status'] = params.status;
    if (params.mine !== undefined) query['mine'] = String(params.mine);
    return this.http.get<ListSessionsResponse>(this.base, { params: query });
  }

  rejoin(id: string): Observable<SessionConnectionResponse> {
    return this.http.post<SessionConnectionResponse>(`${this.base}/${id}/rejoin`, {});
  }

  observe(id: string): Observable<SessionConnectionResponse> {
    return this.http.post<SessionConnectionResponse>(`${this.base}/${id}/observe`, {});
  }

  close(id: string): Observable<GatewaySession> {
    return this.http.post<GatewaySession>(`${this.base}/${id}/close`, {});
  }
}
