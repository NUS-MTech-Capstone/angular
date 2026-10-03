import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import { AuthService } from '../../services/auth.service';
import { ExplanationAgent, IncidentAgentService } from '../../services/incident-agent.service';
import { AgenticAiIncidentDetail } from './agentic-ai-incident-detail';
import { incidentFixture } from './agentic-ai.test-fixtures';

const configuredAgent = (name: string, purpose: string): ExplanationAgent => ({
  name,
  purpose,
  responsibilities: [`Handle the ${name.toLowerCase()} stage safely.`],
  reasoningType: `${name} reasoning`,
  memory: `${name} incident-local memory`,
  tools: [`${name} tool`],
  inputs: [`${name} input`],
  outputs: [`${name} output`],
  handoffTo: `${name} next participant`,
});

const configuredAgents = (): ExplanationAgent[] => [
  configuredAgent('Incident Manager Agent', 'Coordinate the bounded incident workflow and preserve handoff order.'),
  configuredAgent('Triage Agent', 'Classify the incident and produce an operator-readable triage summary.'),
  configuredAgent('Evidence Collector Agent', 'Collect bounded diagnostic evidence from approved operation IDs.'),
  configuredAgent('Action Plan Agent', 'Propose a structured remediation plan from triage and bounded evidence.'),
  configuredAgent('Action Plan Reviewer Agent', 'Validate the proposed plan before it can be stored or approved.'),
  configuredAgent('Remediation Executor Agent', 'Execute approved remediation and fixed verification after human approval.'),
];

