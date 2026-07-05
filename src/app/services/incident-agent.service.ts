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

export type AlertStatus =
  | 'RECEIVED'
  | 'TRIAGING'
  | 'TRIAGED'
  | 'PENDING_APPROVAL'
  | 'EXECUTING'
  | 'RESOLVED'
  | 'REJECTED'
  | 'FAILED';

export type CloudWatchState = 'ALARM' | 'OK';

export interface ManagedAlert {
  id: string;
  sourceId: string;
  sourceType: string;
  alarmArn: string;
  alarmName: string;
  cloudwatchState: CloudWatchState;
  hostId: string;
  reason: string;
  status: AlertStatus;
  groupKey: string;
  incidentId: string;
  errorSummary: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedAlertDetail extends ManagedAlert {
  incident: IncidentDetail | null;
}

export interface AlertListResponse {
  alerts: ManagedAlert[];
}

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

export interface IncidentTriage {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  summary: string;
  rationale: string;
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
  triage: IncidentTriage | null;
  plan: IncidentPlan;
  approverSubject: string;
  report: string;
  errorMessage: string;
  postIncidentStatus: string;
  postIncidentSummary: string;
}

export interface IncidentListResponse {
  incidents: IncidentSummary[];
}

const JSON_HEADERS = new HttpHeaders({ Accept: 'application/json' });

@Injectable({ providedIn: 'root' })
export class IncidentAgentService {
  private http = inject(HttpClient);
  private incidentsBase = '/incidents';
  private alertsBase = '/alerts';

  listAlerts(): Observable<AlertListResponse> {
    return this.http.get<AlertListResponse>(this.alertsBase, { headers: JSON_HEADERS });
  }

  getAlert(id: string): Observable<ManagedAlertDetail> {
    return this.http.get<ManagedAlertDetail>(`${this.alertsBase}/${id}`, { headers: JSON_HEADERS });
  }

  list(): Observable<IncidentListResponse> {
    return this.http.get<IncidentListResponse>(this.incidentsBase, { headers: JSON_HEADERS });
  }

  get(id: string): Observable<IncidentDetail> {
    return this.http.get<IncidentDetail>(`${this.incidentsBase}/${id}`, { headers: JSON_HEADERS });
  }

  approve(id: string, planHash: string): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(
      `${this.incidentsBase}/${id}/approve`,
      { planHash },
      { headers: JSON_HEADERS },
    );
  }

  reject(id: string, planHash: string): Observable<IncidentDetail> {
    return this.http.post<IncidentDetail>(
      `${this.incidentsBase}/${id}/reject`,
      { planHash },
      { headers: JSON_HEADERS },
    );
  }
}
