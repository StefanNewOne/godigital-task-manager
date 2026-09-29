import type { CrmCalType, CrmLeadView, CrmStatus } from '@gd/core';
import type { ContentPlanEntry, Lead, LeadContract, LeadOffer } from '@gd/db';

/** Лид со децата потребни за да се пресмета CrmLeadView (guards/derive). */
export type LeadWithChildren = Lead & {
  offers: LeadOffer[];
  contracts: LeadContract[];
  planEntries: ContentPlanEntry[];
};

/** DB `CalendarType` → core `CrmCalType` (кириличен клуч што го чита `crmMissing`). */
export function toCalType(cal: Lead['pkgCalType']): CrmCalType {
  return cal === 'specificen' ? 'специфичен' : 'стандарден';
}

/** Пресметај го бројот на видео/графика денови по месец од планерот (И3, деривирано). */
export function planCountsByMonth(
  entries: ContentPlanEntry[],
): Record<string, { v: number; g: number }> {
  const out: Record<string, { v: number; g: number }> = {};
  for (const e of entries) {
    const m = (out[e.monthKey] ??= { v: 0, g: 0 });
    if (e.contentType === 'video') m.v += 1;
    else m.g += 1;
  }
  return out;
}

/**
 * Пресликај Prisma лид во чист `CrmLeadView` за `crmMissing`/guards (@gd/core).
 * Ова е единствената точка каде DB обликот се преведува во доменскиот поглед.
 */
export function toLeadView(lead: LeadWithChildren): CrmLeadView {
  const offers = [...lead.offers]
    .sort((a, b) => a.version - b.version)
    .map((o) => ({ returned: !!o.ret, clientReturned: !!o.clientRet }));
  const contracts = [...lead.contracts]
    .sort((a, b) => a.version - b.version)
    .map((c) => ({ returned: !!c.ret, clientReturned: !!c.clientRet }));

  return {
    status: lead.status as CrmStatus,
    hasAnalysis: !!lead.analysisFileId,
    offers,
    contracts,
    meeting: lead.meetingDate
      ? {
          date: lead.meetingDate.toISOString(),
          time: lead.meetingTime ?? '',
          held: lead.meetingHeld,
          hasAudio: !!lead.meetingAudioFileId,
          hasNotes: !!(lead.meetingNotes && lead.meetingNotes.trim()),
        }
      : null,
    pkg: {
      videos: lead.pkgVideos,
      graphics: lead.pkgGraphics,
      meta: lead.pkgMeta,
      start: lead.pkgStart ?? '',
      months: lead.pkgMonths,
      calType: toCalType(lead.pkgCalType),
    },
    hasSigned: !!lead.signedFileId,
    hasStrategy: !!lead.strategyFileId,
    hasFable: !!lead.fableFileId,
    planCountsByMonth: planCountsByMonth(lead.planEntries),
  };
}
