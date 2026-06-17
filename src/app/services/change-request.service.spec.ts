import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeRequestService, ChangeRequest, CreateChangeRequestDto } from './change-request.service';

const BASE_URL = 'http://localhost:3000/ddm/change-requests';

const mockCr = (): ChangeRequest => ({
  id: 'cr-1',
  title: 'Deploy patch',
  description: 'Apply security patches',
  requester: 'Alice',
  approvalRoute: 'Normal',
  status: 'Pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  history: [],
  activities: [],
  vmIds: [],
  allowedRoles: [],
  implementerGroupIds: [],
});

describe('ChangeRequestService', () => {
  let service: ChangeRequestService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChangeRequestService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ChangeRequestService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('findAll', () => {
    it('sends GET to base URL and returns array of change requests', () => {
      const crs = [mockCr()];
      let result: ChangeRequest[] | undefined;

      service.findAll().subscribe((r) => (result = r));

      const req = http.expectOne(BASE_URL);
      expect(req.request.method).toBe('GET');
      req.flush(crs);

      expect(result).toEqual(crs);
    });
  });

  describe('findAccessible', () => {
    it('sends GET to /accessible endpoint', () => {
      service.findAccessible().subscribe();

      const req = http.expectOne(`${BASE_URL}/accessible`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('findOne', () => {
    it('sends GET to /id endpoint', () => {
      let result: ChangeRequest | undefined;

      service.findOne('cr-1').subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/cr-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockCr());

      expect(result?.id).toBe('cr-1');
    });
  });

  describe('create', () => {
    it('sends POST with DTO body and returns created CR', () => {
      const dto: CreateChangeRequestDto = {
        title: 'Deploy patch',
        description: 'Apply patches',
        approvalRoute: 'Normal',
      };
      let result: ChangeRequest | undefined;

      service.create(dto).subscribe((r) => (result = r));

      const req = http.expectOne(BASE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(mockCr());

      expect(result?.title).toBe('Deploy patch');
    });
  });

  describe('update', () => {
    it('sends PATCH to /id with partial DTO', () => {
      const dto = { title: 'Updated title' };

      service.update('cr-1', dto).subscribe();

      const req = http.expectOne(`${BASE_URL}/cr-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush({ ...mockCr(), title: 'Updated title' });
    });
  });

  describe('approve', () => {
    it('sends PATCH to /id/approve with empty body', () => {
      service.approve('cr-1').subscribe();

      const req = http.expectOne(`${BASE_URL}/cr-1/approve`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockCr(), status: 'Approved' });
    });
  });

  describe('reject', () => {
    it('sends PATCH to /id/reject with empty body', () => {
      service.reject('cr-1').subscribe();

      const req = http.expectOne(`${BASE_URL}/cr-1/reject`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockCr(), status: 'Rejected' });
    });
  });
});
