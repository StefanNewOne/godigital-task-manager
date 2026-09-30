import type React from 'react';
import { useRef, useState } from 'react';
import {
  CRM_FLOW,
  CRM_STATUS_META,
  crmReactivateTarget,
  type CrmStatus,
  type LossReason,
} from '@gd/core';
import { t } from '@gd/ui';
import { uploadFile } from '../../api/files.js';
import {
  useCrmAgents,
  useLead,
  useLeadTransition,
  useMeetingNoShow,
  useReassignAgent,
  useUpdateMeeting,
  useUpdatePackage,
  useUpdateTeam,
  useUploadDoc,
  type LeadRow,
} from '../../api/crm.js';
import { canActOnLead } from './CrmScreen.js';
import { ContentPlanner } from './ContentPlanner.js';
import { LostLeadModal } from './LostLeadModal.js';

export function LeadPanel({
  leadId,
  me,
  onClose,
}: {
  leadId: string;
  me: { id: string; role: string };
  onClose: () => void;
}) {
  const { data: lead } = useLead(leadId);
  const transition = useLeadTransition(leadId);
  const upload = useUploadDoc(leadId);
  const [note, setNote] = useState<{ target: CrmStatus; kind: 'dirRet' | 'clientRet' } | null>(
    null,
  );
  const [noteText, setNoteText] = useState('');
  const [lostOpen, setLostOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  if (!lead) return null;
  const meta = CRM_STATUS_META[lead.status];
  const can = canActOnLead(lead, me);
  const terminal = lead.status === 'aktiviran' || lead.status === 'izguben';
  const stage =
    lead.status === 'izguben' && lead.lostFromStatus
      ? CRM_STATUS_META[lead.lostFromStatus].step
      : meta.step;

  // CRM upload преку presigned R2 (И7): фајлот оди директно кон R2, серверот добива само fileId.
  const doUpload = (kind: string) => {
    pendingKind.current = kind;
    setUploadErr(null);
    fileInputRef.current?.click();
  };
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const kind = pendingKind.current;
    pendingKind.current = null;
    if (!file || !kind) return;
    setUploading(true);
    try {
      const fileId = await uploadFile({
        ownerType: 'lead',
        ownerId: leadId,
        kind: 'leadDoc',
        file,
      });
      upload.mutate({ kind, fileId });
    } catch {
      setUploadErr(t('leadPanel.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };
  const go = (
    to: CrmStatus,
    payload?: { comment?: string; lossReason?: LossReason; lossNote?: string },
  ) => transition.mutate({ to, payload });

  return (
    <div style={overlay} onClick={onClose}>
      <aside style={drawer} onClick={(e) => e.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={onFilePicked}
          accept="video/*,image/*,.pdf,.docx,.txt,audio/*"
        />
        {/* Заглавие */}
        <div style={header}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 2 }}>
              {lead.status === 'izguben'
                ? t('leadPanel.lostInStep', { stage })
                : lead.status === 'aktiviran'
                  ? t('leadPanel.activated')
                  : t('leadPanel.stepOf', { step: meta.step })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={closeBtn}
            aria-label={t('leadPanel.close')}
          >
            ✕
          </button>
        </div>

        {/* Чекор-индикатор */}
        <div style={{ display: 'flex', gap: 3, padding: '0 20px 16px' }}>
          {CRM_FLOW.map((k, i) => {
            const bg =
              lead.status === 'aktiviran' || i + 1 < stage
                ? '#0866FF'
                : i + 1 === stage
                  ? lead.status === 'izguben'
                    ? '#DC2626'
                    : meta.color
                  : '#E2E7EB';
            return (
              <span
                key={k}
                title={CRM_STATUS_META[k].label}
                style={{ ...stepBar, background: bg }}
              />
            );
          })}
        </div>

        <div style={{ padding: '0 20px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Инфо */}
          <Section title={t('leadPanel.info')}>
            <div style={infoGrid}>
              {[
                [t('leadPanel.contactPerson'), lead.person],
                [t('leadPanel.phone'), lead.phone ?? '—'],
                [t('leadPanel.email'), lead.email ?? '—'],
                [t('leadPanel.source'), lead.source],
                [t('leadPanel.pkgHint'), lead.pkgHint],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={infoK}>{k}</div>
                  <div style={infoV}>{v}</div>
                </div>
              ))}
            </div>
          </Section>

          <AgentZone lead={lead} me={me} terminal={terminal} />

          {/* Изгубен */}
          {lead.status === 'izguben' && (
            <Banner color="#DC2626" bg="#FEF2F2">
              <b>{t('leadPanel.lostBanner', { reason: lead.lossReason ?? '' })}</b>
              {lead.lossNote ? ` — ${lead.lossNote}` : ''}
            </Banner>
          )}

          {/* Активиран */}
          {lead.status === 'aktiviran' && (
            <Banner color="#15803D" bg="#F0FDF4">
              {t('leadPanel.activatedBanner', {
                videos: lead.pkgVideos,
                graphics: lead.pkgGraphics,
                calType:
                  lead.pkgCalType === 'specificen'
                    ? t('leadPanel.calSpecific')
                    : t('leadPanel.calStandard'),
                months: lead.pkgMonths,
              })}
            </Banner>
          )}

          {/* Враќање банер */}
          <ReturnBanner lead={lead} />

          {!can && !terminal && (
            <Banner color="#5C6672" bg="#F7F8FA">
              {t('leadPanel.readOnly', {
                owner: meta.owner === 'dir' ? t('leadPanel.ownerDir') : t('leadPanel.ownerAgent'),
              })}
            </Banner>
          )}

          {uploading && (
            <Banner color="#0052D9" bg="#EBF2FF">
              {t('leadPanel.uploading')}
            </Banner>
          )}
          {uploadErr && (
            <Banner color="#B91C1C" bg="#FEF2F2">
              {uploadErr}
            </Banner>
          )}

          {/* Работна зона */}
          {can && (
            <>
              <Checklist lead={lead} onUpload={doUpload} />
              {lead.status === 'sostanok' && <MeetingZone lead={lead} />}
              {(CRM_STATUS_META[lead.status].step >= 7 || lead.status === 'aktiviran') && (
                <PackageZone lead={lead} editable={can && lead.status === 'dogIzr'} />
              )}
              {lead.pkgCalType === 'specificen' &&
                ['strategija', 'aktivacija', 'aktiviran'].includes(lead.status) && (
                  <ContentPlanner lead={lead} editable={can && lead.status === 'strategija'} />
                )}
              {['aktivacija', 'aktiviran'].includes(lead.status) && (
                <TeamZone lead={lead} me={me} />
              )}

              {/* Враќање-коментар box */}
              {note ? (
                <Section
                  title={
                    note.kind === 'dirRet'
                      ? t('leadPanel.noteDirTitle')
                      : t('leadPanel.noteClientTitle')
                  }
                >
                  <textarea
                    style={ta}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={t('leadPanel.notePlaceholder')}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" style={btnGhost} onClick={() => setNote(null)}>
                      {t('crm.cancel')}
                    </button>
                    <button
                      type="button"
                      style={btnPrimary}
                      onClick={() => {
                        if (!noteText.trim()) return;
                        go(note.target, { comment: noteText.trim() });
                        setNote(null);
                        setNoteText('');
                      }}
                    >
                      {t('leadPanel.returnWithComment')}
                    </button>
                  </div>
                </Section>
              ) : (
                <Actions
                  lead={lead}
                  onGo={go}
                  onNote={(target, kind) => {
                    setNote({ target, kind });
                    setNoteText('');
                  }}
                  onLost={() => setLostOpen(true)}
                  onNoShow={leadId}
                />
              )}
            </>
          )}

          {/* Документи */}
          <DocsList lead={lead} />

          {/* Активност */}
          {lead.events && lead.events.length > 0 && (
            <Section title={t('leadPanel.activity')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...lead.events].reverse().map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--gd-ink-secondary)' }}>
                    {e.narrative}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {lostOpen && (
          <LostLeadModal
            name={lead.name}
            onCancel={() => setLostOpen(false)}
            onConfirm={(reason, lostNote) => {
              go('izguben', { lossReason: reason, lossNote: lostNote });
              setLostOpen(false);
            }}
          />
        )}
      </aside>
    </div>
  );
}

// ── Агент (сопственик) — Директор може да презадоли ──
function AgentZone({
  lead,
  me,
  terminal,
}: {
  lead: LeadRow;
  me: { id: string; role: string };
  terminal: boolean;
}) {
  const { data: agents = [] } = useCrmAgents();
  const reassign = useReassignAgent(lead.id);
  const canReassign = me.role === 'dir' && !terminal;
  const agentName = agents.find((a) => a.id === lead.agentId)?.name ?? '—';
  return (
    <Section title={t('leadPanel.salesAgent')}>
      {canReassign ? (
        <select
          style={input}
          value={lead.agentId}
          onChange={(e) => reassign.mutate(e.target.value)}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 500 }}>{agentName}</div>
      )}
    </Section>
  );
}

// ── Работна зона: акции ──
function Actions({
  lead,
  onGo,
  onNote,
  onLost,
  onNoShow,
}: {
  lead: LeadRow;
  onGo: (to: CrmStatus, payload?: { comment?: string }) => void;
  onNote: (target: CrmStatus, kind: 'dirRet' | 'clientRet') => void;
  onLost: () => void;
  onNoShow: string;
}) {
  const noShow = useMeetingNoShow(onNoShow);
  const p = (label: string, to: CrmStatus) => (
    <button key={label} type="button" style={btnPrimary} onClick={() => onGo(to)}>
      {label}
    </button>
  );
  const s = (label: string, fn: () => void) => (
    <button key={label} type="button" style={btnGhost} onClick={fn}>
      {label}
    </button>
  );
  const d = (label: string, fn: () => void) => (
    <button key={label} type="button" style={btnDanger} onClick={fn}>
      {label}
    </button>
  );

  const buttons: React.ReactNode[] = [];
  switch (lead.status) {
    case 'novLid':
      buttons.push(p(t('leadPanel.aStartAnalysis'), 'analiza'));
      break;
    case 'analiza':
      buttons.push(p(t('leadPanel.aToOffer'), 'ponudaIzr'));
      break;
    case 'ponudaIzr':
      buttons.push(p(t('leadPanel.aSendDirApproval'), 'ponudaOdob'));
      break;
    case 'ponudaOdob':
      buttons.push(
        p(t('leadPanel.aApproveOffer', { n: lead.offers?.length ?? '' }), 'ponudaKlient'),
      );
      buttons.push(s(t('leadPanel.returnWithComment'), () => onNote('ponudaIzr', 'dirRet')));
      break;
    case 'ponudaKlient':
      buttons.push(p(t('leadPanel.aClientAccepted'), 'sostanok'));
      buttons.push(s(t('leadPanel.aClientChanges'), () => onNote('ponudaIzr', 'clientRet')));
      buttons.push(d(t('leadPanel.aLostLead'), onLost));
      break;
    case 'sostanok':
      buttons.push(p(t('leadPanel.aToContract'), 'dogIzr'));
      if (lead.meetingDate && !lead.meetingHeld)
        buttons.push(s(t('leadPanel.aNoShow'), () => noShow.mutate()));
      break;
    case 'dogIzr':
      buttons.push(p(t('leadPanel.aSendDirApproval'), 'dogOdob'));
      break;
    case 'dogOdob':
      buttons.push(
        p(t('leadPanel.aApproveContract', { n: lead.contracts?.length ?? '' }), 'dogKlient'),
      );
      buttons.push(s(t('leadPanel.returnWithComment'), () => onNote('dogIzr', 'dirRet')));
      break;
    case 'dogKlient':
      buttons.push(p(t('leadPanel.aContractSigned'), 'strategija'));
      buttons.push(s(t('leadPanel.aClientChanges'), () => onNote('dogIzr', 'clientRet')));
      buttons.push(d(t('leadPanel.aLostLead'), onLost));
      break;
    case 'strategija':
      buttons.push(p(t('leadPanel.aReadyActivate'), 'aktivacija'));
      break;
    case 'aktivacija':
      buttons.push(p(t('leadPanel.aActivate'), 'aktiviran'));
      break;
    case 'izguben':
      buttons.push(
        p(t('leadPanel.aReactivate'), crmReactivateTarget(lead.lostFromStatus ?? 'ponudaKlient')),
      );
      break;
    default:
      break;
  }
  if (buttons.length === 0) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>{buttons}</div>;
}

function ReturnBanner({ lead }: { lead: LeadRow }) {
  let title = '';
  let text = '';
  const lastOffer = lead.offers?.at(-1);
  const lastContract = lead.contracts?.at(-1);
  if (lead.status === 'ponudaIzr' && lastOffer && (lastOffer.ret || lastOffer.clientRet)) {
    title = lastOffer.ret
      ? t('leadPanel.rbDirOffer', { version: lastOffer.version })
      : t('leadPanel.rbClientOffer', { version: lastOffer.version });
    text = lastOffer.ret ?? lastOffer.clientRet ?? '';
  }
  if (lead.status === 'dogIzr' && lastContract && (lastContract.ret || lastContract.clientRet)) {
    title = lastContract.ret
      ? t('leadPanel.rbDirContract', { version: lastContract.version })
      : t('leadPanel.rbClientContract', { version: lastContract.version });
    text = lastContract.ret ?? lastContract.clientRet ?? '';
  }
  if (!title) return null;
  return (
    <Banner color="#B45309" bg="#FFFBEB">
      <b>{title}</b>
      <div style={{ marginTop: 4 }}>{text}</div>
    </Banner>
  );
}

// ── Чеклиста по статус ──
function Checklist({ lead, onUpload }: { lead: LeadRow; onUpload: (kind: string) => void }) {
  const lastOfferOk =
    !!lead.offers?.length && !lead.offers.at(-1)!.ret && !lead.offers.at(-1)!.clientRet;
  const lastContractOk =
    !!lead.contracts?.length && !lead.contracts.at(-1)!.ret && !lead.contracts.at(-1)!.clientRet;
  const offerN = (lead.offers?.length ?? 0) + (lastOfferOk ? 0 : 1);
  const contractN = (lead.contracts?.length ?? 0) + (lastContractOk ? 0 : 1);
  const meetOk = !!lead.meetingDate && !!lead.meetingTime;
  const notesOk = !!lead.meetingAudioFileId || !!(lead.meetingNotes && lead.meetingNotes.trim());
  const pkgOk = lead.pkgVideos + lead.pkgGraphics > 0 && !!lead.pkgStart && lead.pkgMonths > 0;

  type Item = { label: string; done: boolean; btn?: string; kind?: string };
  let items: Item[] = [];
  switch (lead.status) {
    case 'novLid':
      items = [
        {
          label: t('leadPanel.clContact'),
          done: !!(lead.person && (lead.phone || lead.email)),
        },
        { label: t('leadPanel.clSource'), done: !!lead.source },
      ];
      break;
    case 'analiza':
      items = [
        {
          label: t('leadPanel.clAnalysis'),
          done: !!lead.analysisFileId,
          btn: t('leadPanel.btnUpload'),
          kind: 'analysis',
        },
      ];
      break;
    case 'ponudaIzr':
      items = [
        {
          label: t('leadPanel.clOffer', { n: offerN }),
          done: lastOfferOk,
          btn: t('leadPanel.btnUploadV', { n: (lead.offers?.length ?? 0) + 1 }),
          kind: 'offer',
        },
      ];
      break;
    case 'sostanok':
      items = [
        { label: t('leadPanel.clMeetDate'), done: meetOk },
        {
          label: t('leadPanel.clAudio'),
          done: notesOk,
          btn: t('leadPanel.btnUploadAudio'),
          kind: 'audio',
        },
      ];
      break;
    case 'dogIzr':
      items = [
        { label: t('leadPanel.pkgParams'), done: pkgOk },
        {
          label: t('leadPanel.clContract', { n: contractN }),
          done: lastContractOk,
          btn: t('leadPanel.btnUploadV', { n: (lead.contracts?.length ?? 0) + 1 }),
          kind: 'contract',
        },
      ];
      break;
    case 'dogKlient':
      items = [
        {
          label: t('leadPanel.clSigned'),
          done: !!lead.signedFileId,
          btn: t('leadPanel.btnUpload'),
          kind: 'signed',
        },
      ];
      break;
    case 'strategija':
    case 'aktivacija':
      items = [
        {
          label: t('leadPanel.clStrategy'),
          done: !!lead.strategyFileId,
          btn: t('leadPanel.btnUpload'),
          kind: 'strategy',
        },
        {
          label: t('leadPanel.clFable'),
          done: !!lead.fableFileId,
          btn: t('leadPanel.btnUpload'),
          kind: 'fable',
        },
      ];
      break;
    default:
      return null;
  }
  return (
    <Section title={t('leadPanel.checklistTitle', { label: CRM_STATUS_META[lead.status].label })}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <div key={it.label} style={checkRow}>
            <span style={checkMark(it.done)}>{it.done ? '✓' : ''}</span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: it.done ? 'var(--gd-ink-muted)' : 'var(--gd-ink)',
              }}
            >
              {it.label}
            </span>
            {it.btn && !it.done && it.kind && (
              <button type="button" style={smallBtn} onClick={() => onUpload(it.kind!)}>
                {it.btn}
              </button>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Состанок ──
function MeetingZone({ lead }: { lead: LeadRow }) {
  const update = useUpdateMeeting(lead.id);
  const [date, setDate] = useState(lead.meetingDate ? lead.meetingDate.slice(0, 10) : '');
  const [time, setTime] = useState(lead.meetingTime ?? '');
  const [place, setPlace] = useState(lead.meetingPlace ?? '');
  const [notes, setNotes] = useState(lead.meetingNotes ?? '');
  return (
    <Section title={t('leadPanel.meeting')}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="date" style={input} value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" style={input} value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <input
        style={{ ...input, marginTop: 8 }}
        placeholder={t('leadPanel.phPlace')}
        value={place}
        onChange={(e) => setPlace(e.target.value)}
      />
      <textarea
        style={{ ...ta, marginTop: 8 }}
        placeholder={t('leadPanel.phConclusions')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          style={btnGhost}
          onClick={() =>
            update.mutate({
              date: date ? new Date(date).toISOString() : null,
              time,
              place,
              notes,
            })
          }
        >
          {t('leadPanel.save')}
        </button>
        {!lead.meetingHeld && (
          <button type="button" style={btnPrimary} onClick={() => update.mutate({ held: true })}>
            {t('leadPanel.markHeld')}
          </button>
        )}
      </div>
    </Section>
  );
}

// ── Пакет ──
function PackageZone({ lead, editable }: { lead: LeadRow; editable: boolean }) {
  const update = useUpdatePackage(lead.id);
  const [v, setV] = useState(String(lead.pkgVideos));
  const [g, setG] = useState(String(lead.pkgGraphics));
  const [meta, setMeta] = useState(lead.pkgMeta);
  const [start, setStart] = useState(lead.pkgStart ?? '');
  const [months, setMonths] = useState(String(lead.pkgMonths));
  const [cal, setCal] = useState<'specificen' | 'standarden'>(lead.pkgCalType);
  return (
    <Section title={t('leadPanel.pkgParams')}>
      <div style={{ display: 'flex', gap: 8, opacity: editable ? 1 : 0.7 }}>
        <LabeledInput
          label={t('leadPanel.pkgVideos')}
          value={v}
          disabled={!editable}
          onChange={setV}
        />
        <LabeledInput
          label={t('leadPanel.pkgGraphics')}
          value={g}
          disabled={!editable}
          onChange={setG}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, opacity: editable ? 1 : 0.7 }}>
        <LabeledInput
          label={t('leadPanel.pkgStart')}
          value={start}
          disabled={!editable}
          onChange={setStart}
        />
        <LabeledInput
          label={t('leadPanel.pkgMonths')}
          value={months}
          disabled={!editable}
          onChange={setMonths}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          type="button"
          disabled={!editable}
          onClick={() => editable && setMeta(!meta)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${meta ? '#0866FF' : 'var(--gd-border)'}`,
            background: meta ? '#0866FF' : '#fff',
            color: meta ? '#fff' : 'var(--gd-ink-secondary)',
            fontSize: 12,
            cursor: editable ? 'pointer' : 'default',
          }}
        >
          Meta Ads: {meta ? t('leadPanel.yes') : t('leadPanel.no')}
        </button>
        {(['specificen', 'standarden'] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={!editable}
            onClick={() => editable && setCal(c)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--gd-border)',
              background: cal === c ? '#EBF2FF' : '#fff',
              color: cal === c ? '#0052D9' : 'var(--gd-ink-secondary)',
              fontWeight: cal === c ? 600 : 500,
              fontSize: 12,
              cursor: editable ? 'pointer' : 'default',
            }}
          >
            {c === 'specificen' ? t('leadPanel.calSpecificCap') : t('leadPanel.calStandardCap')}
          </button>
        ))}
      </div>
      {editable && (
        <button
          type="button"
          style={{ ...btnGhost, marginTop: 8 }}
          onClick={() =>
            update.mutate({
              videos: Number(v) || 0,
              graphics: Number(g) || 0,
              meta,
              start: start || undefined,
              months: Number(months) || 0,
              calType: cal,
            })
          }
        >
          {t('leadPanel.savePackage')}
        </button>
      )}
    </Section>
  );
}

// ── Тим ──
function TeamZone({ lead, me }: { lead: LeadRow; me: { role: string } }) {
  const update = useUpdateTeam(lead.id);
  const locked = !(me.role === 'dir' && lead.status === 'aktivacija');
  const team = lead.team ?? {};
  return (
    <Section title={t('leadPanel.stdTeam')}>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginBottom: 8 }}>
        {locked ? t('leadPanel.teamLocked') : t('leadPanel.teamEditable')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(
          [
            ['am', t('leadPanel.roleAm')],
            ['rez', t('leadPanel.roleRez')],
            ['krea', t('leadPanel.roleKrea')],
            ['ana', t('leadPanel.roleAna')],
          ] as Array<[keyof NonNullable<LeadRow['team']>, string]>
        ).map(([k, label]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--gd-ink-muted)' }}>{label}</span>
            <span>{team[k] ? t('leadPanel.assigned') : '—'}</span>
          </div>
        ))}
      </div>
      {!locked && (
        <button
          type="button"
          style={{ ...btnGhost, marginTop: 8 }}
          onClick={() => update.mutate(team)}
        >
          {t('leadPanel.saveTeam')}
        </button>
      )}
    </Section>
  );
}

// ── Документи ──
function DocsList({ lead }: { lead: LeadRow }) {
  const docs: Array<{ name: string; kind: string; tag?: string }> = [];
  if (lead.analysisFileId)
    docs.push({ name: t('leadPanel.docAnalysis'), kind: t('leadPanel.docAnalysisKind') });
  lead.offers?.forEach((o) =>
    docs.push({
      name: t('leadPanel.clOffer', { n: o.version }),
      kind: t('leadPanel.docOffer'),
      tag: o.ret
        ? t('leadPanel.tagOfferRet')
        : o.clientRet
          ? t('leadPanel.tagClientChanges')
          : undefined,
    }),
  );
  if (lead.meetingAudioFileId)
    docs.push({ name: t('leadPanel.docMeetAudio'), kind: t('leadPanel.docAudioKind') });
  lead.contracts?.forEach((o) =>
    docs.push({
      name: t('leadPanel.clContract', { n: o.version }),
      kind: t('leadPanel.docContract'),
      tag: o.ret
        ? t('leadPanel.tagContractRet')
        : o.clientRet
          ? t('leadPanel.tagClientChanges')
          : undefined,
    }),
  );
  if (lead.signedFileId)
    docs.push({ name: t('leadPanel.docSigned'), kind: t('leadPanel.docScanKind') });
  if (lead.strategyFileId)
    docs.push({ name: t('leadPanel.docStrategy'), kind: t('leadPanel.docStrategyKind') });
  if (lead.fableFileId)
    docs.push({ name: t('leadPanel.docFable'), kind: t('leadPanel.docPlannerKind') });
  if (docs.length === 0) return null;
  return (
    <Section title={t('leadPanel.documents')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ flex: 1 }}>{d.name}</span>
            <span style={{ color: 'var(--gd-ink-muted)', fontSize: 11 }}>{d.kind}</span>
            {d.tag && (
              <span style={{ ...verPill, background: '#FFFBEB', color: '#B45309' }}>{d.tag}</span>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── помошни ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function Banner({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <div
      style={{ marginTop: 12, padding: 12, borderRadius: 8, background: bg, color, fontSize: 13 }}
    >
      {children}
    </div>
  );
}
function LabeledInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ flex: 1 }}>
      <span
        style={{ display: 'block', fontSize: 11, color: 'var(--gd-ink-muted)', marginBottom: 2 }}
      >
        {label}
      </span>
      <input
        style={input}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,22,28,.4)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 60,
};
const drawer: React.CSSProperties = {
  width: 520,
  maxWidth: '96vw',
  height: '100%',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
};
const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: 20,
};
const closeBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 18,
  cursor: 'pointer',
  color: 'var(--gd-ink-muted)',
};
const stepBar: React.CSSProperties = { flex: 1, height: 4, borderRadius: 2 };
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--gd-ink-muted)',
  marginBottom: 8,
};
const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};
const infoK: React.CSSProperties = { fontSize: 11, color: 'var(--gd-ink-muted)' };
const infoV: React.CSSProperties = { fontSize: 13, fontWeight: 500 };
const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const checkMark = (done: boolean): React.CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: `1px solid ${done ? '#16A34A' : '#C4CBD4'}`,
  background: done ? '#16A34A' : '#fff',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  flexShrink: 0,
});
const input: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  fontSize: 13,
  boxSizing: 'border-box',
};
const ta: React.CSSProperties = { ...input, minHeight: 64, resize: 'vertical' };
const verPill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: '#EBF2FF',
  color: '#0052D9',
};
const smallBtn: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #C7DCFF',
  background: '#EBF2FF',
  color: '#0052D9',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#0866FF',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid #FCA5A5',
  background: '#fff',
  color: '#B91C1C',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
