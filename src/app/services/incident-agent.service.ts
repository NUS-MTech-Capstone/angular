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

export type IncidentEventType =
  | 'AlertReceived'
  | 'AlertGrouped'
  | 'IncidentCreated'
  | 'AgentTriaged'
  | 'EvidenceCollected'
  | 'PlanProposed'
  | 'PlanExpired'
  | 'PlanApproved'
  | 'PlanRejected'
  | 'RemediationStarted'
  | 'RemediationExecuted'
  | 'RemediationFailed'
  | 'VerificationPassed'
  | 'VerificationFailed'
  | 'IncidentRecovered';

export type ApprovalOutcome = 'SUCCEEDED' | 'DENIED' | 'CONFLICT' | 'NOT_FOUND';

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
  grouped: boolean;
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

export interface IncidentEvent {
  id: string;
  incidentId: string;
  alertId: string;
  eventType: IncidentEventType;
  actor: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApprovalDecisionAudit {
  id: string;
  incidentId: string;
  actor: string;
  decision: string;
  submittedPlanHash: string;
  outcome: ApprovalOutcome;
  errorReason: string;
  createdAt: string;
}

export interface PostIncidentReport {
  rootCauseSummary: string;
  actionTaken: string;
  verificationSummary: string;
  finalState: string;
  startedAt?: string | null;
  resolvedAt?: string | null;
  durationSeconds?: number | null;
}

export interface IncidentDetail extends IncidentSummary {
  sourceId: string;
  alarmArn: string;
  evidence: OperationResult[];
  triage: IncidentTriage | null;
  plan: IncidentPlan;
  planExpiresAt?: string | null;
  isPlanExpired: boolean;
  approverSubject: string;
  report: string;
  errorMessage: string;
  postIncidentStatus: string;
  postIncidentSummary: string;
  postIncidentReport: PostIncidentReport;
  timeline: IncidentEvent[];
  approvalDecisions: ApprovalDecisionAudit[];
}

export interface IncidentListResponse {
  incidents: IncidentSummary[];
}

export interface AgentHealth {
  databaseReady: boolean;
  queueConsumerConfigured: boolean;
  queueConsumerRunning: boolean;
  lastAlertProcessedAt?: string | null;
  lastErrorSummary: string;
  activeIncidentCount: number;
  failedIncidentCount: number;
}

const JSON_HEADERS = new HttpHeaders({ Accept: 'application/json' });

@Injectable({ providedIn: 'root' })
export class IncidentAgentService {
  private http = inject(HttpClient);
  private incidentsBase = '/incidents';
  private alertsBase = '/alerts';
  private healthUrl = '/agentic-ai/health';

  listAlerts(): Observable<AlertListResponse> {
    return this.http.get<AlertListResponse>(this.alertsBase, { headers: JSON_HEADERS });
  }

  getAlert(id: string): Observable<ManagedAlertDetail> {
    return this.http.get<ManagedAlertDetail>(`${this.alertsBase}/${id}`, { headers: JSON_HEADERS });
  }

  getHealth(): Observable<AgentHealth> {
    return this.http.get<AgentHealth>(this.healthUrl, { headers: JSON_HEADERS });
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
