export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "OWNER";

export interface User {
  id: string;
  azure_oid: string | null;
  zoho_uid: string | null;
  email: string;
  display_name: string;
  department: string | null;
  role: UserRole;
  theme: "light" | "dark";
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

export interface Repository {
  id: string;
  name: string;
  github_repo: string;
  dev_branch: string;
  qa_branch: string;
  main_branch: string;
  created_at: string;
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
  repository_ids?: string[];
  repositories?: Repository[];
  changelog: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseCreate {
  title: string;
  version: string;
  description?: string;
  release_date: string;
  repository_ids?: string[];
}

export interface ReleaseUpdate {
  title?: string;
  description?: string;
  release_date?: string;
  status?: ReleaseStatus;
  changelog?: string;
  repository_ids?: string[];
}

export type LocationType = "ONSHORE" | "OFFSHORE";

export interface Department {
  id: string;
  name: string;
  description: string | null;
  location: LocationType;
  created_at: string;
}

export type WorkItemType = "User Story" | "Task" | "Bug";

export interface StoryAssignedTo {
  display_name: string;
  unique_name: string;
}

export interface StoryPlatformUser {
  id: string;
  display_name: string;
  email: string;
}

export interface Story {
  id: number;
  project: string;
  title: string;
  description: string | null;
  work_item_type: WorkItemType;
  state: string;
  assigned_to: StoryAssignedTo | null;
  assigned_to_platform_user: StoryPlatformUser | null;
  priority: number | null;
  created_date: string | null;
  changed_date: string | null;
  url: string | null;
}

export interface StoryCreate {
  title: string;
  description?: string;
  project: string;
  work_item_type: WorkItemType;
  assigned_to_email?: string;
  priority?: number;
  sprint_path?: string;
  parent_id?: number;
}

export interface StoryUpdate {
  title?: string;
  description?: string;
  assigned_to_email?: string;
  clear_assignee?: boolean;
  state?: string;
  priority?: number;
}

export interface SprintStats {
  total: number;
  by_state: Record<string, number>;
  by_type: Record<string, number>;
  done_count: number;
}

export interface Sprint {
  id: string;
  project: string;
  name: string;
  path: string;
  start_date: string | null;
  finish_date: string | null;
  time_frame: "past" | "current" | "future";
  stories: Story[];
  stats: SprintStats;
}

export interface ADOWikiPage {
  path: string;
  title: string;
  project: string;
  wiki_id: string;
  wiki_name: string;
  has_sub_pages: boolean;
}

export interface WikiDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string;
  author_name: string;
  author_email: string;
  created_at: string;
  updated_at: string;
}

export interface WikiDocumentCreate {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export interface WikiDocumentUpdate {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

export interface DashboardStats {
  pending_leaves: number;
  approved_leaves_today: number;
  total_ideas: number;
  ideas_under_review: number;
  upcoming_releases: number;
  active_releases: number;
}