describe('AgenticAiIncidentDetail', () => {
  let component: AgenticAiIncidentDetail;
  let fixture: ComponentFixture<AgenticAiIncidentDetail>;
  let fixtureDestroyed: boolean;
  let incidentAgent: {
    get: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };
  let auth: { hasRole: ReturnType<typeof vi.fn> };
  let message: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let modal: { confirm: ReturnType<typeof vi.fn> };

  const recreateWithIncident = (incident: ReturnType<typeof incidentFixture>): void => {
    fixture.destroy();
    incidentAgent.get.mockReturnValue(of(incident));
    fixture = TestBed.createComponent(AgenticAiIncidentDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const clickStage = (label: string): void => {
    const button = Array.from(fixture.nativeElement.querySelectorAll('.decision-flow button'))
      .find((element: unknown) => (element as HTMLButtonElement).textContent?.includes(label)) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    fixtureDestroyed = false;
    incidentAgent = {
      get: vi.fn(() => of(incidentFixture())),
      approve: vi.fn(() => of({ ...incidentFixture('EXECUTING'), approverSubject: 'manager-1' })),
      reject: vi.fn(() => of({ ...incidentFixture('REJECTED'), approvalDecision: 'REJECTED' })),
    };
    auth = { hasRole: vi.fn((role: string) => role === 'Manager') };
    message = { success: vi.fn(), error: vi.fn() };
    modal = {
      confirm: vi.fn((options: { nzOnOk?: () => void }) => options.nzOnOk?.()),
    };

    await TestBed.configureTestingModule({
      imports: [AgenticAiIncidentDetail],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: AuthService, useValue: auth },
        { provide: NzMessageService, useValue: message },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'inc-1' } } },
        },
      ],
    });
    TestBed.overrideProvider(NzModalService, { useValue: modal });
    await TestBed.compileComponents();

    vi.useFakeTimers();
    fixture = TestBed.createComponent(AgenticAiIncidentDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixtureDestroyed) fixture.destroy();
    vi.useRealTimers();
  });

  it('shows readable state, workflow actors, and grouped trace calls', () => {
    expect(component.stateLabel('AWAITING_APPROVAL')).toBe('Awaiting approval');
    expect(component.workflowStages.map((stage) => stage.label)).toEqual([
      'Alert', 'Triage', 'Diagnose', 'Plan', 'Approve', 'Remediate', 'Verify', 'Closed',
    ]);
    expect(component.trace.agentActions[0].actorType).toBe('MODEL_ASSISTED');
    expect(component.toolCallsForPhase('diagnose')[0].operationId).toBe('target_probe');
    expect(component.toolCallsForPhase('remediate')).toEqual([]);
    expect(component.diagnosticEvidence(component.trace.toolCalls[0])?.stdout).toContain('helperReady');
    expect(component.diagnosticEvidence({ ...component.trace.toolCalls[0], phase: 'verify' })).toBeUndefined();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Human decision required');
    expect(text).not.toContain('No free-form commands');
    expect(text).toContain('Diagnostic tool calls');
    expect(text).toContain('Selected by deterministic policy');
  });

  it('moves configured collaboration into a stage-specific inspector', () => {
    const incident = incidentFixture();
    incident.explanation.agents = configuredAgents();
    recreateWithIncident(incident);

    const expectedAgents: Record<string, string> = {
      alert: 'Incident Manager Agent',
      triage: 'Triage Agent',
      diagnose: 'Evidence Collector Agent',
      plan: 'Action Plan Agent',
      approval: 'Action Plan Reviewer Agent',
      remediate: 'Remediation Executor Agent',
      verify: 'Remediation Executor Agent',
      closed: 'Incident Manager Agent',
    };
    for (const stage of component.workflowStages) {
      clickStage(stage.label);
      expect(component.selectedAgents.map((agent) => agent.name)).toEqual([expectedAgents[stage.id]]);
    }

    clickStage('Triage');

    expect(component.selectedAgents.map((agent) => agent.name)).toEqual(['Triage Agent']);
    expect(component.selectedAgentActions).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Handle the triage agent stage safely.');
    expect(fixture.nativeElement.textContent).toContain('Triage Agent reasoning');
    expect(fixture.nativeElement.textContent).toContain('Triage Agent input');

    clickStage('Diagnose');

    expect(component.selectedAgents.map((agent) => agent.name)).toEqual(['Evidence Collector Agent']);
    expect(component.selectedToolCalls.map((call) => call.operationId)).toEqual(['target_probe']);
    expect(fixture.nativeElement.textContent).toContain('Probe target connectivity');

    clickStage('Approve');

    expect(component.selectedAgents.map((agent) => agent.name)).toEqual(['Action Plan Reviewer Agent']);
    expect(fixture.nativeElement.textContent).toContain('Manager or Admin');
    expect(fixture.nativeElement.textContent).toContain('Awaiting decision');
  });

  it('does not render the removed explanatory copy or generic diagnostic reason', () => {
    const incident = incidentFixture();
    incident.explanation.agents = configuredAgents();
    incident.explanation.trace!.toolCalls[0].reason = 'Default bounded diagnostic operation from the v1 catalog.';
    recreateWithIncident(incident);
    clickStage('Diagnose');

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Click a stage to see who was responsible and what that stage means.');
    expect(text).not.toContain('Configured collaboration');
    expect(text).not.toContain('Agent handoff chain');
    expect(text).not.toContain('Coordinate the bounded incident workflow and preserve handoff order.');
    expect(text).not.toContain('Classify the incident and produce an operator-readable triage summary.');
    expect(text).not.toContain('Collect bounded diagnostic evidence from approved operation IDs.');
    expect(text).not.toContain('Propose a structured remediation plan from triage and bounded evidence.');
    expect(text).not.toContain('Validate the proposed plan before it can be stored or approved.');
    expect(text).not.toContain('Execute approved remediation and fixed verification after human approval.');
    expect(text).not.toContain('Tools receive reviewed operation IDs and server-bound run context.');
    expect(text).not.toContain('Default bounded diagnostic operation from the v1 catalog.');
    expect(text).not.toContain('Output is redacted and capped before storage.');
  });

  it('keeps the current workflow step visible as active state advances', () => {
    expect(component.selectedStageId).toBe('approval');
    incidentAgent.get.mockReturnValue(of(incidentFixture('EXECUTING')));

    component.loadIncident(false);

    expect(component.selectedStageId).toBe('remediate');
    component.selectStage(component.workflowStages[1]);
    incidentAgent.get.mockReturnValue(of(incidentFixture('COMPLETED')));
    component.loadIncident(false);
    expect(component.selectedStageId).toBe('triage');
  });

  it('keeps technical evidence and hashes collapsed in details elements', () => {
    const summaries = Array.from(fixture.nativeElement.querySelectorAll('details summary'))
      .map((element: unknown) => (element as HTMLElement).textContent);

    expect(summaries).toContain('View bounded diagnostic output');
    expect(summaries).toContain('Model, workflow, and approval identifiers');
    expect(fixture.nativeElement.querySelector('details[open]')).toBeNull();
  });

  it('preserves role checks and submits the exact stored plan hash for approval', () => {
    const awaiting = incidentFixture();
    incidentAgent.get.mockReturnValue(of(incidentFixture('EXECUTING')));
    const readsBeforeDecision = incidentAgent.get.mock.calls.length;

    expect(component.canDecideIncident(awaiting)).toBe(true);
    component.approveIncident(awaiting);

    expect(modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
      nzTitle: 'Approve this bounded remediation?',
    }));
    expect(incidentAgent.approve).toHaveBeenCalledWith('inc-1', 'sha256:plan-1');
    expect(incidentAgent.get.mock.calls.length).toBe(readsBeforeDecision + 1);
    expect(component.incident?.state).toBe('EXECUTING');
    expect(message.success).toHaveBeenCalledWith('Remediation approved');

    auth.hasRole.mockReturnValue(false);
    expect(component.canDecideIncident(awaiting)).toBe(false);
    auth.hasRole.mockImplementation((role: string) => role === 'Admin');
    expect(component.canDecideIncident(awaiting)).toBe(true);
    expect(component.canDecideIncident({ ...awaiting, isPlanExpired: true })).toBe(false);
  });

  it('submits the exact stored plan hash when rejecting', () => {
    incidentAgent.get.mockReturnValue(of(incidentFixture('REJECTED')));

    component.rejectIncident(incidentFixture());

    expect(modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
      nzTitle: 'Reject this remediation plan?',
      nzOkDanger: true,
    }));
    expect(incidentAgent.reject).toHaveBeenCalledWith('inc-1', 'sha256:plan-1');
    expect(component.incident?.state).toBe('REJECTED');
  });

  it('reports stale decisions and refreshes the incident immediately', () => {
    incidentAgent.approve.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'Incident changed; review the latest plan' },
    })));
    const readsBeforeDecision = incidentAgent.get.mock.calls.length;

    component.approveIncident(incidentFixture());

    expect(message.error).toHaveBeenCalledWith('Incident changed; review the latest plan');
    expect(incidentAgent.get.mock.calls.length).toBe(readsBeforeDecision + 1);
  });

  it('refreshes active incidents every five seconds and stops after destruction', () => {
    incidentAgent.get.mockReturnValue(of(incidentFixture('DIAGNOSING')));
    component.loadIncident(false);
    const afterManualLoad = incidentAgent.get.mock.calls.length;

    vi.advanceTimersByTime(5000);
    expect(incidentAgent.get.mock.calls.length).toBe(afterManualLoad + 1);

    fixture.destroy();
    fixtureDestroyed = true;
    vi.advanceTimersByTime(10000);
    expect(incidentAgent.get.mock.calls.length).toBe(afterManualLoad + 1);
  });

  it('handles legacy incidents without trace metadata', () => {
    const legacy = incidentFixture();
    legacy.explanation.trace = undefined;
    component.incident = legacy;

    expect(component.trace).toEqual({ schemaVersion: 'v1', agentActions: [], toolCalls: [] });
    expect(component.toolCallsForPhase('diagnose')).toEqual([]);
  });
});
