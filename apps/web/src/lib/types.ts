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
}
