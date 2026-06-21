import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
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
import { NzMessageService } from 'ng-zorro-antd/message';
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
    NzAlertModule,
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
    NzDatePickerModule,
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
  /** CR number of the ticket being cloned, set when clone modal is open. */
  cloningFromCrNumber?: string;
  changeRequests: ChangeRequest[] = [];
  filteredRequests: ChangeRequest[] = [];
  isLoading = false;
  isSubmitting = false;
  changeRequestModel = ChangeRequestModel;
  vms: VirtualMachine[] = [];
  implementerGroups: ImplementerGroup[] = [];
  roleOptions = ALL_ROLES;

  /** Prevents past dates from being selectable in the date picker. */
  readonly disabledDate = (current: Date): boolean =>
    current < new Date(new Date().setHours(0, 0, 0, 0));

  /** Reactive form validator: start datetime must be now or in the future. */
  readonly futureDateValidator = (control: import('@angular/forms').AbstractControl) => {
    const value: Date | null = control.value;
    if (!value) return null;
    const now = new Date();
    now.setSeconds(0, 0);
    return value < now ? { pastDate: true } : null;
  };

  /** Ensures implementation end is after start. */
  readonly implementationWindowValidator = (
    group: import('@angular/forms').AbstractControl,
  ) => {
    const start = group.get('implementationStartAt')?.value as Date | null;
    const end = group.get('implementationEndAt')?.value as Date | null;
    if (!start || !end) {
      return null;
    }
    return end <= start ? { invalidRange: true } : null;
  };

  private toIso(value: Date | string | null | undefined): string | undefined {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value ?? undefined;
  }

  constructor(
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private changeRequestService: ChangeRequestService,
    private inventoryService: InventoryService,
    private implementerGroupService: ImplementerGroupService,
    private auth: AuthService,
    private message: NzMessageService,
  ) {
    this.changeForm = this.fb.group(
      {
        title: [null as string | null, [Validators.required]],
        description: [null as string | null, [Validators.required]],
        approvalRoute: ['Normal', [Validators.required]],
        implementationStartAt: [null as Date | null, [Validators.required, this.futureDateValidator]],
        implementationEndAt: [null as Date | null, [Validators.required]],
        comments: [null as string | null],
        activities: [[] as string[]],
        vmIds: [[] as string[]],
        implementerGroupIds: [[] as string[]],
        allowedRoles: [[] as string[]],
      },
      { validators: this.implementationWindowValidator },
    );
  }

  ngOnInit(): void {
    this.loadChangeRequests();
    this.loadVms();
    this.loadImplementerGroups();
  }

  get currentUserName(): string {
    const user = this.auth.user();
    return user?.name || user?.username || '';
  }

  get modalTitle(): string {
    if (this.cloningFromCrNumber) return `Clone from ${this.cloningFromCrNumber}`;
    if (this.editingRequestId) return 'Edit change request';
    return 'New change request';
  }

  openCreateModal(): void {
    this.editingRequestId = undefined;
    this.cloningFromCrNumber = undefined;
    this.changeForm.reset({
      approvalRoute: 'Normal',
      implementationStartAt: null,
      implementationEndAt: null,
      activities: [],
      vmIds: [],
      implementerGroupIds: [],
      allowedRoles: [],
    });
    this.isModalOpen = true;
  }

  /** Open the create modal pre-populated with the contents of an existing ticket. */
  cloneRequest(source: ChangeRequest): void {
    this.editingRequestId = undefined;
    this.cloningFromCrNumber = this.crNumber(source);
    this.changeForm.reset({
      title: source.title,
      description: source.description,
      approvalRoute: source.approvalRoute,
      implementationStartAt: null,
      implementationEndAt: null,
      comments: source.comments || null,
      activities: [...(source.activities ?? [])],
      vmIds: [...(source.vmIds ?? [])],
      implementerGroupIds: [...(source.implementerGroupIds ?? [])],
      allowedRoles: [...(source.allowedRoles ?? [])],
    });
    this.isModalOpen = true;
  }

  private loadImplementerGroups(): void {
    this.implementerGroupService.findAll().subscribe({
      next: (groups) => {
        this.implementerGroups = groups;
        this.cd.detectChanges();
      },
      error: () => this.message.error('Failed to load implementer groups'),
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
      error: () => this.message.error('Failed to load inventory VMs'),
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
    this.filteredRequests = this.changeRequests.filter(
      (request) => this.activeTab === 'All' || request.status === this.activeTab,
    );
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
    const raw = this.changeForm.value;
    const formValue = {
      ...raw,
      implementationStartAt: this.toIso(raw.implementationStartAt),
      implementationEndAt: this.toIso(raw.implementationEndAt),
    };

    if (this.editingRequestId != null) {
      this.changeRequestService.update(this.editingRequestId, formValue).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.message.success('Change request updated');
          this.loadChangeRequests();
          this.resetForm();
        },
        error: (err) => {
          this.message.error(err?.error?.message ?? 'Update failed');
          this.isSubmitting = false;
        },
      });
    } else {
      this.changeRequestService.create(formValue).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.message.success('Change request created');
          this.loadChangeRequests();
          this.resetForm();
        },
        error: (err) => {
          this.message.error(err?.error?.message ?? 'Create failed');
          this.isSubmitting = false;
        },
      });
    }
  }

  resetForm(): void {
    this.editingRequestId = undefined;
    this.cloningFromCrNumber = undefined;
    this.selectedRequest = undefined;
    this.isModalOpen = false;
    this.isSubmitting = false;
    this.changeForm.reset({
      approvalRoute: 'Normal',
      implementationStartAt: null,
      implementationEndAt: null,
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
    this.cloningFromCrNumber = undefined;
    this.changeForm.setValue({
      title: request.title,
      description: request.description,
      approvalRoute: request.approvalRoute,
      implementationStartAt: request.implementationStartAt
        ? new Date(request.implementationStartAt)
        : null,
      implementationEndAt: request.implementationEndAt
        ? new Date(request.implementationEndAt)
        : null,
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
        this.message.success('Change request approved');
        this.loadChangeRequests();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Approval failed');
      },
    });
  }

  rejectRequest(request: ChangeRequest): void {
    this.changeRequestService.reject(request.id).subscribe({
      next: () => {
        this.message.success('Change request rejected');
        this.loadChangeRequests();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Rejection failed');
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

