import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ASSET_STATUS_OPTIONS,
  AssetStatus,
  InventoryChangeRequest,
  InventoryChangeStatus,
  InventoryService,
  SyncResult,
  SyncVmRecord,
  VirtualMachine,
} from '../../services/inventory.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDividerModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpaceModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  templateUrl: './inventory.html',
  styleUrls: ['./inventory.css'],
})
export class Inventory implements OnInit {
  activeMainTab: 'servers' | 'approvals' = 'servers';
  activeApprovalTab: 'All' | InventoryChangeStatus = 'Pending';
  isModalOpen = false;
  isDrawerOpen = false;
  vmForm!: FormGroup;
  editingVmId?: string;
  virtualMachines: VirtualMachine[] = [];
  showsFullInventory = false;
  changeRequests: InventoryChangeRequest[] = [];
  filteredChangeRequests: InventoryChangeRequest[] = [];
  selectedChangeRequest?: InventoryChangeRequest;
  isLoading = false;
  isLoadingRequests = false;
  isSubmitting = false;
  assetStatusOptions = ASSET_STATUS_OPTIONS;

  // Tag management
  editingTagsVmId: string | undefined;
  editingTags: string[] = [];
  isSavingTags = false;
  selectedTagFilter: string[] = [];

  // Detail drawer
  isDetailDrawerOpen = false;
  detailVm?: VirtualMachine;

  // Admin direct-create/edit modal
  isAdminModalOpen = false;
  adminEditingVmId?: string;
  adminVmForm!: FormGroup;
  isAdminSubmitting = false;

  // Sync modal
  isSyncModalOpen = false;
  syncJson = '';
  isSyncing = false;
  syncResult?: SyncResult;

  readonly SAMPLE_SYNC_PAYLOAD: SyncVmRecord[] = [
    { hostname: 'cloud-web-01', ipAddress: '172.31.10.1', osVersion: 'Ubuntu 22.04', sshPort: 22, assetStatus: 'Active', tags: ['production', 'web'] },
    { hostname: 'cloud-db-01',  ipAddress: '172.31.10.2', osVersion: 'Ubuntu 20.04', sshPort: 22, assetStatus: 'Active', tags: ['production', 'database'] },
    { hostname: 'cloud-app-01', ipAddress: '172.31.10.3', osVersion: 'RHEL 9',       sshPort: 22, assetStatus: 'Active', tags: ['production', 'app'] },
  ];

  constructor(
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private inventoryService: InventoryService,
    private implementerGroupService: ImplementerGroupService,
    private auth: AuthService,
    private message: NzMessageService,
  ) {
    this.vmForm = this.fb.group({
      hostname: [null as string | null, [Validators.required]],
      ipAddress: [null as string | null, [Validators.required]],
      assetStatus: ['Active' as AssetStatus, [Validators.required]],
      osVersion: [null as string | null, [Validators.required]],
      sshPort: [22, [Validators.required, Validators.min(1), Validators.max(65535)]],
      comments: [null as string | null],
    });

    this.adminVmForm = this.fb.group({
      hostname: [null as string | null, [Validators.required]],
      ipAddress: [null as string | null, [Validators.required]],
      assetStatus: ['Active' as AssetStatus, [Validators.required]],
      osVersion: [null as string | null, [Validators.required]],
      sshPort: [22, [Validators.required, Validators.min(1), Validators.max(65535)]],
    });
  }

  ngOnInit(): void {
    this.showsFullInventory =
      this.can('inventory.approve') || this.can('inventory.delete');
    this.loadVirtualMachines();
    this.loadChangeRequests();
  }

  selectMainTab(tab: 'servers' | 'approvals'): void {
    this.activeMainTab = tab;
  }

  approvalTabOptions: Array<'All' | InventoryChangeStatus> = [
    'All',
    'Pending',
    'Approved',
    'Rejected',
  ];

  selectApprovalTab(index: number): void {
    this.activeApprovalTab = this.approvalTabOptions[index];
    this.filterChangeRequests();
  }

