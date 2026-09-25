import type { Role } from '@gd/core';

export interface Me {
  id: string;
  name: string;
  email: string;
  role: Role;
  isScenaristToo: boolean;
  color: string;
  active: boolean;
  lastActiveAt: string | null;
  /** Само од `GET /me` (не од листата на вработени). */
  notificationPrefs?: { reminders?: boolean } | null;
}

export interface EmployeeRow extends Me {
  phone: string | null;
  capacityNote: string | null;
  createdById: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  color: string;
  status: string;
  videosPerMonth: number;
  graphicsPerMonth: number;
  usesMetaAds: boolean;
  metaAdAccountId?: string | null;
  metaPageId?: string | null;
  metaIgId?: string | null;
  approvalChannel: string;
  calendarType: string;
  coverageAlarmDays: number;
}

export interface TaskListItem {
  id: string;
  clientId: string;
  groupId: string;
  contentType: 'video' | 'graphic';
  title: string;
  status: string;
  assigneeId: string | null;
  priority: string;
  version: number;
  statusChangedAt: string;
  slot: { date: string; orderInDay: number; status: string } | null;
  _count: { comments: number; publications: number };
}

export interface PublicationRow {
  id: string;
  platform: string;
  postType: string;
  permalink: string | null;
  publishedAt: string | null;
}

export interface TaskDetailData extends TaskListItem {
  brief: string | null;
  copy: string | null;
  rezId: string | null;
  kreaId: string | null;
  client: { name: string; usesMetaAds: boolean };
  publications: PublicationRow[];
}

export interface TaskGroupRow {
  id: string;
  clientId: string;
  contentType: 'video' | 'graphic';
  monthKey: string;
  status: string;
  scenaristId: string | null;
  rezId: string | null;
  kamId: string | null;
  shootDate: string | null;
  shootLocation: string | null;
  scenaristNotes: string | null;
  plannedCount: number;
  scenarioDocVersion: number;
  scenariosTotal: number;
  scenariosApproved: number;
  rawDeleteAt: string | null;
  localArchivePath: string | null;
}

export interface TaskGroupDetail extends TaskGroupRow {
  client: { name: string };
  totalChildren: number;
  activeChildren: number;
  sharedFiles: number;
}

export interface ScenarioRow {
  id: string;
  groupId: string;
  ordinal: number;
  title: string;
  hook: string | null;
  body: string | null;
  notes: string | null;
  status: 'predlozeno' | 'odobreno' | 'odobrenoSoIzmeni' | 'otfrleno';
  clientComment: string | null;
}

export interface ContactRow {
  id: string;
  clientId: string;
  name: string;
  roleAtClient: string | null;
  phone: string | null;
  email: string | null;
  isApprover: boolean;
  archivedAt: string | null;
}

export interface ActivityItem {
  kind: 'event' | 'comment';
  at: string;
  actorId: string | null;
  text: string;
}

export interface NotificationRow {
  id: string;
  level: 'potsetnik' | 'alarm' | 'kritichen';
  eventKey: string;
  title: string;
  body: string;
  taskId: string | null;
  groupId: string | null;
  clientId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface RuleRow {
  id: string;
  name: string;
  scope: string;
  enabled: boolean;
  isSystem: boolean;
}

export type SlotStatus = 'predlog' | 'free' | 'reserved' | 'used' | 'missed';

export interface SlotRow {
  id: string;
  clientId: string;
  contentType: 'video' | 'graphic';
  date: string; // ISO
  orderInDay: number;
  status: SlotStatus;
  monthKey: string;
  task?: { id: string; status: string; title: string; contentType: 'video' | 'graphic' } | null;
}

export interface FileAssetRow {
  id: string;
  kind: string;
  mime: string;
  size: string;
  version: number | null;
  createdAt: string;
  url: string;
}
