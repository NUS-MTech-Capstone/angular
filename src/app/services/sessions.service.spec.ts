import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessionsApiService, SessionRecord, SessionStartResponse } from './sessions.service';
import { apiPath } from '../core/api.constants';

const BASE_URL = apiPath('sessions');

const mockSession = (): SessionRecord => ({
  id: 'session-1',
  hostId: 'host-1',
  hostname: 'web01',
  ipAddress: '10.0.0.1',
  sshPort: 22,
  crId: 'cr-1',
  crNumber: 'CR-ABCD1234',
  osUser: 'root',
  createdBy: 'tech.dev',
  status: 'active',
  startedAt: '2026-06-18T00:00:00.000Z',
  createdAt: '2026-06-18T00:00:00.000Z',
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

  describe('start', () => {
    it('POSTs to /start with payload and returns session response', () => {
      const payload = { hostId: 'host-1', crId: 'cr-1', osUser: 'root' };
      const response: SessionStartResponse = {
        websocketUrl: 'wss://gw/ws',
        sessionToken: 'tok',
        sessionId: 'session-1',
        scopedJwt: 'jwt',
      };
      let result: SessionStartResponse | undefined;

      service.start(payload).subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/start`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(response);

      expect(result).toEqual(response);
    });
  });

  describe('listActive', () => {
    it('GETs /active without params when hostId is omitted', () => {
      service.listActive().subscribe();

      const req = http.expectOne(`${BASE_URL}/active`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('GETs /active with hostId query param when provided', () => {
      service.listActive('host-1').subscribe();

      const req = http.expectOne((r) => r.url === `${BASE_URL}/active`);
      expect(req.request.params.get('hostId')).toBe('host-1');
      req.flush([mockSession()]);
    });
  });

  describe('listMine', () => {
    it('GETs /mine', () => {
      let result: SessionRecord[] | undefined;
      service.listMine().subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/mine`);
      expect(req.request.method).toBe('GET');
      req.flush([mockSession()]);

      expect(result?.length).toBe(1);
    });
  });

  describe('getToken', () => {
    it('GETs /:id/token for reconnect', () => {
      const tokenResponse = {
        websocketUrl: 'wss://gw/ws',
        sessionToken: 'tok',
        scopedJwt: 'jwt',
      };
      let result: typeof tokenResponse | undefined;

      service.getToken('session-1').subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/session-1/token`);
      expect(req.request.method).toBe('GET');
      req.flush(tokenResponse);

      expect(result).toEqual(tokenResponse);
    });
  });

  describe('getOne', () => {
    it('GETs /:id', () => {
      service.getOne('session-1').subscribe();

      const req = http.expectOne(`${BASE_URL}/session-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSession());
    });
  });

  describe('end', () => {
    it('PATCHes /:id/end', () => {
      let result: SessionRecord | undefined;
      service.end('session-1').subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/session-1/end`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ ...mockSession(), status: 'ended' });

      expect(result?.status).toBe('ended');
    });
  });
});
