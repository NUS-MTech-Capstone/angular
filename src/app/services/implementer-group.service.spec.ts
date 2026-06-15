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

    const req = httpMock.expectOne(apiPath('implementer-groups'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
