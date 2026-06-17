import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  InventoryService,
  VirtualMachine,
  InventoryChangeRequest,
  CreateInventoryChangeRequestDto,
} from './inventory.service';

const VMS_URL = 'http://localhost:3000/ddm/inventory/vms';
const CRS_URL = 'http://localhost:3000/ddm/inventory/change-requests';

const mockVm = (): VirtualMachine => ({
  id: 'vm-1',
  hostname: 'web01',
  ipAddress: '10.0.0.1',
  assetStatus: 'Active',
  osVersion: 'Ubuntu 22.04',
  sshPort: 22,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const mockCr = (): InventoryChangeRequest => ({
  id: 'icr-1',
  action: 'Add',
  status: 'Pending',
  requester: 'Alice',
  hostname: 'web01',
  ipAddress: '10.0.0.1',
  assetStatus: 'Active',
  osVersion: 'Ubuntu 22.04',
  sshPort: 22,
  history: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('InventoryService', () => {
  let service: InventoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InventoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('findAll', () => {
    it('sends GET to VMs endpoint and returns array', () => {
      const vms = [mockVm()];
      let result: VirtualMachine[] | undefined;

      service.findAll().subscribe((r) => (result = r));

      const req = http.expectOne(VMS_URL);
      expect(req.request.method).toBe('GET');
      req.flush(vms);

      expect(result).toEqual(vms);
    });
  });

  describe('findOne', () => {
    it('sends GET to /vms/:id and returns the VM', () => {
      let result: VirtualMachine | undefined;

      service.findOne('vm-1').subscribe((r) => (result = r));

      const req = http.expectOne(`${VMS_URL}/vm-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockVm());

      expect(result?.id).toBe('vm-1');
    });
  });

  describe('remove', () => {
    it('sends DELETE to /vms/:id', () => {
      let result: { deleted: boolean } | undefined;

      service.remove('vm-1').subscribe((r) => (result = r));

      const req = http.expectOne(`${VMS_URL}/vm-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ deleted: true });

      expect(result).toEqual({ deleted: true });
    });
  });

  describe('findAllChangeRequests', () => {
    it('sends GET to change-requests endpoint', () => {
      const crs = [mockCr()];
      let result: InventoryChangeRequest[] | undefined;

      service.findAllChangeRequests().subscribe((r) => (result = r));

      const req = http.expectOne(CRS_URL);
      expect(req.request.method).toBe('GET');
      req.flush(crs);

      expect(result).toEqual(crs);
    });
  });

  describe('submitChangeRequest', () => {
    it('sends POST with DTO body', () => {
      const dto: CreateInventoryChangeRequestDto = {
        action: 'Add',
        hostname: 'web01',
        ipAddress: '10.0.0.1',
        osVersion: 'Ubuntu 22.04',
      };
      let result: InventoryChangeRequest | undefined;

      service.submitChangeRequest(dto).subscribe((r) => (result = r));

      const req = http.expectOne(CRS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(mockCr());

      expect(result?.hostname).toBe('web01');
    });
  });

  describe('approveChangeRequest', () => {
    it('sends PATCH to /change-requests/:id/approve', () => {
      service.approveChangeRequest('icr-1').subscribe();

      const req = http.expectOne(`${CRS_URL}/icr-1/approve`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockCr(), status: 'Approved' });
    });
  });

  describe('rejectChangeRequest', () => {
    it('sends PATCH to /change-requests/:id/reject', () => {
      service.rejectChangeRequest('icr-1').subscribe();

      const req = http.expectOne(`${CRS_URL}/icr-1/reject`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockCr(), status: 'Rejected' });
    });
  });
});
