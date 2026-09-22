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
