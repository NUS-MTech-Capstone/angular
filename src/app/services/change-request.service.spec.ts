import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { apiPath } from '../core/api.constants';
import { ChangeRequestService } from './change-request.service';

describe('ChangeRequestService', () => {
  let service: ChangeRequestService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChangeRequestService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ChangeRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should find accessible change requests at the ddm path', () => {
    service.findAccessible().subscribe((requests) => {
      expect(requests).toEqual([]);
    });

    const req = httpMock.expectOne(`${apiPath('change-requests')}/accessible`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
