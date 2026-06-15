import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ChangeRequestService, ChangeRequest, ChangeRequestModel } from '../../services/change-request.service';
import { AuthService, ALL_ROLES } from '../../services/auth.service';
import { InventoryService, VirtualMachine } from '../../services/inventory.service';
import {
  ImplementerGroup,
  ImplementerGroupService,
} from '../../services/implementer-group.service';

@Component({
  selector: 'app-change-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzDividerModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpaceModule,
    NzTableModule,
    NzTagModule,
    NzTabsModule,
    NzTypographyModule,
    NzPopconfirmModule,
    NzModalModule,
    NzDrawerModule,
    NzSpinModule,
    NzTooltipModule,
],
  templateUrl: './change-management.html',
  styleUrls: ['./change-management.css'],
})
export class ChangeManagement implements OnInit {
  activeTab: 'All' | 'Pending' | 'Approved' | 'Rejected' | string = 'All';
  isModalOpen = false;
  isDrawerOpen = false;

  changeForm!: FormGroup;
  selectedRequest?: ChangeRequest | any;
  editingRequestId?: string;
  changeRequests: ChangeRequest[] = [];
  filteredRequests: ChangeRequest[] = [];
  isLoading = false;
  isSubmitting = false;
  changeRequestModel = ChangeRequestModel;
  vms: VirtualMachine[] = [];
  implementerGroups: ImplementerGroup[] = [];
  roleOptions = ALL_ROLES;

  constructor(
    private fb: FormBuilder,
    private cd: ChangeDetectorRef, // 2. Inject this
    private changeRequestService: ChangeRequestService,
    private inventoryService: InventoryService,
    private implementerGroupService: ImplementerGroupService,
    private auth: AuthService,
  ) {
    this.changeForm = this.fb.group({
      title: [null as string | null, [Validators.required]],
      description: [null as string | null, [Validators.required]],
      approvalRoute: ['Normal', [Validators.required]],
      comments: [null as string | null],
      activities: [[] as string[]],
      vmIds: [[] as string[]],
      implementerGroupIds: [[] as string[]],
      allowedRoles: [[] as string[]],
    });
  }

  ngOnInit(): void {
    this.loadChangeRequests();
    this.loadVms();
    this.loadImplementerGroups();
  }

  openCreateModal(): void {
    this.editingRequestId = undefined;
    this.changeForm.reset({
      approvalRoute: 'Normal',
      activities: [],
      vmIds: [],
      implementerGroupIds: [],
      allowedRoles: [],
    });
    this.isModalOpen = true;
  }

  private loadImplementerGroups(): void {
    this.implementerGroupService.findAll().subscribe({
      next: (groups) => {
        this.implementerGroups = groups;
        this.cd.detectChanges();
      },
      error: (err) => console.error('Error loading implementer groups:', err),
    });
  }

  implementerGroupLabel(group: ImplementerGroup): string {
    const users = group.osUsers.length ? group.osUsers.join(', ') : 'no OS users';
    return `${group.name} (${users})`;
  }

  implementerGroupNames(groupIds: string[] | undefined): string[] {
    if (!groupIds?.length) {
      return [];
    }
    return groupIds.map(
      (id) => this.implementerGroups.find((group) => group.id === id)?.name ?? id,
    );
  }

  private loadVms(): void {
    this.inventoryService.findAll().subscribe({
      next: (vms) => {
        this.vms = vms;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error loading inventory VMs:', err);
      },
    });
  }

  vmLabel(vm: VirtualMachine): string {
    return `${vm.hostname} (${vm.ipAddress})`;
  }

  crNumber(request: ChangeRequest): string {
    return `CR-${request.id.slice(0, 8).toUpperCase()}`;
  }

  vmHostnames(vmIds: string[] | undefined): string[] {
    if (!vmIds?.length) {
      return [];
    }
    return vmIds.map(
      (id) => this.vms.find((vm) => vm.id === id)?.hostname ?? id,
    );
  }

  private loadChangeRequests(): void {
    this.changeRequestService.findAll().subscribe({
      next: (data) => {
        this.changeRequests = data;
        this.filterRequests();
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error loading change requests:', err);
        this.cd.detectChanges();
      },
    });
  }


  filterRequests(): void {
    this.isLoading = true;
    this.filteredRequests = this.changeRequests.filter((request) => {
      if (this.activeTab === 'All') {
        return true;
      }
      return request.status === this.activeTab;
    });
    this.isLoading = false;
  }

  selectTab(tab: 'All' | 'Pending' | 'Approved' | 'Rejected' | string): void {
    this.activeTab = tab;
    this.selectedRequest = undefined;
    this.filterRequests();
  }

  submitForm(): void {
    if (this.changeForm.invalid) {
      this.changeForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.changeForm.value;

    if (this.editingRequestId != null) {
      this.changeRequestService.update(this.editingRequestId, formValue).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.loadChangeRequests();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error updating change request:', err);
          this.isSubmitting = false;
        },
      });
    } else {
      this.changeRequestService.create(formValue).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.loadChangeRequests();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error creating change request:', err);
          this.isSubmitting = false;
        },
      });
    }
  }

  createChange(data: Partial<ChangeRequest>): void {
    // This method is no longer needed but kept for reference
  }

  updateChange(data: Partial<ChangeRequest>): void {
    // This method is no longer needed but kept for reference
  }

  resetForm(): void {
    this.editingRequestId = undefined;
    this.selectedRequest = undefined;
    this.isModalOpen = false;
    this.isSubmitting = false;
    this.changeForm.reset({
      approvalRoute: 'Normal',
      activities: [],
      vmIds: [],
      implementerGroupIds: [],
      allowedRoles: [],
    });
  }

  editRequest(request: ChangeRequest): void {
    if (request.status !== 'Pending') {
      return;
    }

    this.editingRequestId = request.id;
    this.changeForm.setValue({
      title: request.title,
      description: request.description,
      approvalRoute: request.approvalRoute,
      comments: request.comments || '',
      activities: request.activities || [],
      vmIds: request.vmIds || [],
      implementerGroupIds: request.implementerGroupIds || [],
      allowedRoles: request.allowedRoles || [],
    });
    this.selectedRequest = request;
    this.isModalOpen = true;
  }

  approveRequest(request: ChangeRequest): void {
    this.changeRequestService.approve(request.id).subscribe({
      next: () => {
        this.loadChangeRequests();
      },
      error: (err) => {
        console.error('Error approving request:', err);
      },
    });
  }

  rejectRequest(request: ChangeRequest): void {
    this.changeRequestService.reject(request.id).subscribe({
      next: () => {
        this.loadChangeRequests();
      },
      error: (err) => {
        console.error('Error rejecting request:', err);
      },
    });
  }

  viewRequest(request: ChangeRequest): void {
    this.selectedRequest = request;
    this.isDrawerOpen = true;
  }

  getStatusColor(status: ChangeRequest['status']): string {
    return status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'orange';
  }

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }
}
