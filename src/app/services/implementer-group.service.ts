import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiPath } from '../core/api.constants';
import type { VirtualMachine } from './inventory.service';

export interface ImplementerGroup {
  id: string;
  name: string;
  description?: string;
  osUsers: string[];
  vmIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ImplementerGroupMember {
  id: string;
  username: string;
  implementerGroupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipApprovalHistoryItem {
  when: string;
  actor: string;
  action: string;
  note: string;
}

export interface ImplementerGroupMembershipRequest {
  id: string;
  username: string;
  implementerGroupId: string;
  requester: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  comments?: string;
  approver?: string;
  history: MembershipApprovalHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateImplementerGroupDto {
  name: string;
  description?: string;
  osUsers?: string[];
  vmIds?: string[];
}

export interface UpdateImplementerGroupDto {
  name?: string;
  description?: string;
  osUsers?: string[];
  vmIds?: string[];
}

export interface AccessibleAssets {
  implementerGroups: ImplementerGroup[];
  osUsers: string[];
  vms: VirtualMachine[];
}

export interface CreateMembershipRequestDto {
  username: string;
  implementerGroupId: string;
  comments?: string;
}

@Injectable({ providedIn: 'root' })
export class ImplementerGroupService {
  private apiUrl = apiPath('implementer-groups');

  constructor(private http: HttpClient) {}

  findAll(): Observable<ImplementerGroup[]> {
    return this.http.get<ImplementerGroup[]>(this.apiUrl);
  }

  findAccessibleVms(): Observable<AccessibleAssets> {
    return this.http.get<AccessibleAssets>(`${this.apiUrl}/accessible-vms`);
  }

  create(dto: CreateImplementerGroupDto): Observable<ImplementerGroup> {
    return this.http.post<ImplementerGroup>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateImplementerGroupDto): Observable<ImplementerGroup> {
    return this.http.patch<ImplementerGroup>(`${this.apiUrl}/${id}`, dto);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`);
  }

  findMembershipRequests(
    status?: 'Pending' | 'Approved' | 'Rejected',
  ): Observable<ImplementerGroupMembershipRequest[]> {
    const query = status ? `?status=${status}` : '';
    return this.http.get<ImplementerGroupMembershipRequest[]>(
      `${this.apiUrl}/membership-requests${query}`,
    );
  }

  createMembershipRequest(
    dto: CreateMembershipRequestDto,
  ): Observable<ImplementerGroupMembershipRequest> {
    return this.http.post<ImplementerGroupMembershipRequest>(
      `${this.apiUrl}/membership-requests`,
      dto,
    );
  }

  approveMembershipRequest(
    id: string,
  ): Observable<ImplementerGroupMembershipRequest> {
    return this.http.patch<ImplementerGroupMembershipRequest>(
      `${this.apiUrl}/membership-requests/${id}/approve`,
      {},
    );
  }

  rejectMembershipRequest(
    id: string,
  ): Observable<ImplementerGroupMembershipRequest> {
    return this.http.patch<ImplementerGroupMembershipRequest>(
      `${this.apiUrl}/membership-requests/${id}/reject`,
      {},
    );
  }

  findMembers(groupId: string): Observable<ImplementerGroupMember[]> {
    return this.http.get<ImplementerGroupMember[]>(
      `${this.apiUrl}/${groupId}/members`,
    );
  }

  removeMember(
    groupId: string,
    username: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${groupId}/members/${encodeURIComponent(username)}`,
    );
  }
}
