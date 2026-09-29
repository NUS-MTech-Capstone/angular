import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  AlertListResponse,
  IncidentAgentService,
  IncidentDetail,
  IncidentListResponse,
  ManagedAlertDetail,
} from './incident-agent.service';

const incidentDetail = (): IncidentDetail => ({
  id: 'inc-1',
  sourceId: 'alarm-1',
  alarmArn: 'arn:aws:cloudwatch:alarm',
  alarmName: 'High 5xx',
  hostId: 'host-dev-1',
  state: 'AWAITING_APPROVAL',
  reason: 'HTTP 500 responses',
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
  explanation: {
    model: {
      provider: 'bedrock',
      plannerType: 'bedrock',
      modelId: 'global.amazon.nova-2-lite-v1:0',
      awsRegion: 'ap-southeast-1',
      temperature: 0,
      maxPromptBytes: 131072,
      promptTemplates: { 'plan_system.md.j2': 'hash' },
    },
    workflow: {
      graphVersion: 'v1',
      catalogVersion: 'v1',
      diagnosticOperations: ['target_probe', 'health_check'],
      verificationOperations: ['service_status', 'health_check'],
      runId: 'run-1',
      planHash: 'hash-1',
    },
    agents: [
      {
        name: 'Evidence Collector Agent',
        purpose: 'Collect bounded diagnostic evidence from approved operation IDs.',
        responsibilities: [
          'Start a bounded automation run.',
          'Execute diagnostic operation IDs from the v1 catalog.',
        ],
        reasoningType: 'deterministic policy',
        memory: 'incident-local operation results',
        tools: ['Agent Control Plane automation API', 'STS capability tokens'],
        inputs: ['incident ID', 'host ID', 'diagnostic operation catalog'],
        outputs: ['bounded OperationResult list'],
        handoffTo: 'Action Plan Agent',
      },
    ],
    toolDecisions: [
      {
        operationId: 'target_probe',
        phase: 'diagnose',
        chosenBy: 'policy',
        reason: 'default diagnostic',
      },
    ],
    guardrails: [{ name: 'catalog_validation', passed: true, reason: 'operation is supported' }],
    responsibility: {
      modelAdvisory: true,
      humanApprovalRequired: true,
      executionOwner: 'agent-controlplane',
      tokenIssuer: 'sts',
      terminalTraffic: 'not handled by incident-agent or agent-controlplane',
    },
  },
  planExpiresAt: '2026-01-01T00:35:00Z',
  isPlanExpired: false,
  approverSubject: '',
  report: '',
  errorMessage: '',
  postIncidentStatus: '',
  postIncidentSummary: '',
  postIncidentReport: {
    rootCauseSummary: '',
    actionTaken: '',
    verificationSummary: '',
    finalState: '',
    startedAt: null,
    resolvedAt: null,
    durationSeconds: null,
  },
  timeline: [],
  approvalDecisions: [],
});

const alertDetail = (): ManagedAlertDetail => ({
  id: 'alert-1',
  sourceId: 'arn:alarm|2026-01-01T00:00:00Z|ALARM',
  sourceType: 'managed-server',
  alarmArn: 'arn:alarm',
  alarmName: 'High 5xx',
  cloudwatchState: 'ALARM',
  hostId: 'host-dev-1',
  reason: 'threshold breached',
  status: 'PENDING_APPROVAL',
  groupKey: 'managed-server|host-dev-1|High 5xx',
  incidentId: 'inc-1',
  grouped: false,
  errorSummary: '',
  occurredAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:01Z',
  updatedAt: '2026-01-01T00:05:00Z',
  incident: incidentDetail(),
});

