import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';
import { VirtualMachine } from './inventory.service';
import { ImplementerGroup } from './implementer-group.service';

export interface ApprovalHistoryItem {
  when: string;
  actor: string;
  action: string;
  note: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  requester: string;
  approvalRoute: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  approver?: string;
  comments?: string;
  history: ApprovalHistoryItem[];
  activities: string[];
  vmIds: string[];
  allowedRoles: string[];
  implementerGroupIds: string[];
  implementationStartAt: string;
  implementationEndAt: string;
}

/** A change request as served to the Access tab, with its VMs and implementer groups resolved. */
export interface AccessibleChangeRequest extends ChangeRequest {
  vms: VirtualMachine[];
  implementerGroups: ImplementerGroup[];
  osUsers: string[];
}

export interface CreateChangeRequestDto {
  title: string;
  description: string;
  approvalRoute: string;
  comments?: string;
  activities?: string[];
  vmIds?: string[];
  allowedRoles?: string[];
  implementerGroupIds?: string[];
  implementationStartAt: string;
  implementationEndAt: string;
}

export interface UpdateChangeRequestDto {
  title?: string;
  description?: string;
  approvalRoute?: string;
  comments?: string;
  activities?: string[];
  vmIds?: string[];
  allowedRoles?: string[];
  implementerGroupIds?: string[];
  implementationStartAt?: string;
  implementationEndAt?: string;
}

export const ChangeRequestModel = [
  {id: 'id', display: 'ID', type: 'default'},
  {id: 'title', display: 'Title', type: 'default'},
  {id: 'description', display: 'Description', type: 'default'},
  {id: 'requester', display: 'Requester', type: 'default'},
  {id: 'approvalRoute', display: 'Approval Route', type: 'default'},
  {id: 'status', display: 'Status', type: 'status'},
  {id: 'createdAt', display: 'Created At', type: 'date'},
  {id: 'implementationStartAt', display: 'Implementation Start', type: 'date'},
  {id: 'implementationEndAt', display: 'Implementation End', type: 'date'},
  {id: 'approver', display: 'Approver', type: 'default'},
  {id: 'comments', display: 'Comments', type: 'default'},
];

@Injectable({
  providedIn: 'root',
})
export class ChangeRequestService {
  private apiUrl = apiPath('change-requests');

  constructor(private http: HttpClient) {}

  findAll(): Observable<ChangeRequest[]> {
    return this.http.get<ChangeRequest[]>(this.apiUrl);
  }

  findAccessible(): Observable<AccessibleChangeRequest[]> {
    return this.http.get<AccessibleChangeRequest[]>(`${this.apiUrl}/accessible`);
  }

  findOne(id: string): Observable<ChangeRequest> {
    return this.http.get<ChangeRequest>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateChangeRequestDto): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateChangeRequestDto): Observable<ChangeRequest> {
    return this.http.patch<ChangeRequest>(`${this.apiUrl}/${id}`, dto);
  }

  approve(id: string): Observable<ChangeRequest> {
    return this.http.patch<ChangeRequest>(`${this.apiUrl}/${id}/approve`, {});
  }

  reject(id: string): Observable<ChangeRequest> {
    return this.http.patch<ChangeRequest>(`${this.apiUrl}/${id}/reject`, {});
  }
}
