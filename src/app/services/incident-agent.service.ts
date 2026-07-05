import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type IncidentState =
  | 'DIAGNOSING'
  | 'AWAITING_APPROVAL'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'RECOVERED'
  | 'FAILED';

export interface IncidentSummary {
  id: string;
  alarmName: string;
  hostId: string;
  state: IncidentState;
  reason: string;
  runbookVersion: string;
  planHash: string;
  approvalDecision: string;
  approvalAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentAction {
  operationId: string;
  reason: string;
}

export interface IncidentPlan {
  summary: string;
  rationale: string;
  actions: IncidentAction[];
}

export interface OperationResult {
  operationId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IncidentDetail extends IncidentSummary {
  sourceId: string;
  alarmArn: string;
  evidence: OperationResult[];
  plan: IncidentPlan;
  approverSubject: string;
  report: string;
  errorMessage: string;
}

export interface IncidentListResponse {
  incidents: IncidentSummary[];
}

const JSON_HEADERS = new HttpHeaders({ Accept: 'application/json' });

@Injectable({ providedIn: 'root' })
export class IncidentAgentService {
  private http = inject(HttpClient);
  private base = '/incidents';

  list(): Observable<IncidentListResponse> {
    return this.http.get<IncidentListResponse>(this.base, { headers: JSON_HEADERS });
  }

  get(id: string): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.base}/${id}`, { headers: JSON_HEADERS });
  }

  approve(id: string, planHash: string): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(
      `${this.base}/${id}/approve`,
      { planHash },
      { headers: JSON_HEADERS },
    );
  }

  reject(id: string, planHash: string): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(
      `${this.base}/${id}/reject`,
      { planHash },
      { headers: JSON_HEADERS },
    );
  }
}
