import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
  ASSET_STATUS_OPTIONS,
  AssetStatus,
  InventoryChangeRequest,
  InventoryChangeStatus,
  InventoryService,
  VirtualMachine,
} from '../../services/inventory.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
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

  constructor(
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private inventoryService: InventoryService,
    private implementerGroupService: ImplementerGroupService,
    private auth: AuthService,
  ) {
    this.vmForm = this.fb.group({
      hostname: [null as string | null, [Validators.required]],
      ipAddress: [null as string | null, [Validators.required]],
      assetStatus: ['Active' as AssetStatus, [Validators.required]],
      osVersion: [null as string | null, [Validators.required]],
      sshPort: [22, [Validators.required, Validators.min(1), Validators.max(65535)]],
      comments: [null as string | null],
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
      error: (err) => {
        console.error('Error loading virtual machines:', err);
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
      error: (err) => {
        console.error('Error loading inventory change requests:', err);
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
          this.loadChangeRequests();
          this.resetForm();
          this.activeMainTab = 'approvals';
          this.activeApprovalTab = 'Pending';
          this.filterChangeRequests();
        },
        error: (err) => {
          console.error('Error submitting inventory change request:', err);
          this.isSubmitting = false;
        },
      });
  }

  approveChangeRequest(request: InventoryChangeRequest): void {
    this.inventoryService.approveChangeRequest(request.id).subscribe({
      next: () => {
        this.loadVirtualMachines();
        this.loadChangeRequests();
      },
      error: (err) => {
        console.error('Error approving inventory change request:', err);
      },
    });
  }

  rejectChangeRequest(request: InventoryChangeRequest): void {
    this.inventoryService.rejectChangeRequest(request.id).subscribe({
      next: () => {
        this.loadChangeRequests();
      },
      error: (err) => {
        console.error('Error rejecting inventory change request:', err);
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
        this.loadVirtualMachines();
      },
      error: (err) => {
        console.error('Error deleting virtual machine:', err);
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

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }
}
