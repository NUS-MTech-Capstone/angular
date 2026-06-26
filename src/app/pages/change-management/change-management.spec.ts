import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  ChangeRequest,
  ChangeRequestService,
} from '../../services/change-request.service';
import { AuthService } from '../../services/auth.service';
import { InventoryService } from '../../services/inventory.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { ChangeManagement } from './change-management';

describe('ChangeManagement', () => {
  let component: ChangeManagement;
  let fixture: ComponentFixture<ChangeManagement>;
  let changeRequestService: {
    findAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
  };

  const pendingRequest = (): ChangeRequest => ({
    id: 'd0000001-0000-4000-8000-000000000001',
    title: 'Deploy patch',
    description: 'Apply security patches',
    requester: 'Alice',
    approvalRoute: 'Normal',
    status: 'Pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    history: [],
    activities: ['restart service'],
    vmIds: ['vm-1'],
    allowedRoles: ['Employee'],
    implementerGroupIds: ['group-1'],
    implementationStartAt: '2026-12-01T00:00:00.000Z',
    implementationEndAt: '2026-12-02T00:00:00.000Z',
  });

  beforeEach(async () => {
    changeRequestService = {
      findAll: vi.fn(() => of([pendingRequest()])),
      create: vi.fn(() => of(pendingRequest())),
      update: vi.fn(() => of(pendingRequest())),
      approve: vi.fn(() => of(pendingRequest())),
      reject: vi.fn(() => of(pendingRequest())),
    };

    await TestBed.configureTestingModule({
      imports: [ChangeManagement],
      providers: [
        provideNzIcons(icons),
        { provide: ChangeRequestService, useValue: changeRequestService },
        {
          provide: InventoryService,
          useValue: { findAll: vi.fn(() => of([])) },
        },
        {
          provide: ImplementerGroupService,
          useValue: { findAll: vi.fn(() => of([])) },
        },
        {
          provide: AuthService,
          useValue: {
            user: vi.fn(() => ({ username: 'alice', name: 'Alice' })),
            hasPermission: vi.fn(() => true),
          },
        },
        {
          provide: NzMessageService,
          useValue: { success: vi.fn(), error: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads change requests on init', () => {
    expect(changeRequestService.findAll).toHaveBeenCalled();
    expect(component.changeRequests).toHaveLength(1);
  });

  it('filters requests by active tab', () => {
    component.changeRequests = [
      pendingRequest(),
      { ...pendingRequest(), id: 'cr-2', status: 'Approved' },
    ];

    component.selectTab('Pending');

    expect(component.activeTab).toBe('Pending');
    expect(component.filteredRequests).toHaveLength(1);
    expect(component.filteredRequests[0].status).toBe('Pending');
  });

  it('formats change request numbers and modal titles', () => {
    const request = pendingRequest();

    expect(component.crNumber(request)).toBe('CR-00000001');
    component.cloneRequest(request);
    expect(component.modalTitle).toBe('Clone from CR-00000001');
    component.openCreateModal();
    expect(component.modalTitle).toBe('New change request');
  });

  it('rejects past implementation start dates', () => {
    const control = { value: new Date('2020-01-01T00:00:00.000Z') };

    expect(component.futureDateValidator(control as never)).toEqual({
      pastDate: true,
    });
  });

  it('rejects implementation windows where end is not after start', () => {
    const start = new Date('2026-12-02T00:00:00.000Z');
    const end = new Date('2026-12-01T00:00:00.000Z');
    const group = {
      get: vi.fn((key: string) =>
        key === 'implementationStartAt'
          ? { value: start }
          : { value: end },
      ),
    };

    expect(component.implementationWindowValidator(group as never)).toEqual({
      invalidRange: true,
    });
  });

  it('opens edit modal only for pending requests', () => {
    component.editRequest({ ...pendingRequest(), status: 'Approved' });
    expect(component.isModalOpen).toBe(false);

    component.editRequest(pendingRequest());
    expect(component.isModalOpen).toBe(true);
    expect(component.editingRequestId).toBe(pendingRequest().id);
  });

  it('does not submit invalid forms', () => {
    component.openCreateModal();
    component.submitForm();

    expect(changeRequestService.create).not.toHaveBeenCalled();
    expect(changeRequestService.update).not.toHaveBeenCalled();
  });
});
