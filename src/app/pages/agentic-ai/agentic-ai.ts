import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  ExplanationAgent,
  IncidentAgentService,
  IncidentDetail,
  IncidentState,
  IncidentSummary,
  OperationResult,
} from '../../services/incident-agent.service';
import { AuthService } from '../../services/auth.service';

type StateFilter = 'ALL' | IncidentState;
type Decision = 'approve' | 'reject';

const STATE_FILTERS: { label: string; value: StateFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Awaiting approval', value: 'AWAITING_APPROVAL' },
  { label: 'Diagnosing', value: 'DIAGNOSING' },
  { label: 'Executing', value: 'EXECUTING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Recovered', value: 'RECOVERED' },
  { label: 'Failed', value: 'FAILED' },
];

@Component({
  selector: 'app-agentic-ai',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzSelectModule,
    NzSpaceModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  templateUrl: './agentic-ai.html',
  styleUrl: './agentic-ai.css',
})
export class AgenticAi implements OnInit {
  readonly stateFilters = STATE_FILTERS;

  incidents: IncidentSummary[] = [];
  selectedIncident?: IncidentDetail;
  stateFilter: StateFilter = 'ALL';
  isLoading = false;
  isLoadingDetail = false;
  isDrawerOpen = false;
  decidingIncidentId = '';

  constructor(
    private incidentAgent: IncidentAgentService,
    private auth: AuthService,
    private message: NzMessageService,
    private modal: NzModalService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadIncidents(this.route.snapshot.queryParamMap.get('incidentId') ?? undefined);
  }

  get canApprove(): boolean {
    return this.auth.hasRole('Manager') || this.auth.hasRole('Admin');
  }

  get filteredIncidents(): IncidentSummary[] {
    if (this.stateFilter === 'ALL') {
      return this.incidents;
    }
    return this.incidents.filter((incident) => incident.state === this.stateFilter);
  }

  get awaitingApprovalCount(): number {
    return this.countByState('AWAITING_APPROVAL');
  }

  get executingCount(): number {
    return this.countByState('EXECUTING');
  }

  get failedCount(): number {
    return this.countByState('FAILED');
  }

  get closedCount(): number {
    return this.incidents.filter((incident) =>
      ['COMPLETED', 'REJECTED', 'RECOVERED'].includes(incident.state),
    ).length;
  }

  loadIncidents(openIncidentId?: string): void {
    this.isLoading = true;
    this.incidentAgent.list().subscribe({
      next: (response) => {
        this.incidents = response.incidents ?? [];
        this.isLoading = false;
        this.refreshSelectedSummary();
        if (openIncidentId) {
          this.openIncidentById(openIncidentId);
        }
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.message.error(this.errorMessage(error, 'Failed to load incidents'));
      },
    });
  }

  openIncident(incident: IncidentSummary): void {
    this.openIncidentById(incident.id);
  }

