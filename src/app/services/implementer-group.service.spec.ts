import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { apiPath } from '../core/api.constants';
import { ImplementerGroupService } from './implementer-group.service';

describe('ImplementerGroupService', () => {
  let service: ImplementerGroupService;
  let httpMock: HttpTestingController;
  const baseUrl = apiPath('implementer-groups');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ImplementerGroupService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ImplementerGroupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should find all groups at the ddm implementer-groups path', () => {
    service.findAll().subscribe((groups) => {
      expect(groups).toEqual([]);
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should fetch accessible VMs', () => {
    const assets = { implementerGroups: [], osUsers: [], vms: [] };
    service.findAccessibleVms().subscribe((result) => expect(result).toEqual(assets));

    const req = httpMock.expectOne(`${baseUrl}/accessible-vms`);
    expect(req.request.method).toBe('GET');
    req.flush(assets);
  });

  it('should create, update, and remove groups', () => {
    const dto = { name: 'Platform Engineering', osUsers: ['deploy-bot'] };
    service.create(dto).subscribe((group) => expect(group.name).toBe(dto.name));
    httpMock.expectOne(baseUrl).flush({ id: 'group-1', ...dto });

    service.update('group-1', { description: 'Updated' }).subscribe();
    const patchReq = httpMock.expectOne(`${baseUrl}/group-1`);
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ id: 'group-1', ...dto, description: 'Updated' });

    service.remove('group-1').subscribe((result) => expect(result.success).toBe(true));
    const deleteReq = httpMock.expectOne(`${baseUrl}/group-1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });
  });

  it('should manage membership requests', () => {
    const dto = {
      username: 'alice',
      implementerGroupId: 'group-1',
      requester: 'bob',
    };

    service.findMembershipRequests('Pending').subscribe();
    httpMock.expectOne(`${baseUrl}/membership-requests?status=Pending`).flush([]);

    service.createMembershipRequest(dto).subscribe();
    const createReq = httpMock.expectOne(`${baseUrl}/membership-requests`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ id: 'req-1', ...dto, status: 'Pending', history: [] });

    service.approveMembershipRequest('req-1').subscribe();
    httpMock.expectOne(`${baseUrl}/membership-requests/req-1/approve`).flush({
      id: 'req-1',
      status: 'Approved',
    });

    service.rejectMembershipRequest('req-1').subscribe();
    httpMock.expectOne(`${baseUrl}/membership-requests/req-1/reject`).flush({
      id: 'req-1',
      status: 'Rejected',
    });
  });

  it('should list and remove group members', () => {
    service.findMembers('group-1').subscribe((members) => expect(members).toEqual([]));
    httpMock.expectOne(`${baseUrl}/group-1/members`).flush([]);

    service.removeMember('group-1', 'alice@test').subscribe();
    const req = httpMock.expectOne(`${baseUrl}/group-1/members/alice%40test`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
