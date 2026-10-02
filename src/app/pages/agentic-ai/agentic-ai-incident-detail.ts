import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs/operators';
import {
  ExplanationAgent,
  ExplanationTrace,
  ExplanationToolCall,
  ExplanationToolPhase,
  IncidentAgentService,
  IncidentDetail,
  IncidentEventType,
  IncidentState,
  OperationResult,
} from '../../services/incident-agent.service';
import { AuthService } from '../../services/auth.service';

type Decision = 'approve' | 'reject';
type StageState = 'complete' | 'active' | 'waiting' | 'failed' | 'pending';

interface WorkflowStage {
  id: string;
  label: string;
  actor: 'deterministic' | 'model' | 'tool' | 'human';
  state: StageState;
  summary: string;
}

const EMPTY_TRACE: ExplanationTrace = { schemaVersion: 'v1', agentActions: [], toolCalls: [] };
const ACTIVE_STATES: IncidentState[] = ['DIAGNOSING', 'EXECUTING'];
const OPERATION_LABELS: Record<string, string> = {
  system_overview: 'Inspect system overview',
  disk_usage: 'Check disk usage',
  memory_usage: 'Check memory usage',
  top_processes: 'Inspect top processes',
  service_status: 'Check service status',
  service_logs: 'Review bounded service logs',
  health_check: 'Run application health check',
  target_probe: 'Probe target connectivity',
  restart_service: 'Restart the managed service',
  recover_demo_app: 'Recover the demonstration application',
  reload_service: 'Reload the managed service',
};

@Component({
  selector: 'app-agentic-ai-incident-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzButtonModule,
    NzDescriptionsModule,
    NzIconModule,
    NzModalModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai-incident-detail.html',
})
export class AgenticAiIncidentDetail implements OnInit, OnDestroy {
  readonly toolPhases: ExplanationToolPhase[] = ['diagnose', 'remediate', 'verify'];

  incident?: IncidentDetail;
  isLoading = false;
  isRefreshing = false;
  decidingIncidentId = '';
  selectedStageId = '';

  private incidentId = '';
  private requestInFlight = false;
  private pollHandle?: ReturnType<typeof setTimeout>;
  private stagePinnedByUser = false;

