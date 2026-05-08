import type {
  Account,
  Contact,
  ContactMethod,
  Day,
  Event,
  EventAccount,
  EventContact,
} from '@brybo/shared';

interface BuildArgs {
  profileName: string;
  viewDate: string;
  todayIso: string;
  activeUserId: string;
  storeAccounts: Account[];
  storeContacts: Contact[];
  storeContactMethods: ContactMethod[];
  storeEvents: Event[];
  storeDays: Day[];
  eventAccounts: EventAccount[];
  eventContacts: EventContact[];
}

const NOTE_TRUNC = 500;
const HISTORY_PER_ENTITY = 10;
const MAX_CONTEXT_CHARS = 30_000;

function trunc(s: string | null | undefined, n = NOTE_TRUNC): string {
  const t = (s ?? '').trim();
  if (!t) return '—';
  return t.length <= n ? t : t.slice(0, n) + '…';
}

function relativeDay(iso: string, today: string): string {
  if (!iso) return '?';
  const a = new Date(iso + 'T00:00:00').getTime();
  const b = new Date(today + 'T00:00:00').getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `in ${diff}d`;
}

function renderEventLine(e: Event, dayDate: string, todayIso: string): string {
  const status = (e.status ?? 'done') === 'todo' ? '[todo]' : '[done]';
  const dateLabel = dayDate ? `${dayDate} (${relativeDay(dayDate, todayIso)})` : '?';
  const note = trunc(e.notes);
  const sale = e.amount != null ? `  $${e.amount.toLocaleString()}` : '';
  return `  - ${dateLabel} ${status} ${note}${sale}`;
}