  openIncidentById(incidentId: string): void {
    this.isDrawerOpen = true;
    this.isLoadingDetail = true;
    this.incidentAgent.get(incidentId).subscribe({
      next: (detail) => {
        this.selectedIncident = detail;
        this.replaceIncident(detail);
        this.isLoadingDetail = false;
      },
      error: (error: unknown) => {
        this.isLoadingDetail = false;
        this.message.error(this.errorMessage(error, 'Failed to load incident'));
      },
    });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

  canDecideIncident(incident: IncidentSummary | IncidentDetail | undefined): boolean {
    return !!incident && this.canApprove && incident.state === 'AWAITING_APPROVAL' && !this.isExpired(incident);
  }

  approveIncident(incident: IncidentDetail): void {
    this.confirmDecision('approve', incident);
  }

  rejectIncident(incident: IncidentDetail): void {
    this.confirmDecision('reject', incident);
  }

  stateColor(state: IncidentState): string {
    switch (state) {
      case 'AWAITING_APPROVAL':
        return 'gold';
      case 'DIAGNOSING':
      case 'EXECUTING':
        return 'blue';
      case 'COMPLETED':
      case 'RECOVERED':
        return 'green';
      case 'REJECTED':
        return 'default';
      case 'FAILED':
        return 'red';
    }
  }

  isExpired(incident: IncidentSummary | IncidentDetail): boolean {
    return 'isPlanExpired' in incident ? incident.isPlanExpired : false;
  }

  hasStructuredReport(incident: IncidentDetail): boolean {
    const report = incident.postIncidentReport;
    return !!(
      report.rootCauseSummary ||
      report.actionTaken ||
      report.verificationSummary ||
      report.finalState
    );
  }

  hasExplanation(incident: IncidentDetail): boolean {
    const explanation = incident.explanation;
    return !!(
      explanation?.model?.plannerType ||
      explanation?.workflow?.catalogVersion ||
      explanation?.agents?.length ||
      explanation?.toolDecisions?.length ||
      explanation?.guardrails?.length
    );
  }

  explanationAgents(incident: IncidentDetail): ExplanationAgent[] {
    return incident.explanation?.agents ?? [];
  }

  targetProbe(incident: IncidentDetail): OperationResult | undefined {
    return incident.evidence.find((result) => result.operationId === 'target_probe');
  }

  sshAuditParams(incident: IncidentSummary | IncidentDetail): Record<string, string> {
    return {
      tab: 'ssh',
      hostId: incident.hostId,
      from: this.windowIso(incident.createdAt, -30),
      to: this.windowIso(incident.updatedAt, 30),
    };
  }

  private confirmDecision(decision: Decision, incident: IncidentDetail): void {
    const isApprove = decision === 'approve';
    this.modal.confirm({
      nzTitle: isApprove ? 'Approve remediation plan?' : 'Reject remediation plan?',
      nzContent: `Plan hash: ${incident.planHash}`,
      nzOkText: isApprove ? 'Approve' : 'Reject',
      nzOkDanger: !isApprove,
      nzOnOk: () => this.submitDecision(decision, incident),
    });
  }

  private submitDecision(decision: Decision, incident: IncidentDetail): void {
    this.decidingIncidentId = incident.id;
    const request =
      decision === 'approve'
        ? this.incidentAgent.approve(incident.id, incident.planHash)
        : this.incidentAgent.reject(incident.id, incident.planHash);
    request.subscribe({
      next: (updated) => {
        this.decidingIncidentId = '';
        this.selectedIncident = updated;
        this.replaceIncident(updated);
        this.message.success(decision === 'approve' ? 'Remediation approved' : 'Plan rejected');
      },
      error: (error: unknown) => {
        this.decidingIncidentId = '';
        this.message.error(this.errorMessage(error, 'Decision failed'));
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.openIncidentById(incident.id);
        }
      },
    });
  }

  private replaceIncident(updated: IncidentSummary): void {
    const index = this.incidents.findIndex((incident) => incident.id === updated.id);
    if (index === -1) {
      this.incidents = [updated, ...this.incidents];
      return;
    }
    this.incidents = [
      ...this.incidents.slice(0, index),
      { ...this.incidents[index], ...updated },
      ...this.incidents.slice(index + 1),
    ];
  }

  private refreshSelectedSummary(): void {
    if (!this.selectedIncident) {
      return;
    }
    const latest = this.incidents.find((incident) => incident.id === this.selectedIncident?.id);
    if (latest) {
      this.selectedIncident = { ...this.selectedIncident, ...latest };
    }
  }

  private countByState(state: IncidentState): number {
    return this.incidents.filter((incident) => incident.state === state).length;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 403) {
      return 'Manager approval is required';
    }
    if (error.status === 404) {
      return 'Incident not found';
    }
    if (error.status === 409) {
      return error.error?.detail ?? 'Incident changed; reload before deciding';
    }
    return error.error?.detail ?? error.message ?? fallback;
  }

  private windowIso(value: string, offsetMinutes: number): string {
    const date = new Date(value);
    const base = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
    return new Date(base + offsetMinutes * 60 * 1000).toISOString();
  }
}
