import { prisma } from '../db/tenantExtension.js';

export interface ClientReportRow {
  clientId: string;
  name: string;
  videoPosts: number;
  graphicPosts: number;
  reach: number;
  impressions: number;
  engagement: number;
  spend: number;
  cpr: number | null;
}

const num = (d: unknown): number => (d == null ? 0 : Number(d));

/**
 * Месечен извештај по клиент (H10, PRD §4.7): објави по тип + агрегирани метрики (најнов
 * `MetricSnapshot` по објава) + трошок од кампањите што се преклопуваат со месецот.
 */
export async function getClientReport(month: string): Promise<ClientReportRow[]> {
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y!, m! - 1, 1));
  const monthEnd = new Date(Date.UTC(y!, m!, 1));

  const clients = await prisma.client.findMany({
    where: { status: 'aktiven', archivedAt: null },
    orderBy: { name: 'asc' },
  });

  const rows: ClientReportRow[] = [];
  for (const c of clients) {
    const pubs = await prisma.publication.findMany({
      where: { task: { clientId: c.id, group: { monthKey: month } } },
      include: { task: { select: { contentType: true } } },
    });
    const pubIds = pubs.map((p) => p.id);
    const snaps = pubIds.length
      ? await prisma.metricSnapshot.findMany({
          where: { publicationId: { in: pubIds } },
          orderBy: { capturedAt: 'desc' },
          distinct: ['publicationId'],
        })
      : [];
    const byPub = new Map(snaps.map((s) => [s.publicationId, s]));

    let reach = 0;
    let impressions = 0;
    let engagement = 0;
    let videoPosts = 0;
    let graphicPosts = 0;
    for (const p of pubs) {
      if (p.task.contentType === 'video') videoPosts++;
      else graphicPosts++;
      const s = byPub.get(p.id);
      if (s) {
        reach += num(s.reach);
        impressions += num(s.impressions);
        engagement += num(s.engagement);
      }
    }

    const camps = await prisma.campaign.findMany({
      where: { clientId: c.id, periodFrom: { lt: monthEnd }, periodTo: { gte: monthStart } },
    });
    const campIds = camps.map((x) => x.id);
    const campSnaps = campIds.length
      ? await prisma.metricSnapshot.findMany({
          where: { campaignId: { in: campIds } },
          orderBy: { capturedAt: 'desc' },
          distinct: ['campaignId'],
        })
      : [];
    let spend = 0;
    let cprWeighted = 0;
    for (const s of campSnaps) {
      const sp = num(s.spend);
      spend += sp;
      if (s.cpr != null) cprWeighted += num(s.cpr) * sp;
    }

    rows.push({
      clientId: c.id,
      name: c.name,
      videoPosts,
      graphicPosts,
      reach,
      impressions,
      engagement,
      spend,
      cpr: spend > 0 ? Math.round((cprWeighted / spend) * 10000) / 10000 : null,
    });
  }
  return rows;
}

const CSV_HEADERS = [
  'Клиент',
  'Видео објави',
  'Графика објави',
  'Досег',
  'Импресии',
  'Ангажман',
  'Потрошено (€)',
  'Цена по резултат (€)',
];

/** Escape поле за CSV (наводници + удвоени внатрешни наводници). */
function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Сериализирај го извештајот како CSV (со BOM за Excel + кирилица). */
export function clientReportToCsv(rows: ClientReportRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.name),
        r.videoPosts,
        r.graphicPosts,
        Math.round(r.reach),
        Math.round(r.impressions),
        Math.round(r.engagement),
        Math.round(r.spend),
        r.cpr ?? '',
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
