import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  InventoryChangeRequest,
  InventoryService,
  VirtualMachine,
} from '../../services/inventory.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { AuthService } from '../../services/auth.service';
import { Inventory } from './inventory';

describe('Inventory', () => {
  let component: Inventory;
  let fixture: ComponentFixture<Inventory>;
  let inventoryService: {
    findAll: ReturnType<typeof vi.fn>;
    findAllChangeRequests: ReturnType<typeof vi.fn>;
    submitChangeRequest: ReturnType<typeof vi.fn>;
    approveChangeRequest: ReturnType<typeof vi.fn>;
    rejectChangeRequest: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    adminUpdate: ReturnType<typeof vi.fn>;
    syncVms: ReturnType<typeof vi.fn>;
    setTags: ReturnType<typeof vi.fn>;
  };
  let implementerGroupService: {
    findAccessibleVms: ReturnType<typeof vi.fn>;
  };
  let authService: {
    user: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const sampleVm = (): VirtualMachine => ({
    id: 'vm-1',
    hostname: 'web-prod-01',
    ipAddress: '10.0.0.1',
    assetStatus: 'Active',
    osVersion: 'Amazon Linux 2023',
    sshPort: 22,
    tags: ['production', 'web'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const pendingChangeRequest = (): InventoryChangeRequest => ({
    id: 'icr-1',
    action: 'Update',
    status: 'Pending',
    requester: 'Alice',
    targetVmId: 'vm-1',
    hostname: 'web-prod-01',
    ipAddress: '10.0.0.2',
    assetStatus: 'Active',
    osVersion: 'Amazon Linux 2023',
    sshPort: 22,
    history: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(async () => {
    inventoryService = {
      findAll: vi.fn(() => of([sampleVm()])),
      findAllChangeRequests: vi.fn(() => of([pendingChangeRequest()])),
      submitChangeRequest: vi.fn(() => of(pendingChangeRequest())),
      approveChangeRequest: vi.fn(() =>
        of({ ...pendingChangeRequest(), status: 'Approved' }),
      ),
      rejectChangeRequest: vi.fn(() =>
        of({ ...pendingChangeRequest(), status: 'Rejected' }),
      ),
      remove: vi.fn(() => of(undefined)),
      adminUpdate: vi.fn(() => of(sampleVm())),
      syncVms: vi.fn(() => of({ created: 1, updated: 0, unchanged: 0 })),
      setTags: vi.fn(() => of({ ...sampleVm(), tags: ['staging'] })),
    };
    implementerGroupService = {
      findAccessibleVms: vi.fn(() =>
        of({ implementerGroups: [], osUsers: [], vms: [sampleVm()] }),
      ),
    };
    authService = {
      user: vi.fn(() => ({ username: 'testuser' })),
      hasPermission: vi.fn(() => true),
    };
    message = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Inventory],
      providers: [
        provideNzIcons(icons),
        { provide: InventoryService, useValue: inventoryService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
        { provide: AuthService, useValue: authService },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Inventory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads inventory data on init for admin users', () => {
    expect(component.showsFullInventory).toBe(true);
    expect(inventoryService.findAll).toHaveBeenCalled();
    expect(inventoryService.findAllChangeRequests).toHaveBeenCalled();
  });

  it('loads accessible VMs for non-admin users', async () => {
    authService.hasPermission.mockReturnValue(false);
    inventoryService.findAll.mockClear();

    const restrictedFixture = TestBed.createComponent(Inventory);
    await restrictedFixture.whenStable();

    expect(restrictedFixture.componentInstance.showsFullInventory).toBe(false);
    expect(inventoryService.findAll).not.toHaveBeenCalled();
    expect(implementerGroupService.findAccessibleVms).toHaveBeenCalled();
  });

  it('filters change requests by approval tab', () => {
    component.changeRequests = [
      pendingChangeRequest(),
      { ...pendingChangeRequest(), id: 'icr-2', status: 'Approved' },
    ];

    component.selectApprovalTab(1);
    expect(component.activeApprovalTab).toBe('Pending');
    expect(component.filteredChangeRequests).toHaveLength(1);

    component.selectApprovalTab(0);
    expect(component.activeApprovalTab).toBe('All');
    expect(component.filteredChangeRequests).toHaveLength(2);
  });

  it('detects pending update requests for a VM', () => {
    component.changeRequests = [pendingChangeRequest()];

    expect(component.hasPendingUpdate(sampleVm())).toBe(true);
    expect(component.hasPendingUpdate({ ...sampleVm(), id: 'vm-2' })).toBe(false);
  });

  it('maps asset, approval, and action colors', () => {
    expect(component.getAssetStatusColor('Active')).toBe('green');
    expect(component.getAssetStatusColor('Maintenance')).toBe('orange');
    expect(component.getApprovalStatusColor('Approved')).toBe('green');
    expect(component.getApprovalStatusColor('Rejected')).toBe('red');
    expect(component.getActionColor('Add')).toBe('blue');
    expect(component.getActionColor('Update')).toBe('purple');
  });

  it('opens add modal and submits a new change request', () => {
    component.openAddModal();
    component.vmForm.setValue({
      hostname: 'new-host',
      ipAddress: '10.0.0.9',
      assetStatus: 'Active',
      osVersion: 'Ubuntu 22.04',
      sshPort: 22,
      comments: 'New server',
    });

    component.submitForm();

    expect(inventoryService.submitChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Add', hostname: 'new-host' }),
    );
    expect(message.success).toHaveBeenCalledWith('Change request submitted for approval');
    expect(component.activeMainTab).toBe('approvals');
    expect(component.activeApprovalTab).toBe('Pending');
  });

  it('opens edit modal for VMs without pending updates', () => {
    component.changeRequests = [];
    component.editVm(sampleVm());

    expect(component.isModalOpen).toBe(true);
    expect(component.editingVmId).toBe('vm-1');
    expect(component.vmForm.value.hostname).toBe('web-prod-01');
  });

  it('blocks edit when a pending update exists', () => {
    component.changeRequests = [pendingChangeRequest()];
    component.editVm(sampleVm());

    expect(component.isModalOpen).toBe(false);
  });

  it('does not submit invalid VM forms', () => {
    component.openAddModal();
    component.submitForm();

    expect(inventoryService.submitChangeRequest).not.toHaveBeenCalled();
  });

  it('approves and rejects change requests', () => {
    const request = pendingChangeRequest();

    component.approveChangeRequest(request);
    expect(inventoryService.approveChangeRequest).toHaveBeenCalledWith('icr-1');
    expect(message.success).toHaveBeenCalledWith('Change request approved');

    component.rejectChangeRequest(request);
    expect(inventoryService.rejectChangeRequest).toHaveBeenCalledWith('icr-1');
    expect(message.success).toHaveBeenCalledWith('Change request rejected');
  });

  it('opens the change request drawer and deletes VMs', () => {
    component.viewChangeRequest(pendingChangeRequest());
    expect(component.isDrawerOpen).toBe(true);
    expect(component.selectedChangeRequest?.id).toBe('icr-1');

    component.deleteVm(sampleVm());
    expect(inventoryService.remove).toHaveBeenCalledWith('vm-1');
    expect(message.success).toHaveBeenCalledWith('web-prod-01 deleted');
  });

  it('opens VM details and admin edit modal', () => {
    component.viewVmDetails(sampleVm());
    expect(component.isDetailDrawerOpen).toBe(true);
    expect(component.detailVm?.hostname).toBe('web-prod-01');

    component.openAdminEditModal(sampleVm());
    component.adminVmForm.patchValue({ hostname: 'web-prod-02' });
    component.submitAdminForm();

    expect(inventoryService.adminUpdate).toHaveBeenCalledWith(
      'vm-1',
      expect.objectContaining({ hostname: 'web-prod-02' }),
    );
    expect(message.success).toHaveBeenCalledWith('web-prod-01 updated');
  });

  it('runs VM sync from valid JSON', () => {
    component.openSyncModal();
    component.syncJson = JSON.stringify([
      {
        hostname: 'sync-host',
        ipAddress: '10.0.0.5',
        osVersion: 'Ubuntu 22.04',
      },
    ]);

    component.runSync();

    expect(inventoryService.syncVms).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith(
      'Sync complete — 1 created, 0 updated, 0 unchanged',
    );
    expect(component.syncResult).toEqual({ created: 1, updated: 0, unchanged: 0 });
  });

  it('rejects invalid sync JSON', () => {
    component.syncJson = '{not-json';
    component.runSync();

    expect(inventoryService.syncVms).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      'Invalid JSON — expected an array of server records',
    );
  });

  it('filters VMs by tags and edits tags', () => {
    component.virtualMachines = [
      sampleVm(),
      { ...sampleVm(), id: 'vm-2', tags: ['staging'] },
    ];

    expect(component.allTags).toEqual(['production', 'staging', 'web']);

    component.selectedTagFilter = ['production'];
    expect(component.filteredVirtualMachines).toHaveLength(1);

    component.openTagEditor(sampleVm());
    component.editingTags = ['staging'];
    component.saveTags(sampleVm());

    expect(inventoryService.setTags).toHaveBeenCalledWith('vm-1', ['staging']);
    expect(message.success).toHaveBeenCalledWith('Tags updated');
  });

  it('cancels tag editing', () => {
    component.openTagEditor(sampleVm());
    component.cancelTagEditor();

    expect(component.editingTagsVmId).toBeUndefined();
    expect(component.editingTags).toEqual([]);
  });

  it('assigns deterministic tag colors', () => {
    expect(component.getTagColor('production')).toBe(component.getTagColor('production'));
    expect(typeof component.getTagColor('web')).toBe('string');
  });

  it('switches main tabs', () => {
    component.selectMainTab('approvals');
    expect(component.activeMainTab).toBe('approvals');
  });

  it('shows an error when VM submission fails', () => {
    inventoryService.submitChangeRequest.mockReturnValue(
      throwError(() => ({ error: { message: 'Duplicate hostname' } })),
    );
    component.openAddModal();
    component.vmForm.setValue({
      hostname: 'dup',
      ipAddress: '10.0.0.9',
      assetStatus: 'Active',
      osVersion: 'Ubuntu 22.04',
      sshPort: 22,
      comments: null,
    });

    component.submitForm();

    expect(message.error).toHaveBeenCalledWith('Duplicate hostname');
    expect(component.isSubmitting).toBe(false);
  });
});
