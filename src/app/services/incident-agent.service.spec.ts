import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IncidentAgentService, IncidentDetail, IncidentListResponse } from './incident-agent.service';

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
  plan: {
    summary: 'Restart service',
    rationale: 'Health check failed',
    actions: [{ operationId: 'restart_service', reason: 'recover service' }],
  },
  approverSubject: '',
  report: '',
  errorMessage: '',
});

describe('IncidentAgentService', () => {
  let service: IncidentAgentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IncidentAgentService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(IncidentAgentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists incidents with a JSON accept header', () => {
    let result: IncidentListResponse | undefined;

    service.list().subscribe((response) => (result = response));

    const req = http.expectOne('/incidents');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({ incidents: [incidentDetail()] });

    expect(result?.incidents[0].id).toBe('inc-1');
  });

  it('loads one incident detail', () => {
    let result: IncidentDetail | undefined;

    service.get('inc-1').subscribe((response) => (result = response));

    const req = http.expectOne('/incidents/inc-1');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush(incidentDetail());

    expect(result?.plan.actions[0].operationId).toBe('restart_service');
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