  private loadVirtualMachines(): void {
    this.isLoading = true;
    const request$ = this.showsFullInventory
      ? this.inventoryService.findAll()
      : this.implementerGroupService
          .findAccessibleVms()
          .pipe(map((assets) => assets.vms));

    request$.subscribe({
      next: (data) => {
        this.virtualMachines = data;
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load virtual machines');
        this.isLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  private loadChangeRequests(): void {
    this.isLoadingRequests = true;
    this.inventoryService.findAllChangeRequests().subscribe({
      next: (data) => {
        this.changeRequests = data;
        this.filterChangeRequests();
        this.isLoadingRequests = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load change requests');
        this.isLoadingRequests = false;
        this.cd.detectChanges();
      },
    });
  }

  filterChangeRequests(): void {
    this.filteredChangeRequests = this.changeRequests.filter((request) => {
      if (this.activeApprovalTab === 'All') {
        return true;
      }
      return request.status === this.activeApprovalTab;
    });
  }

  hasPendingUpdate(vm: VirtualMachine): boolean {
    return this.changeRequests.some(
      (request) =>
        request.status === 'Pending' &&
        request.action === 'Update' &&
        request.targetVmId === vm.id,
    );
  }

  openAddModal(): void {
    this.editingVmId = undefined;
    this.vmForm.reset({
      hostname: null,
      ipAddress: null,
      assetStatus: 'Active',
      osVersion: null,
      sshPort: 22,
      comments: null,
    });
    this.isModalOpen = true;
  }

  editVm(vm: VirtualMachine): void {
    if (this.hasPendingUpdate(vm)) {
      return;
    }

    this.editingVmId = vm.id;
    this.vmForm.setValue({
      hostname: vm.hostname,
      ipAddress: vm.ipAddress,
      assetStatus: vm.assetStatus,
      osVersion: vm.osVersion,
      sshPort: vm.sshPort,
      comments: null,
    });
    this.isModalOpen = true;
  }

  submitForm(): void {
    if (this.vmForm.invalid) {
      this.vmForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.vmForm.value;

    this.inventoryService
      .submitChangeRequest({
        action: this.editingVmId ? 'Update' : 'Add',
        targetVmId: this.editingVmId,
        hostname: formValue.hostname,
        ipAddress: formValue.ipAddress,
        assetStatus: formValue.assetStatus,
        osVersion: formValue.osVersion,
        sshPort: formValue.sshPort,
        comments: formValue.comments || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.message.success('Change request submitted for approval');
          this.loadChangeRequests();
          this.resetForm();
          this.activeMainTab = 'approvals';
          this.activeApprovalTab = 'Pending';
          this.filterChangeRequests();
        },
        error: (err) => {
          const detail: string = err?.error?.message ?? 'Submission failed';
          this.message.error(detail);
          this.isSubmitting = false;
        },
      });
  }

  approveChangeRequest(request: InventoryChangeRequest): void {
    this.inventoryService.approveChangeRequest(request.id).subscribe({
      next: () => {
        this.message.success('Change request approved');
        this.loadVirtualMachines();
        this.loadChangeRequests();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Approval failed');
      },
    });
  }

  rejectChangeRequest(request: InventoryChangeRequest): void {
    this.inventoryService.rejectChangeRequest(request.id).subscribe({
      next: () => {
        this.message.success('Change request rejected');
        this.loadChangeRequests();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Rejection failed');
      },
    });
  }

  viewChangeRequest(request: InventoryChangeRequest): void {
    this.selectedChangeRequest = request;
    this.isDrawerOpen = true;
  }

  deleteVm(vm: VirtualMachine): void {
    this.inventoryService.remove(vm.id).subscribe({
      next: () => {
        this.message.success(`${vm.hostname} deleted`);
        this.loadVirtualMachines();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Delete failed');
      },
    });
  }

  resetForm(): void {
    this.editingVmId = undefined;
    this.isModalOpen = false;
    this.isSubmitting = false;
    this.vmForm.reset({
      hostname: null,
      ipAddress: null,
      assetStatus: 'Active',
      osVersion: null,
      sshPort: 22,
      comments: null,
    });
  }

  getAssetStatusColor(status: AssetStatus): string {
    switch (status) {
      case 'Active':
        return 'green';
      case 'Maintenance':
        return 'orange';
      case 'Retired':
        return 'red';
      default:
        return 'default';
    }
  }

  getApprovalStatusColor(status: InventoryChangeStatus): string {
    return status === 'Approved'
      ? 'green'
      : status === 'Rejected'
        ? 'red'
        : 'orange';
  }

  getActionColor(action: InventoryChangeRequest['action']): string {
    return action === 'Add' ? 'blue' : 'purple';
  }

  // ── Detail drawer ────────────────────────────────────────────
  viewVmDetails(vm: VirtualMachine): void {
    this.detailVm = vm;
    this.isDetailDrawerOpen = true;
  }

  // ── Admin direct create / update ─────────────────────────────
  openAdminCreateModal(): void {
    this.adminEditingVmId = undefined;
    this.adminVmForm.reset({ hostname: null, ipAddress: null, assetStatus: 'Active', osVersion: null, sshPort: 22 });
    this.isAdminModalOpen = true;
  }

  openAdminEditModal(vm: VirtualMachine): void {
    this.adminEditingVmId = vm.id;
    this.adminVmForm.setValue({
      hostname: vm.hostname,
      ipAddress: vm.ipAddress,
      assetStatus: vm.assetStatus,
      osVersion: vm.osVersion,
      sshPort: vm.sshPort,
    });
    this.isAdminModalOpen = true;
  }

  submitAdminForm(): void {
    if (this.adminVmForm.invalid) {
      this.adminVmForm.markAllAsTouched();
      return;
    }
    this.isAdminSubmitting = true;
    const v = this.adminVmForm.value;
    const action$ = this.adminEditingVmId
      ? this.inventoryService.adminUpdate(this.adminEditingVmId, v)
      : this.inventoryService.adminCreate(v);

    action$.subscribe({
      next: (vm) => {
        const label = this.adminEditingVmId ? 'updated' : 'registered';
        this.message.success(`${vm.hostname} ${label}`);
        this.isAdminSubmitting = false;
        this.isAdminModalOpen = false;
        this.loadVirtualMachines();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Operation failed');
        this.isAdminSubmitting = false;
      },
    });
  }

  resetAdminForm(): void {
    this.adminEditingVmId = undefined;
    this.isAdminModalOpen = false;
    this.isAdminSubmitting = false;
    this.adminVmForm.reset({ hostname: null, ipAddress: null, assetStatus: 'Active', osVersion: null, sshPort: 22 });
  }

  // ── Sync ──────────────────────────────────────────────────────
  openSyncModal(): void {
    this.syncJson = JSON.stringify(this.SAMPLE_SYNC_PAYLOAD, null, 2);
    this.syncResult = undefined;
    this.isSyncModalOpen = true;
  }

  runSync(): void {
    let servers: SyncVmRecord[];
    try {
      servers = JSON.parse(this.syncJson);
      if (!Array.isArray(servers)) throw new Error('Expected a JSON array');
    } catch {
      this.message.error('Invalid JSON — expected an array of server records');
      return;
    }
    this.isSyncing = true;
    this.inventoryService.syncVms(servers).subscribe({
      next: (result) => {
        this.syncResult = result;
        this.isSyncing = false;
        this.message.success(`Sync complete — ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`);
        this.loadVirtualMachines();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Sync failed');
        this.isSyncing = false;
      },
    });
  }

  // ── Tags ──────────────────────────────────────────────────────
  get allTags(): string[] {
    return [...new Set(this.virtualMachines.flatMap((vm) => vm.tags))].sort();
  }

  get filteredVirtualMachines(): VirtualMachine[] {
    if (this.selectedTagFilter.length === 0) {
      return this.virtualMachines;
    }
    return this.virtualMachines.filter((vm) =>
      this.selectedTagFilter.every((tag) => vm.tags.includes(tag)),
    );
  }

  openTagEditor(vm: VirtualMachine): void {
    this.editingTagsVmId = vm.id;
    this.editingTags = [...vm.tags];
  }

  saveTags(vm: VirtualMachine): void {
    if (!this.editingTagsVmId) return;
    this.isSavingTags = true;
    this.inventoryService.setTags(this.editingTagsVmId, this.editingTags).subscribe({
      next: (updated) => {
        const idx = this.virtualMachines.findIndex((v) => v.id === updated.id);
        if (idx >= 0) this.virtualMachines[idx] = updated;
        this.editingTagsVmId = undefined;
        this.editingTags = [];
        this.isSavingTags = false;
        this.message.success('Tags updated');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Failed to update tags');
        this.isSavingTags = false;
      },
    });
  }

  cancelTagEditor(): void {
    this.editingTagsVmId = undefined;
    this.editingTags = [];
  }

  getTagColor(tag: string): string {
    const colors = ['blue', 'purple', 'cyan', 'geekblue', 'magenta', 'volcano', 'gold', 'lime', 'green', 'orange'];
    const index = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }
}
