import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionAuditService } from './session-audit.service';

describe('SessionAuditService', () => {
  let service: SessionAuditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionAuditService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(SessionAuditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists audit sessions with filters', () => {
    service.listSessions({ userId: 'user-1', hostId: 'host-1', limit: 25 }).subscribe();

    const req = http.expectOne('http://localhost:3000/ddm/session-audit/sessions?userId=user-1&hostId=host-1&limit=25');
    expect(req.request.method).toBe('GET');
    req.flush({ sessions: [] });
  });

  it('lists records for a session', () => {
    service.listRecords('sess-1', 100, '10').subscribe();

    const req = http.expectOne('http://localhost:3000/ddm/session-audit/sessions/sess-1/records?limit=100&cursor=10');
    expect(req.request.method).toBe('GET');
    req.flush({ records: [] });
  });
});
