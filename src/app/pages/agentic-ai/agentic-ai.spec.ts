import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import { AuthService } from '../../services/auth.service';
import {
  IncidentAgentService,
  IncidentDetail,
  IncidentSummary,
} from '../../services/incident-agent.service';
import { AgenticAi } from './agentic-ai';

const incident = (state: IncidentSummary['state'] = 'AWAITING_APPROVAL'): IncidentDetail => ({
  id: 'inc-1',
  sourceId: 'alarm-1',
  alarmArn: 'arn:aws:cloudwatch:alarm',
  alarmName: 'High 5xx',
  hostId: 'host-dev-1',
  state,
  reason: 'HTTP 500 responses',
  runbookVersion: 'v1',
  planHash: 'hash-1',
  approvalDecision: '',
  approvalAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:05:00Z',
  evidence: [{ operationId: 'health_check', stdout: '500', stderr: '', exitCode: 1 }],
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

describe('AgenticAi', () => {
  let component: AgenticAi;
  let fixture: ComponentFixture<AgenticAi>;
  let incidentAgent: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let auth: {
    hasRole: ReturnType<typeof vi.fn>;
  };
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let modal: {
    confirm: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    incidentAgent = {
      list: vi.fn(() => of({ incidents: [incident()] })),
      get: vi.fn(() => of(incident())),
      approve: vi.fn(() => of({ ...incident('EXECUTING'), approverSubject: 'manager-1' })),
      reject: vi.fn(() => of({ ...incident('REJECTED'), approvalDecision: 'REJECTED' })),
    };
    auth = {
      hasRole: vi.fn((role: string) => role === 'Manager'),
    };
    message = {
      success: vi.fn(),
      error: vi.fn(),
    };
    modal = {
      confirm: vi.fn((options: { nzOnOk?: () => void }) => {
        options.nzOnOk?.();
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AgenticAi],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: AuthService, useValue: auth },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgenticAi);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads and filters incidents', () => {
    expect(component.incidents).toHaveLength(1);
    expect(component.awaitingApprovalCount).toBe(1);

    component.incidents = [incident(), incident('FAILED')];
    component.stateFilter = 'FAILED';

    expect(component.filteredIncidents).toHaveLength(1);
    expect(component.filteredIncidents[0].state).toBe('FAILED');
  });

  it('loads incident details into the drawer', () => {
    component.openIncident(incident());

    expect(incidentAgent.get).toHaveBeenCalledWith('inc-1');
    expect(component.isDrawerOpen).toBe(true);
    expect(component.selectedIncident?.plan.actions[0].operationId).toBe('restart_service');
  });

  it('shows decisions only to Manager or Admin for awaiting incidents', () => {
    expect(component.canDecideIncident(incident())).toBe(true);

    auth.hasRole.mockReturnValue(false);
    expect(component.canDecideIncident(incident())).toBe(false);

    auth.hasRole.mockImplementation((role: string) => role === 'Admin');
    expect(component.canDecideIncident(incident('COMPLETED'))).toBe(false);
  });

  it('confirms and approves the selected plan hash', () => {
    component.selectedIncident = incident();

    component.approveIncident(component.selectedIncident);

    expect(modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
      nzTitle: 'Approve remediation plan?',
      nzContent: 'Plan hash: hash-1',
    }));
    expect(incidentAgent.approve).toHaveBeenCalledWith('inc-1', 'hash-1');
    expect(component.selectedIncident?.state).toBe('EXECUTING');
    expect(message.success).toHaveBeenCalledWith('Remediation approved');
  });

  it('confirms and rejects the selected plan hash', () => {
    component.selectedIncident = incident();

    component.rejectIncident(component.selectedIncident);

    expect(modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
      nzTitle: 'Reject remediation plan?',
      nzContent: 'Plan hash: hash-1',
      nzOkDanger: true,
    }));
    expect(incidentAgent.reject).toHaveBeenCalledWith('inc-1', 'hash-1');
    expect(component.selectedIncident?.state).toBe('REJECTED');
    expect(message.success).toHaveBeenCalledWith('Plan rejected');
  });

  it('reports detail and decision errors', () => {
    incidentAgent.get.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not found' })),
    );
    component.openIncident(incident());
    expect(message.error).toHaveBeenCalledWith('Incident not found');

    incidentAgent.approve.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );
    component.approveIncident(incident());
    expect(message.error).toHaveBeenCalledWith('Manager approval is required');

    incidentAgent.approve.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'incident changed' } })),
    );
    component.approveIncident(incident());
    expect(message.error).toHaveBeenCalledWith('Incident changed; reload before deciding');
    expect(incidentAgent.get).toHaveBeenCalledWith('inc-1');
  });
});