  constructor(
    private incidentAgent: IncidentAgentService,
    private auth: AuthService,
    private message: NzMessageService,
    private modal: NzModalService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.incidentId = this.route.snapshot.paramMap.get('incidentId') ?? '';
    if (this.incidentId) {
      this.loadIncident(true);
    }
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  get canApprove(): boolean {
    return this.auth.hasRole('Manager') || this.auth.hasRole('Admin');
  }

  get trace(): ExplanationTrace {
    return this.incident?.explanation.trace ?? EMPTY_TRACE;
  }

  get workflowStages(): WorkflowStage[] {
    const incident = this.incident;
    if (!incident) {
      return [];
    }
    const approved = this.hasEvent('PlanApproved') || ['EXECUTING', 'COMPLETED', 'FAILED'].includes(incident.state);
    const rejected = incident.state === 'REJECTED' || this.hasEvent('PlanRejected');
    const remediated = this.hasEvent('RemediationExecuted');
    const verificationPassed = this.hasEvent('VerificationPassed');
    const verificationFailed = this.hasEvent('VerificationFailed');

    return [
      { id: 'alert', label: 'Alert', actor: 'deterministic', state: 'complete', summary: 'Monitoring raised a managed-server signal and created an incident record.' },
      { id: 'triage', label: 'Triage', actor: 'model', state: incident.triage ? 'complete' : this.activeOrFailed('DIAGNOSING'), summary: incident.triage?.summary || 'The reasoning agent is classifying the incident.' },
      { id: 'diagnose', label: 'Diagnose', actor: 'tool', state: incident.evidence.length ? 'complete' : this.activeOrFailed('DIAGNOSING'), summary: incident.evidence.length ? `${incident.evidence.length} bounded diagnostic operations returned evidence.` : 'Approved diagnostic tools are gathering bounded evidence.' },
      { id: 'plan', label: 'Plan', actor: 'model', state: incident.plan.summary || this.hasEvent('PlanProposed') ? 'complete' : this.activeOrFailed('DIAGNOSING'), summary: incident.plan.summary || 'The agent is preparing a structured operation proposal.' },
      { id: 'approval', label: 'Approve', actor: 'human', state: rejected || approved ? 'complete' : incident.state === 'AWAITING_APPROVAL' ? 'waiting' : 'pending', summary: rejected ? 'A manager rejected the proposed plan.' : approved ? 'A manager approved the exact stored plan hash.' : 'A Manager or Admin must approve or reject any mutating action.' },
      { id: 'remediate', label: 'Remediate', actor: 'tool', state: remediated ? 'complete' : incident.state === 'EXECUTING' ? 'active' : incident.state === 'FAILED' && approved ? 'failed' : 'pending', summary: remediated ? 'The approved bounded remediation operation completed.' : 'Only the approved catalog operation can execute here.' },
      { id: 'verify', label: 'Verify', actor: 'tool', state: verificationPassed ? 'complete' : verificationFailed ? 'failed' : remediated && incident.state === 'EXECUTING' ? 'active' : 'pending', summary: verificationPassed ? 'Fixed post-remediation checks passed.' : verificationFailed ? 'One or more fixed verification checks failed.' : 'Fixed verification runs after remediation.' },
      { id: 'closed', label: 'Closed', actor: 'deterministic', state: incident.state === 'FAILED' ? 'failed' : ['COMPLETED', 'REJECTED', 'RECOVERED'].includes(incident.state) ? 'complete' : 'pending', summary: this.nextAction(incident) },
    ];
  }

  get selectedStage(): WorkflowStage | undefined {
    return this.workflowStages.find((stage) => stage.id === this.selectedStageId) ?? this.workflowStages[0];
  }

  get isAutoRefreshing(): boolean {
    return !!this.incident && ACTIVE_STATES.includes(this.incident.state);
  }

  loadIncident(showSpinner = true): void {
    if (!this.incidentId || this.requestInFlight) {
      return;
    }
    this.clearPoll();
    this.requestInFlight = true;
    this.isLoading = showSpinner;
    this.isRefreshing = !showSpinner;
    this.incidentAgent.get(this.incidentId).pipe(finalize(() => {
      this.requestInFlight = false;
      this.isLoading = false;
      this.isRefreshing = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (incident) => {
        this.incident = incident;
        if (!this.stagePinnedByUser) {
          const current = [...this.workflowStages].reverse().find((stage) => stage.state !== 'pending');
          this.selectedStageId = current?.id ?? 'alert';
        }
        this.schedulePoll(incident);
      },
      error: (error: unknown) => this.message.error(this.errorMessage(error, 'Failed to load incident')),
    });
  }

  selectStage(stage: WorkflowStage): void {
    this.stagePinnedByUser = true;
    this.selectedStageId = stage.id;
  }

  canDecideIncident(incident: IncidentDetail | undefined): boolean {
    return !!incident && this.canApprove && incident.state === 'AWAITING_APPROVAL' && !incident.isPlanExpired;
  }

  approveIncident(incident: IncidentDetail): void {
    this.confirmDecision('approve', incident);
  }

  rejectIncident(incident: IncidentDetail): void {
    this.confirmDecision('reject', incident);
  }

  stateLabel(state: IncidentState): string {
    return state.toLowerCase().replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());
  }

  stateColor(state: IncidentState): string {
    switch (state) {
      case 'AWAITING_APPROVAL': return 'gold';
      case 'DIAGNOSING':
      case 'EXECUTING': return 'blue';
      case 'COMPLETED':
      case 'RECOVERED': return 'green';
      case 'REJECTED': return 'default';
      case 'FAILED': return 'red';
    }
  }

  nextAction(incident: IncidentDetail): string {
    switch (incident.state) {
      case 'DIAGNOSING': return 'The agents are gathering evidence and preparing a safe plan.';
      case 'AWAITING_APPROVAL': return 'A Manager or Admin must review the exact proposed operation.';
      case 'EXECUTING': return 'The approved operation and fixed verification checks are running.';
      case 'COMPLETED': return 'Remediation and verification completed successfully.';
      case 'REJECTED': return 'The plan was rejected; no remediation was executed.';
      case 'RECOVERED': return 'Monitoring recovered before remediation was required.';
      case 'FAILED': return 'The workflow stopped safely and needs operator review.';
    }
  }

  operationLabel(operationId: string): string {
    return OPERATION_LABELS[operationId] ?? operationId.replaceAll('_', ' ');
  }

  selectionLabel(selectedBy: string): string {
    if (selectedBy === 'model_proposal') return 'Proposed by AI; validated by policy';
    if (selectedBy === 'policy') return 'Selected by deterministic policy';
    return selectedBy.replaceAll('_', ' ');
  }

  toolCallsForPhase(phase: ExplanationToolPhase): ExplanationToolCall[] {
    return this.trace.toolCalls.filter((call) => call.phase === phase);
  }

  evidenceForOperation(operationId: string): OperationResult | undefined {
    return this.incident?.evidence.find((result) => result.operationId === operationId);
  }

  diagnosticEvidence(call: ExplanationToolCall): OperationResult | undefined {
    return call.phase === 'diagnose' ? this.evidenceForOperation(call.operationId) : undefined;
  }

  actionForAgent(agent: ExplanationAgent): string {
    const action = this.trace.agentActions.find((item) =>
      item.toAgent && (
        item.toAgent === agent.name
        || agent.name.includes(item.toAgent)
        || item.toAgent.includes(agent.name)
      ),
    );
    return action?.status ?? 'DEFINED';
  }

  statusColor(status: string): string {
    if (status === 'SUCCEEDED' || status === 'complete') return 'green';
    if (status === 'FALLBACK' || status === 'waiting') return 'gold';
    if (status === 'FAILED' || status === 'failed') return 'red';
    if (status === 'active') return 'blue';
    return 'default';
  }

  formatDuration(durationMs: number): string {
    return durationMs > 0 ? `${Math.round(durationMs).toLocaleString()} ms` : 'Not recorded';
  }

  shortDigest(value: string): string {
    return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value || 'Not recorded';
  }

  eventLabel(eventType: IncidentEventType): string {
    return eventType.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  hasStructuredReport(incident: IncidentDetail): boolean {
    const report = incident.postIncidentReport;
    return !!(report.rootCauseSummary || report.actionTaken || report.verificationSummary || report.finalState);
  }

  sshAuditParams(incident: IncidentDetail): Record<string, string> {
    return {
      tab: 'ssh',
      hostId: incident.hostId,
      from: this.windowIso(incident.createdAt, -30),
      to: this.windowIso(incident.updatedAt, 30),
    };
  }

  private activeOrFailed(activeState: IncidentState): StageState {
    if (this.incident?.state === activeState) return 'active';
    return this.incident?.state === 'FAILED' ? 'failed' : 'pending';
  }

  private hasEvent(eventType: IncidentEventType): boolean {
    return this.incident?.timeline.some((event) => event.eventType === eventType) ?? false;
  }

  private confirmDecision(decision: Decision, incident: IncidentDetail): void {
    const action = incident.plan.actions[0];
    const isApprove = decision === 'approve';
    this.modal.confirm({
      nzTitle: isApprove ? 'Approve this bounded remediation?' : 'Reject this remediation plan?',
      nzContent: isApprove
        ? `Authorize ${this.operationLabel(action?.operationId ?? 'the proposed operation')} on ${incident.hostId}. The exact plan hash will be checked again before execution.`
        : `Reject the proposed operation for ${incident.hostId}. No remediation will execute.`,
      nzOkText: isApprove ? 'Approve exact plan' : 'Reject plan',
      nzOkDanger: !isApprove,
      nzOnOk: () => this.submitDecision(decision, incident),
    });
  }

  private submitDecision(decision: Decision, incident: IncidentDetail): void {
    this.clearPoll();
    this.decidingIncidentId = incident.id;
    const request = decision === 'approve'
      ? this.incidentAgent.approve(incident.id, incident.planHash)
      : this.incidentAgent.reject(incident.id, incident.planHash);
    request.pipe(finalize(() => {
      this.decidingIncidentId = '';
      this.cd.detectChanges();
    })).subscribe({
      next: (updated) => {
        this.incident = updated;
        this.message.success(decision === 'approve' ? 'Remediation approved' : 'Plan rejected');
        this.loadIncident(false);
      },
      error: (error: unknown) => {
        this.message.error(this.errorMessage(error, 'Decision failed'));
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.loadIncident(false);
        }
      },
    });
  }

  private schedulePoll(incident: IncidentDetail): void {
    this.clearPoll();
    if (ACTIVE_STATES.includes(incident.state)) {
      this.pollHandle = setTimeout(() => this.loadIncident(false), 5000);
    }
  }

  private clearPoll(): void {
    if (this.pollHandle) {
      clearTimeout(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 403) return 'Manager approval is required';
    if (error.status === 404) return 'Incident not found';
    if (error.status === 409) return error.error?.detail ?? 'Incident changed; reload before deciding';
    return error.error?.detail ?? error.message ?? fallback;
  }

  private windowIso(value: string, offsetMinutes: number): string {
    const date = new Date(value);
    const base = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
    return new Date(base + offsetMinutes * 60 * 1000).toISOString();
  }
}
