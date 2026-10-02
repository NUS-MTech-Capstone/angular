import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs/operators';
import {
  IncidentAgentService,
  IncidentState,
  IncidentSummary,
} from '../../services/incident-agent.service';

type StateFilter = 'ALL' | IncidentState;

const STATE_FILTERS: { label: string; value: StateFilter }[] = [
  { label: 'All incidents', value: 'ALL' },
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
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai.html',
})
export class AgenticAi implements OnInit {
  readonly stateFilters = STATE_FILTERS;

  incidents: IncidentSummary[] = [];
  stateFilter: StateFilter = 'ALL';
  isLoading = false;

  constructor(
    private incidentAgent: IncidentAgentService,
    private message: NzMessageService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const legacyIncidentId = this.route.snapshot.queryParamMap.get('incidentId');
    if (legacyIncidentId) {
      void this.router.navigate(['/agentic-ai/incidents', legacyIncidentId], { replaceUrl: true });
      return;
    }
    this.loadIncidents();
  }

  get filteredIncidents(): IncidentSummary[] {
    return this.stateFilter === 'ALL'
      ? this.incidents
      : this.incidents.filter((incident) => incident.state === this.stateFilter);
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

  loadIncidents(): void {
    if (this.isLoading) {
      return;
    }
    this.isLoading = true;
    this.incidentAgent.list().pipe(finalize(() => {
      this.isLoading = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (response) => {
        this.incidents = response.incidents ?? [];
      },
      error: (error: unknown) => {
        this.message.error(this.errorMessage(error, 'Failed to load incidents'));
      },
    });
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

  private countByState(state: IncidentState): number {
    return this.incidents.filter((incident) => incident.state === state).length;
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? error.error?.detail ?? error.message ?? fallback
      : fallback;
  }
}
