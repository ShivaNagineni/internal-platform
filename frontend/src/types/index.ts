export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "OWNER";

export interface User {
  id: string;
  azure_oid: string | null;
  zoho_uid: string | null;
  email: string;
  display_name: string;
  department: string | null;
  role: UserRole;
  points: number;
  is_active: boolean;
  created_at: string;
}

export type LeaveType = "ANNUAL" | "SICK" | "UNPAID" | "PARENTAL" | "BEREAVEMENT" | "WFH";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveUser {
  id: string;
  display_name: string;
  email: string;
  department: string | null;
  role: UserRole;
}

export interface Leave {
  id: string;
  user_id: string;
  user: LeaveUser;
  leave_type: LeaveType;
  status: LeaveStatus;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  approver_id: string | null;
  approver: LeaveUser | null;
  approver_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhoIsOutEntry {
  user: LeaveUser;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
}

export interface LeaveCreate {
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface LeaveUpdate {
  status?: LeaveStatus;
  approver_comment?: string;
  leave_type?: LeaveType;
  start_date?: string;
  end_date?: string;
  reason?: string;
}

export type IdeaStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
export type IdeaCategory = "PRODUCT" | "PROCESS" | "TECH" | "CULTURE" | "OTHER";

export interface IdeaAuthor {
  id: string;
  azure_oid: string | null;
  display_name: string;
  email: string;
  department: string | null;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  author_id: string;
  author: IdeaAuthor;
  status: IdeaStatus;
  category: IdeaCategory;
  upvote_count: number;
  voted_by_me: boolean;
  created_at: string;
  updated_at: string;
}

export interface IdeaCreate {
  title: string;
  description: string;
  category: IdeaCategory;
}

export interface IdeaUpdate {
  title?: string;
  description?: string;
  category?: IdeaCategory;
  status?: IdeaStatus;
}

export type ReleaseStatus = "PLANNED" | "IN_PROGRESS" | "STAGING" | "RELEASED" | "CANCELLED";

export interface ReleaseStatusEntry {
  status: ReleaseStatus;
  changed_at: string;
}

export interface ReleaseOwner {
  id: string;
  display_name: string;
  email: string;
}

export interface Release {
  id: string;
  title: string;
  version: string;
  description: string | null;
  release_date: string | null;
  status: ReleaseStatus;
  status_history: ReleaseStatusEntry[];
  owner_id: string | null;
  owner: ReleaseOwner | null;
  changelog: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseCreate {
  title: string;
  version: string;
  description?: string;
  release_date: string;
}

export interface ReleaseUpdate {
  title?: string;
  description?: string;
  release_date?: string;
  status?: ReleaseStatus;
  changelog?: string;
}

export interface DashboardStats {
  pending_leaves: number;
  approved_leaves_today: number;
  total_ideas: number;
  ideas_under_review: number;
  upcoming_releases: number;
  active_releases: number;
}