export function buildDayContext(args: BuildArgs): string {
  const {
    profileName, viewDate, todayIso, activeUserId,
    storeAccounts, storeContacts, storeContactMethods,
    storeEvents, storeDays, eventAccounts, eventContacts,
  } = args;

  const dayDateById = new Map(storeDays.map((d) => [d.id, d.date]));
  const eventById = new Map(storeEvents.map((e) => [e.id, e]));

  // Today's day + events
  const todaysDay = storeDays.find((d) => d.user_id === activeUserId && d.date === viewDate);
  const todaysEvents = todaysDay
    ? storeEvents.filter((e) => e.day_id === todaysDay.id && !e.is_cancelled)
    : [];

  // Linked entities for today
  const todayEventIds = new Set(todaysEvents.map((e) => e.id));
  const linkedAccountIds = new Set(
    eventAccounts.filter((ea) => todayEventIds.has(ea.event_id)).map((ea) => ea.account_id),
  );
  const linkedContactIds = new Set(
    eventContacts.filter((ec) => todayEventIds.has(ec.event_id)).map((ec) => ec.contact_id),
  );

  // ── Today's events ──────────────────────────────────────────────
  const eventLines: string[] = [];
  todaysEvents.forEach((e, i) => {
    const status = (e.status ?? 'done') === 'todo' ? 'todo' : 'done';
    const accts = eventAccounts
      .filter((ea) => ea.event_id === e.id)
      .map((ea) => storeAccounts.find((a) => a.id === ea.account_id)?.name)
      .filter((n): n is string => !!n);
    const conts = eventContacts
      .filter((ec) => ec.event_id === e.id)
      .map((ec) => storeContacts.find((c) => c.id === ec.contact_id))
      .filter((c): c is Contact => !!c)
      .map((c) => `${c.first_name} ${c.last_name}`.trim());
    const sale = e.amount != null ? ` [sale $${e.amount.toLocaleString()}]` : '';
    const acctTag = accts.length > 0 ? `  accounts: ${accts.join(', ')}` : '';
    const contTag = conts.length > 0 ? `  contacts: ${conts.join(', ')}` : '';
    eventLines.push(`[${i + 1}] (${status}) ${trunc(e.notes)}${sale}${acctTag}${contTag}`);
  });

  // ── Account histories ───────────────────────────────────────────
  const accountSections: string[] = [];
  for (const accountId of linkedAccountIds) {
    const a = storeAccounts.find((x) => x.id === accountId);
    if (!a) continue;
    const myEventIds = new Set(
      eventAccounts.filter((ea) => ea.account_id === a.id).map((ea) => ea.event_id),
    );
    const allEvents = storeEvents
      .filter((e) => myEventIds.has(e.id) && !e.is_cancelled)
      .map((e) => ({ e, date: dayDateById.get(e.day_id) ?? '' }))
      .sort((x, y) => y.date.localeCompare(x.date))
      .slice(0, HISTORY_PER_ENTITY);
    const totalSales = storeEvents.reduce((sum, e) => {
      if (!myEventIds.has(e.id)) return sum;
      if (e.is_cancelled || e.amount == null) return sum;
      return sum + e.amount;
    }, 0);
    const year = String(new Date().getFullYear());
    const ytdSales = storeEvents.reduce((sum, e) => {
      if (!myEventIds.has(e.id)) return sum;
      if (e.is_cancelled || e.amount == null) return sum;
      const d = dayDateById.get(e.day_id);
      if (!d || !d.startsWith(year + '-')) return sum;
      return sum + e.amount;
    }, 0);

    const lines = [
      `## ${a.name}`,
      `location: ${a.city ?? '?'}${a.state ? ', ' + a.state : ''}`,
      `prospect: ${a.is_prospect ? 'yes' : 'no'}  ·  ytd sales: $${ytdSales.toLocaleString()}  ·  total sales: $${totalSales.toLocaleString()}`,
      `notes: ${trunc(a.notes)}`,
      `recent history (last ${HISTORY_PER_ENTITY}, newest first):`,
      ...allEvents.map(({ e, date }) => renderEventLine(e, date, todayIso)),
    ];
    accountSections.push(lines.join('\n'));
  }

  // ── Contact histories ───────────────────────────────────────────
  const contactSections: string[] = [];
  for (const contactId of linkedContactIds) {
    const c = storeContacts.find((x) => x.id === contactId);
    if (!c) continue;
    const linkedAcct = c.account_id
      ? storeAccounts.find((a) => a.id === c.account_id)?.name ?? null
      : null;
    const methods = storeContactMethods
      .filter((m) => m.contact_id === c.id)
      .map((m) => `${m.type}: ${m.value}`)
      .join('  ·  ');
    const myEventIds = new Set(
      eventContacts.filter((ec) => ec.contact_id === c.id).map((ec) => ec.event_id),
    );
    const allEvents = storeEvents
      .filter((e) => myEventIds.has(e.id) && !e.is_cancelled)
      .map((e) => ({ e, date: dayDateById.get(e.day_id) ?? '' }))
      .sort((x, y) => y.date.localeCompare(x.date))
      .slice(0, HISTORY_PER_ENTITY);

    const fullName = `${c.first_name} ${c.last_name}`.trim() || '(unnamed)';
    const lines = [
      `## ${fullName}${linkedAcct ? `  (account: ${linkedAcct})` : ''}`,
      `methods: ${methods || '—'}`,
      `notes: ${trunc(c.notes)}`,
      `recent history (last ${HISTORY_PER_ENTITY}, newest first):`,
      ...allEvents.map(({ e, date }) => renderEventLine(e, date, todayIso)),
    ];
    contactSections.push(lines.join('\n'));
  }

  // ── Compose ─────────────────────────────────────────────────────
  const header = [
    `PROFILE: ${profileName}`,
    `DATE VIEWED: ${viewDate} (${relativeDay(viewDate, todayIso)})`,
    `TODAY: ${todayIso}`,
  ].join('\n');

  const eventsBlock = eventLines.length > 0
    ? `—— EVENTS LOGGED FOR THIS DAY ——\n${eventLines.join('\n')}`
    : `—— EVENTS LOGGED FOR THIS DAY ——\n(none)`;

  const accountsBlock = accountSections.length > 0
    ? `—— LINKED ACCOUNTS (${accountSections.length}) ——\n${accountSections.join('\n\n')}`
    : `—— LINKED ACCOUNTS ——\n(none)`;

  const contactsBlock = contactSections.length > 0
    ? `—— LINKED CONTACTS (${contactSections.length}) ——\n${contactSections.join('\n\n')}`
    : `—— LINKED CONTACTS ——\n(none)`;

  let output = [header, eventsBlock, accountsBlock, contactsBlock].join('\n\n');

  // Soft cap: if we exceed budget, drop history sections back to 3 entries.
  if (output.length > MAX_CONTEXT_CHARS) {
    output = output
      .split('\n')
      .filter((line, idx, arr) => {
        // Trim very long history bullet runs — keep first 3 of each `recent history` block.
        if (!line.startsWith('  - ')) return true;
        let prevHistoryIdx = idx - 1;
        let bulletIdx = 0;
        while (prevHistoryIdx >= 0 && arr[prevHistoryIdx].startsWith('  - ')) {
          bulletIdx++;
          prevHistoryIdx--;
        }
        return bulletIdx < 3;
      })
      .join('\n');
  }
  return output;
}
