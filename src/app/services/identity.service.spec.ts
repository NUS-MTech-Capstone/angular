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

    const req = httpMock.expectOne(`${apiPath('identity')}/users`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
