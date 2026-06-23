import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  GatewaySession,
  ListSessionsResponse,
  SessionConnectionResponse,
  SessionStartResponse,
  SessionsApiService,
} from './sessions.service';
import { gatewayPath } from '../core/api.constants';

const BASE_URL = gatewayPath('sessions');

const mockSession = (): GatewaySession => ({
  sessionId: 'session-1',
  userId: 'user-sub',
  hostId: 'host-1',
  crId: 'cr-1',
  connectionType: 'ssh',
  status: 'ACTIVE',
  createdAt: '2026-06-18T00:00:00.000Z',
  lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
  leaseExpiresAt: '2026-06-18T00:06:00.000Z',
});

describe('SessionsApiService', () => {
  let service: SessionsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SessionsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs gateway start payload and returns session response', () => {
    const payload = { hostId: 'host-1', crId: 'cr-1', connectionType: 'ssh' };
    const response: SessionStartResponse = {
      sessionId: 'session-1',
      sessionToken: 'tok',
      websocketUrl: 'wss://gw/ws',
      expiresAt: '2026-06-21T10:00:00.000Z',
    };
    let result: SessionStartResponse | undefined;

    service.start(payload).subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE_URL}/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('GETs gateway sessions with optional filters', () => {
    const response: ListSessionsResponse = { sessions: [mockSession()] };
    let result: ListSessionsResponse | undefined;

    service.list({ hostId: 'host-1', crId: 'cr-1', status: 'ACTIVE', mine: true })
      .subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === BASE_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('hostId')).toBe('host-1');
    expect(req.request.params.get('crId')).toBe('cr-1');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('mine')).toBe('true');
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('POSTs to gateway rejoin and returns websocket credentials', () => {
    const rejoinResponse: SessionConnectionResponse = {
      sessionId: 'session-1',
      sessionToken: 'tok',
      websocketUrl: 'wss://gw/ws',
      expiresAt: '2026-06-21T10:00:00.000Z',
    };
    let result: SessionConnectionResponse | undefined;

    service.rejoin('session-1').subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE_URL}/session-1/rejoin`);
    expect(req.request.method).toBe('POST');
    req.flush(rejoinResponse);

    expect(result).toEqual(rejoinResponse);
  });

  it('POSTs to gateway observe and returns websocket credentials', () => {
    const observeResponse: SessionConnectionResponse = {
      sessionId: 'session-1',
      sessionToken: 'tok',
      websocketUrl: 'wss://gw/ws',
      expiresAt: '2026-06-21T10:00:00.000Z',
    };
    let result: SessionConnectionResponse | undefined;

    service.observe('session-1').subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE_URL}/session-1/observe`);
    expect(req.request.method).toBe('POST');
    req.flush(observeResponse);

    expect(result).toEqual(observeResponse);
  });

  it('POSTs to gateway close and returns the closed session', () => {
    const closedSession: GatewaySession = {
      ...mockSession(),
      status: 'CLOSED',
    };
    let result: GatewaySession | undefined;

    service.close('session-1').subscribe((r) => (result = r));

    const req = http.expectOne(`${BASE_URL}/session-1/close`);
    expect(req.request.method).toBe('POST');
    req.flush(closedSession);

    expect(result).toEqual(closedSession);
  });
});
