import { el, dayNames, formatTime } from './ui.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function toDateString(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function parseTimeToIndex(t) {
  // t: 'HH:mm' => 0..48
  const [h, m] = t.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

function renderEvents(grid, opts) {
  const { weekStartDate, events = [] } = opts;
  if (!events.length) return;
  // events: { date: 'YYYY-MM-DD', start: 'HH:mm', end: 'HH:mm', label?: string, roomLabel?: string }
  const weekStart = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
  const dateToIndex = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dateToIndex.set(toDateString(d), i);
  }

  for (const ev of events) {
    const dayIdx = dateToIndex.get(ev.date);
    if (dayIdx === undefined) continue;
    const startIdx = Math.max(0, Math.min(48, parseTimeToIndex(ev.start)));
    const endIdx = Math.max(startIdx + 1, Math.min(48, parseTimeToIndex(ev.end)));
    const colStart = startIdx + 1; // grid 列从 1 开始
    const colEnd = endIdx + 1;
    const row = dayIdx + 1;

    const block = el('div', {
      class: 'event-block',
      style: { gridColumn: `${colStart} / ${colEnd}`, gridRow: `${row} / ${row}` },
      title: `${ev.start}-${ev.end} ${ev.roomLabel || ''} ${ev.label || ''}`.trim(),
    }, [
      ev.roomLabel ? el('span', { class: 'event-room' }, ev.roomLabel) : null,
      el('span', { class: 'event-time' }, `${ev.start}-${ev.end}`),
      ev.label ? el('span', { class: 'event-label' }, ev.label) : null,
    ]);
    grid.appendChild(block);
  }
}

// 渲染 7 天 x 48 半小时列的网格骨架，并可选叠加事件块
export function renderScheduleGrid(opts = {}) {
  const { weekStartDate = getWeekStart(new Date()), events = [], dayDateLabels = true } = opts;
  const container = el('div', { class: 'schedule-container' });

  // 头部：左侧占位 + 时间轴
  const header = el('div', { class: 'schedule-header' });
  const headerRow = el('div', { class: 'header-row' });
  const leftGutter = el('div', { class: 'left-gutter' }, '星期/日期');
  const headerScroll = el('div', { class: 'grid-scroll header-scroll' });
  const timeHeader = el('div', { class: 'time-header' });

  for (let i = 0; i < 48; i++) {
    const hour = Math.floor(i / 2);
    const minute = i % 2 ? 30 : 0;
    const cell = el('div', { class: `time-cell ${minute === 0 ? 'hour' : 'half'}`, title: formatTime(hour, minute) }, minute === 0 ? `${formatTime(hour, 0)}` : '');
    timeHeader.appendChild(cell);
  }
  headerScroll.appendChild(timeHeader);
  headerRow.append(leftGutter, headerScroll);
  header.appendChild(headerRow);

  // 身体：左侧星期 + 网格
  const body = el('div', { class: 'schedule-body' });
  const dayCol = el('div', { class: 'day-labels' });
  const start = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
  for (let d = 0; d < 7; d++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + d);
    const dateStr = `${dayNames[d]}${dayDateLabels ? ` ${pad2(cur.getMonth()+1)}/${pad2(cur.getDate())}` : ''}`;
    dayCol.appendChild(el('div', { class: 'day-label' }, dateStr));
  }

  const bodyScroll = el('div', { class: 'grid-scroll body-scroll' });
  const grid = el('div', { class: 'grid-body' });
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 48; c++) {
      const isHour = c % 2 === 0;
      grid.appendChild(el('div', { class: `grid-cell ${isHour ? 'hour' : 'half'}` }));
    }
  }
  // 叠加事件块
  renderEvents(grid, { weekStartDate: start, events });

  bodyScroll.appendChild(grid);
  body.append(dayCol, bodyScroll);

  container.append(header, body);

  // 横向滚动同步
  let syncing = false;
  headerScroll.addEventListener('scroll', () => {
    if (syncing) return; syncing = true; bodyScroll.scrollLeft = headerScroll.scrollLeft; syncing = false;
  });
  bodyScroll.addEventListener('scroll', () => {
    if (syncing) return; syncing = true; headerScroll.scrollLeft = bodyScroll.scrollLeft; syncing = false;
  });

  return container;
}

export function getWeekStart(date) {
  // ISO 周，周一为一周开始
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day; // 调整到周一
  d.setDate(d.getDate() + diff);
  return d;
}