describe('IncidentAgentService', () => {
  let service: IncidentAgentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IncidentAgentService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IncidentAgentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists alerts with filters and a JSON accept header', () => {
    let result: AlertListResponse | undefined;

    service
      .listAlerts({
        incidentId: 'inc-1',
        hostId: 'host-dev-1',
        status: 'PENDING_APPROVAL',
        limit: 25,
      })
      .subscribe((response) => (result = response));

    const req = http.expectOne(
      '/alerts?incidentId=inc-1&hostId=host-dev-1&status=PENDING_APPROVAL&limit=25',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({ alerts: [alertDetail()] });

    expect(result?.alerts[0].status).toBe('PENDING_APPROVAL');
  });

  it('loads one alert detail', () => {
    let result: ManagedAlertDetail | undefined;

    service.getAlert('alert-1').subscribe((response) => (result = response));

    const req = http.expectOne('/alerts/alert-1');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(alertDetail());

    expect(result?.incident?.id).toBe('inc-1');
  });

  it('loads agent health', () => {
    let result: { databaseReady: boolean } | undefined;

    service.getHealth().subscribe((response) => (result = response));

    const req = http.expectOne('/agentic-ai/health');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({
      databaseReady: true,
      queueConsumerConfigured: true,
      queueConsumerRunning: true,
      lastAlertProcessedAt: '2026-01-01T00:00:00Z',
      lastErrorSummary: '',
      activeIncidentCount: 1,
      failedIncidentCount: 0,
    });

    expect(result?.databaseReady).toBe(true);
  });

  it('lists incidents with filters and a JSON accept header', () => {
    let result: IncidentListResponse | undefined;

    service
      .list({ alertId: 'alert-1', hostId: 'host-dev-1', state: 'AWAITING_APPROVAL', limit: 25 })
      .subscribe((response) => (result = response));

    const req = http.expectOne(
      '/incidents?alertId=alert-1&hostId=host-dev-1&state=AWAITING_APPROVAL&limit=25',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({ incidents: [incidentDetail()] });

    expect(result?.incidents[0].id).toBe('inc-1');
  });

  it('lists incident events with filters', () => {
    service
      .listEvents({ incidentId: 'inc-1', alertId: 'alert-1', eventType: 'PlanApproved', limit: 25 })
      .subscribe();

    const req = http.expectOne(
      '/incidents/events?incidentId=inc-1&alertId=alert-1&eventType=PlanApproved&limit=25',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({ events: [] });
  });

  it('loads one incident detail', () => {
    let result: IncidentDetail | undefined;

    service.get('inc-1').subscribe((response) => (result = response));

    const req = http.expectOne('/incidents/inc-1');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(incidentDetail());

    expect(result?.plan.actions[0].operationId).toBe('restart_service');
    expect(result?.explanation.agents[0].name).toBe('Evidence Collector Agent');
    expect(result?.explanation.toolDecisions[0].operationId).toBe('target_probe');
  });

  it('normalizes nullable incident detail lists from the live API', () => {
    let result: IncidentDetail | undefined;

    service.get('inc-1').subscribe((response) => (result = response));

    const req = http.expectOne('/incidents/inc-1');
    req.flush({
      ...incidentDetail(),
      evidence: null,
      timeline: null,
      approvalDecisions: null,
      plan: { ...incidentDetail().plan, actions: null },
      explanation: {
        ...incidentDetail().explanation,
        agents: null,
        toolDecisions: null,
        guardrails: null,
      },
    });

    expect(result?.evidence).toEqual([]);
    expect(result?.plan.actions).toEqual([]);
    expect(result?.explanation.agents).toEqual([]);
    expect(result?.explanation.toolDecisions).toEqual([]);
    expect(result?.explanation.guardrails).toEqual([]);
    expect(result?.timeline).toEqual([]);
    expect(result?.approvalDecisions).toEqual([]);
  });

  it('approves an exact plan hash', () => {
    service.approve('inc-1', 'hash-1').subscribe();

    const req = http.expectOne('/incidents/inc-1/approve');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual({ planHash: 'hash-1' });
    req.flush({ ...incidentDetail(), state: 'EXECUTING' });
  });

  it('rejects an exact plan hash', () => {
    service.reject('inc-1', 'hash-1').subscribe();

    const req = http.expectOne('/incidents/inc-1/reject');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual({ planHash: 'hash-1' });
    req.flush({ ...incidentDetail(), state: 'REJECTED' });
  });
});
