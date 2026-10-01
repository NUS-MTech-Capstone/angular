import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs/operators';
import {
  AgentHealth,
  AlertStatus,
  CloudWatchState,
  IncidentAgentService,
  ManagedAlert,
  ManagedAlertDetail,
} from '../../services/incident-agent.service';

type AlertStatusFilter = 'ALL' | AlertStatus;
type CloudWatchStateFilter = 'ALL' | CloudWatchState;

const STATUS_FILTERS: { label: string; value: AlertStatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Triaging', value: 'TRIAGING' },
  { label: 'Triaged', value: 'TRIAGED' },
  { label: 'Pending approval', value: 'PENDING_APPROVAL' },
  { label: 'Executing', value: 'EXECUTING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Failed', value: 'FAILED' },
];

@Component({
  selector: 'app-agentic-ai-alerts',
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
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai-alerts.html',
  styleUrl: './agentic-ai.css',
})
export class AgenticAiAlerts implements OnInit {
  readonly statusFilters = STATUS_FILTERS;

  alerts: ManagedAlert[] = [];
  health?: AgentHealth;
  selectedAlert?: ManagedAlertDetail;
  statusFilter: AlertStatusFilter = 'ALL';
  cloudwatchFilter: CloudWatchStateFilter = 'ALL';
  hostFilter = '';
  isLoading = false;
  isLoadingHealth = false;
  isLoadingDetail = false;
  isDrawerOpen = false;

  constructor(
    private incidentAgent: IncidentAgentService,
    private message: NzMessageService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.isLoading || this.isLoadingHealth) {
      return;
    }
    this.loadHealth();
    this.loadAlerts();
  }

  get filteredAlerts(): ManagedAlert[] {
    const host = this.hostFilter.trim().toLowerCase();
    return this.alerts.filter((alert) => {
      const statusMatches = this.statusFilter === 'ALL' || alert.status === this.statusFilter;
      const stateMatches = this.cloudwatchFilter === 'ALL' || alert.cloudwatchState === this.cloudwatchFilter;
      const hostMatches = !host || alert.hostId.toLowerCase().includes(host);
      return statusMatches && stateMatches && hostMatches;
    });
  }

  get activeCount(): number {
    return this.alerts.filter((alert) =>
      ['RECEIVED', 'TRIAGING', 'PENDING_APPROVAL', 'EXECUTING'].includes(alert.status),
    ).length;
  }

  get pendingApprovalCount(): number {
    return this.countByStatus('PENDING_APPROVAL');
  }

  get resolvedCount(): number {
    return this.countByStatus('RESOLVED');
  }

  get failedCount(): number {
    return this.countByStatus('FAILED');
  }

  loadAlerts(): void {
    this.isLoading = true;
    this.incidentAgent.listAlerts().pipe(finalize(() => {
      this.isLoading = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (response) => {
        this.alerts = response.alerts ?? [];
      },
      error: (error: unknown) => {
        this.message.error(this.errorMessage(error, 'Failed to load alerts'));
      },
    });
  }

  loadHealth(): void {
    this.isLoadingHealth = true;
    this.incidentAgent.getHealth().pipe(finalize(() => {
      this.isLoadingHealth = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (health) => {
        this.health = health;
      },
      error: (error: unknown) => {
        this.message.error(this.errorMessage(error, 'Failed to load agent health'));
      },
    });
  }

  openAlert(alert: ManagedAlert): void {
    this.isDrawerOpen = true;
    this.isLoadingDetail = true;
    this.incidentAgent.getAlert(alert.id).pipe(finalize(() => {
      this.isLoadingDetail = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (detail) => {
        this.selectedAlert = detail;
        this.replaceAlert(detail);
      },
      error: (error: unknown) => {
        this.message.error(this.errorMessage(error, 'Failed to load alert'));
      },
    });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

  statusColor(status: AlertStatus): string {
    switch (status) {
      case 'RECEIVED':
      case 'TRIAGING':
      case 'EXECUTING':
        return 'blue';
      case 'TRIAGED':
      case 'RESOLVED':
        return 'green';
      case 'PENDING_APPROVAL':
        return 'gold';
      case 'REJECTED':
        return 'default';
      case 'FAILED':
        return 'red';
    }
  }

  cloudwatchColor(state: CloudWatchState): string {
    return state === 'ALARM' ? 'red' : 'green';
  }

  healthColor(value: boolean): string {
    return value ? 'green' : 'red';
  }

  sshAuditParams(alert: ManagedAlert): Record<string, string> {
    return {
      tab: 'ssh',
      hostId: alert.hostId,
      from: this.windowIso(alert.occurredAt, -30),
      to: this.windowIso(alert.occurredAt, 30),
    };
  }

  private replaceAlert(updated: ManagedAlert): void {
    const index = this.alerts.findIndex((alert) => alert.id === updated.id);
    if (index === -1) {
      this.alerts = [updated, ...this.alerts];
      return;
    }
    this.alerts = [
      ...this.alerts.slice(0, index),
      { ...this.alerts[index], ...updated },
      ...this.alerts.slice(index + 1),
    ];
  }

  private countByStatus(status: AlertStatus): number {
    return this.alerts.filter((alert) => alert.status === status).length;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 404) {
      return 'Alert not found';
    }
    return error.error?.detail ?? error.message ?? fallback;
  }

  private windowIso(value: string, offsetMinutes: number): string {
    const date = new Date(value);
    const base = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
    return new Date(base + offsetMinutes * 60 * 1000).toISOString();
  }
}
