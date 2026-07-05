import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  IncidentAgentService,
  IncidentDetail,
  ManagedAlert,
  ManagedAlertDetail,
} from '../../services/incident-agent.service';
import { AgenticAiAlerts } from './agentic-ai-alerts';

const incident = (): IncidentDetail => ({
  id: 'inc-1',
  sourceId: 'alarm-source',
  alarmArn: 'arn:alarm',
  alarmName: 'High 5xx',
  hostId: 'host-dev-1',
  state: 'AWAITING_APPROVAL',
  reason: 'service unhealthy',
  runbookVersion: 'v1',
  planHash: 'hash-1',
  approvalDecision: '',
  approvalAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:05:00Z',
  evidence: [],
  triage: {
    priority: 'high',
    category: 'availability',
    summary: 'service unhealthy',
    rationale: 'alarm is in ALARM',
  },
  plan: {
    summary: 'Restart service',
    rationale: 'Health check failed',
    actions: [{ operationId: 'restart_service', reason: 'recover service' }],
  },
  approverSubject: '',
  report: '',
  errorMessage: '',
  postIncidentStatus: '',
  postIncidentSummary: '',
});

const alert = (status: ManagedAlert['status'] = 'PENDING_APPROVAL'): ManagedAlertDetail => ({
  id: 'alert-1',
  sourceId: 'arn:alarm|2026-01-01T00:00:00Z|ALARM',
  sourceType: 'managed-server',
  alarmArn: 'arn:alarm',
  alarmName: 'High 5xx',
  cloudwatchState: 'ALARM',
  hostId: 'host-dev-1',
  reason: 'threshold breached',
  status,
  groupKey: 'managed-server|host-dev-1|High 5xx',
  incidentId: 'inc-1',
  errorSummary: '',
  occurredAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:01Z',
  updatedAt: '2026-01-01T00:05:00Z',
  incident: incident(),
});

describe('AgenticAiAlerts', () => {
  let component: AgenticAiAlerts;
  let fixture: ComponentFixture<AgenticAiAlerts>;
  let incidentAgent: {
    listAlerts: ReturnType<typeof vi.fn>;
    getAlert: ReturnType<typeof vi.fn>;
  };
  let message: {
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    incidentAgent = {
      listAlerts: vi.fn(() => of({ alerts: [alert()] })),
      getAlert: vi.fn(() => of(alert())),
    };
    message = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AgenticAiAlerts],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgenticAiAlerts);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads alerts and computes status counts', () => {
    expect(component.alerts).toHaveLength(1);
    expect(component.pendingApprovalCount).toBe(1);

    component.alerts = [alert('RECEIVED'), alert('RESOLVED'), alert('FAILED')];

    expect(component.activeCount).toBe(1);
    expect(component.resolvedCount).toBe(1);
    expect(component.failedCount).toBe(1);
  });

  it('filters alerts by status, CloudWatch state, and host', () => {
    component.alerts = [
      alert('PENDING_APPROVAL'),
      { ...alert('RESOLVED'), id: 'alert-2', hostId: 'db-1', cloudwatchState: 'OK' },
    ];

    component.statusFilter = 'RESOLVED';
    component.cloudwatchFilter = 'OK';
    component.hostFilter = 'db';

    expect(component.filteredAlerts).toHaveLength(1);
    expect(component.filteredAlerts[0].id).toBe('alert-2');
  });

  it('loads alert detail into the drawer', () => {
    component.openAlert(alert());

    expect(incidentAgent.getAlert).toHaveBeenCalledWith('alert-1');
    expect(component.isDrawerOpen).toBe(true);
    expect(component.selectedAlert?.incident?.plan.summary).toBe('Restart service');
  });

  it('reports alert load errors', () => {
    incidentAgent.getAlert.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not found' })),
    );

    component.openAlert(alert());

    expect(message.error).toHaveBeenCalledWith('Alert not found');
  });
});
