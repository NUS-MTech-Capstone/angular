import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { apiPath } from '../core/api.constants';
import { IdentityService } from './identity.service';

describe('IdentityService', () => {
  let service: IdentityService;
  let httpMock: HttpTestingController;
  const baseUrl = apiPath('identity');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IdentityService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(IdentityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should list users at the ddm identity path', () => {
    service.listUsers().subscribe((users) => {
      expect(users).toEqual([]);
    });

    const req = httpMock.expectOne(`${baseUrl}/users`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should fetch the role catalog', () => {
    const catalog = { roles: ['Admin'], permissions: ['access.view'] };
    service.getRoleCatalog().subscribe((result) => expect(result).toEqual(catalog));

    const req = httpMock.expectOne(`${baseUrl}/roles`);
    expect(req.request.method).toBe('GET');
    req.flush(catalog);
  });

  it('should create a user', () => {
    const dto = {
      username: 'alice',
      email: 'alice@example.com',
      roles: ['Employee'],
    };
    service.createUser(dto).subscribe((user) => expect(user.username).toBe('alice'));

    const req = httpMock.expectOne(`${baseUrl}/users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ ...dto, enabled: true, status: 'CONFIRMED' });
  });

  it('should patch user status', () => {
    service.setUserStatus('alice', false).subscribe((user) => {
      expect(user.enabled).toBe(false);
    });

    const req = httpMock.expectOne(`${baseUrl}/users/alice/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({ username: 'alice', enabled: false, status: 'CONFIRMED', roles: [] });
  });

  it('should encode usernames when updating roles', () => {
    service.setUserRoles('alice@test', ['Admin']).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/users/alice%40test/roles`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ roles: ['Admin'] });
    req.flush({ username: 'alice@test', enabled: true, status: 'CONFIRMED', roles: ['Admin'] });
  });

  it('should get and update policies', () => {
    const policies = [{ role: 'Admin', permissions: ['access.view'] }];

    service.getPolicies().subscribe((result) => expect(result).toEqual(policies));
    httpMock.expectOne(`${baseUrl}/policies`).flush(policies);

    service.updatePolicies(policies).subscribe((result) => expect(result).toEqual(policies));
    const updateReq = httpMock.expectOne(`${baseUrl}/policies`);
    expect(updateReq.request.method).toBe('PUT');
    expect(updateReq.request.body).toEqual({ policies });
    updateReq.flush(policies);
  });
});
