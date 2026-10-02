import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs/operators';
import {
  AgentHealth,
  AlertStatus,
  CloudWatchState,
  IncidentAgentService,
  ManagedAlert,
} from '../../services/incident-agent.service';

type AlertStatusFilter = 'ALL' | AlertStatus;
type CloudWatchStateFilter = 'ALL' | CloudWatchState;

const STATUS_FILTERS: { label: string; value: AlertStatusFilter }[] = [
  { label: 'All alert statuses', value: 'ALL' },
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
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai-alerts.html',
})
export class AgenticAiAlerts implements OnInit {
  readonly statusFilters = STATUS_FILTERS;

  alerts: ManagedAlert[] = [];
  health?: AgentHealth;
  statusFilter: AlertStatusFilter = 'ALL';
  cloudwatchFilter: CloudWatchStateFilter = 'ALL';
  hostFilter = '';
  isLoading = false;
  isLoadingHealth = false;

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
    return this.alerts.filter((alert) =>
      (this.statusFilter === 'ALL' || alert.status === this.statusFilter)
      && (this.cloudwatchFilter === 'ALL' || alert.cloudwatchState === this.cloudwatchFilter)
      && (!host || alert.hostId.toLowerCase().includes(host)),
    );
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
      error: (error: unknown) => this.message.error(this.errorMessage(error, 'Failed to load alerts')),
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
      error: (error: unknown) => this.message.error(this.errorMessage(error, 'Failed to load agent health')),
    });
  }

  statusLabel(status: AlertStatus): string {
    return status.toLowerCase().replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());
  }

  statusColor(status: AlertStatus): string {
    switch (status) {
      case 'RECEIVED':
      case 'TRIAGING':
      case 'EXECUTING': return 'blue';
      case 'TRIAGED':
      case 'RESOLVED': return 'green';
      case 'PENDING_APPROVAL': return 'gold';
      case 'REJECTED': return 'default';
      case 'FAILED': return 'red';
    }
  }

  cloudwatchColor(state: CloudWatchState): string {
    return state === 'ALARM' ? 'red' : 'green';
  }

  healthColor(value: boolean): string {
    return value ? 'green' : 'red';
  }

  private countByStatus(status: AlertStatus): number {
    return this.alerts.filter((alert) => alert.status === status).length;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    return error.error?.detail ?? error.message ?? fallback;
  }
}
