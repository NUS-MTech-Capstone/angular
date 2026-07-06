import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';

export interface AuditSessionSummary {
  sessionId: string;
  userId: string;
  hostId: string;
  crId: string;
  connectionType: string;
  status: string;
  createdAt: string;
  lastAuditAt: string;
  recordCount: number;
  truncated: boolean;
}

export interface SessionAuditRecord {
  sessionId: string;
  userId: string;
  hostId: string;
  crId: string;
  recordType: 'command' | 'output' | 'control' | 'session_event';
  sequence: number;
  commandId?: string;
  commandText?: string;
  outputDataBase64?: string;
  createdAt: string;
  truncated: boolean;
  byteCount: number;
}

export interface ListAuditSessionsResponse {
  sessions: AuditSessionSummary[];
  nextCursor?: string;
}

export interface ListSessionAuditRecordsResponse {
  records: SessionAuditRecord[];
  nextCursor?: string;
}

export interface SessionAuditFilters {
  sessionId?: string;
  userId?: string;
  hostId?: string;
  crId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionAuditService {
  private http = inject(HttpClient);
  private base = apiPath('session-audit');

  listSessions(filters: SessionAuditFilters = {}): Observable<ListAuditSessionsResponse> {
    const params = this.toParams(filters);
    return this.http.get<ListAuditSessionsResponse>(`${this.base}/sessions`, { params });
  }

  listRecords(sessionId: string, limit = 500, cursor?: string): Observable<ListSessionAuditRecordsResponse> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<ListSessionAuditRecordsResponse>(
      `${this.base}/sessions/${encodeURIComponent(sessionId)}/records`,
      { params },
    );
  }

  private toParams(filters: SessionAuditFilters): Record<string, string> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') {
        params[key] = String(value);
      }
    }
    return params;
  }
}
