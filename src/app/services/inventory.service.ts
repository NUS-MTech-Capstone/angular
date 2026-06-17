import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';

export type AssetStatus = 'Active' | 'Inactive' | 'Maintenance' | 'Retired';
export type InventoryChangeAction = 'Add' | 'Update';
export type InventoryChangeStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ApprovalHistoryItem {
  when: string;
  actor: string;
  action: string;
  note: string;
}

export interface VirtualMachine {
  id: string;
  hostname: string;
  ipAddress: string;
  assetStatus: AssetStatus;
  osVersion: string;
  sshPort: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryChangeRequest {
  id: string;
  action: InventoryChangeAction;
  status: InventoryChangeStatus;
  requester: string;
  targetVmId?: string;
  hostname: string;
  ipAddress: string;
  assetStatus: AssetStatus;
  osVersion: string;
  sshPort: number;
  comments?: string;
  approver?: string;
  history: ApprovalHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVmDto {
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  tags?: string[];
}

export interface UpdateVmDto {
  hostname?: string;
  ipAddress?: string;
  assetStatus?: AssetStatus;
  osVersion?: string;
  sshPort?: number;
}

export interface SyncVmRecord {
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  tags?: string[];
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
}

export interface CreateInventoryChangeRequestDto {
  action: InventoryChangeAction;
  targetVmId?: string;
  hostname: string;
  ipAddress: string;
  assetStatus?: AssetStatus;
  osVersion: string;
  sshPort?: number;
  comments?: string;
}

export const ASSET_STATUS_OPTIONS: AssetStatus[] = [
  'Active',
  'Inactive',
  'Maintenance',
  'Retired',
];

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private vmsApiUrl = apiPath('inventory/vms');
  private changeRequestsApiUrl = apiPath('inventory/change-requests');

  constructor(private http: HttpClient) {}

  findAll(): Observable<VirtualMachine[]> {
    return this.http.get<VirtualMachine[]>(this.vmsApiUrl);
  }

  findOne(id: string): Observable<VirtualMachine> {
    return this.http.get<VirtualMachine>(`${this.vmsApiUrl}/${id}`);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.vmsApiUrl}/${id}`);
  }

  findAllChangeRequests(): Observable<InventoryChangeRequest[]> {
    return this.http.get<InventoryChangeRequest[]>(this.changeRequestsApiUrl);
  }

  submitChangeRequest(
    dto: CreateInventoryChangeRequestDto,
  ): Observable<InventoryChangeRequest> {
    return this.http.post<InventoryChangeRequest>(
      this.changeRequestsApiUrl,
      dto,
    );
  }

  approveChangeRequest(id: string): Observable<InventoryChangeRequest> {
    return this.http.patch<InventoryChangeRequest>(
      `${this.changeRequestsApiUrl}/${id}/approve`,
      {},
    );
  }

  rejectChangeRequest(id: string): Observable<InventoryChangeRequest> {
    return this.http.patch<InventoryChangeRequest>(
      `${this.changeRequestsApiUrl}/${id}/reject`,
      {},
    );
  }

  setTags(id: string, tags: string[]): Observable<VirtualMachine> {
    return this.http.patch<VirtualMachine>(`${this.vmsApiUrl}/${id}/tags`, { tags });
  }

  /** Admin direct create — bypasses change-request workflow. */
  adminCreate(dto: CreateVmDto): Observable<VirtualMachine> {
    return this.http.post<VirtualMachine>(this.vmsApiUrl, dto);
  }

  /** Admin direct update — bypasses change-request workflow. */
  adminUpdate(id: string, dto: UpdateVmDto): Observable<VirtualMachine> {
    return this.http.patch<VirtualMachine>(`${this.vmsApiUrl}/${id}`, dto);
  }

  /** Sync (upsert by hostname) from an external server payload. */
  syncVms(servers: SyncVmRecord[]): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.vmsApiUrl}/sync`, { servers });
  }
}
