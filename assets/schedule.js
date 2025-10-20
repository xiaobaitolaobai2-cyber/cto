import { el, dayNames, formatTime } from './ui.js';
import { getShifts, getAnchors, getRooms, replaceShift, removeShift, checkShiftConflicts, parseTimeToIndex, indexToTime } from './state.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function toDateString(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function ensureTooltipEl() {
  let tip = document.getElementById('custom-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'custom-tooltip';
    tip.className = 'tooltip-floating';
    tip.style.display = 'none';
    document.body.appendChild(tip);
  }
  return tip;
}

function showTooltipFor(target, text) {
  const tip = ensureTooltipEl();
  if (!text) { tip.style.display = 'none'; return; }
  const rect = target.getBoundingClientRect();
  tip.textContent = text;
  tip.style.display = 'block';
  const margin = 8;
  let left = rect.left + (rect.width / 2) - Math.min(240, tip.offsetWidth) / 2;
  left = Math.max(8, Math.min(window.innerWidth - 8 - 240, left));
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, rect.top - tip.offsetHeight - margin)}px`;
}
function hideTooltip() { const tip = document.getElementById('custom-tooltip'); if (tip) tip.style.display = 'none'; }

function openEditModal(shiftId, opts) {
  const onChange = opts?.onChange;
  const s = getShifts().find(x => x.id === shiftId);
  if (!s) return;
  const anchors = getAnchors();
  const rooms = getRooms();

  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } });
  const modal = el('div', { class: 'modal' });

  const title = el('div', { class: 'modal-title' }, '编辑排班');
  const fieldAnchors = el('div', { class: 'field' },
    el('label', {}, '主播（可多选）'),
    el('select', { id: 'md-anchors', multiple: true }, anchors.map(a => el('option', { value: a.id, selected: Array.isArray(s.anchorIds) && s.anchorIds.includes(a.id) }, a.name)))
  );
  const fieldStart = el('div', { class: 'field' }, el('label', {}, '开始时间'), el('input', { id: 'md-start', type: 'time', step: 1800, value: s.start }));
  const fieldEnd = el('div', { class: 'field' }, el('label', {}, '结束时间'), el('input', { id: 'md-end', type: 'time', step: 1800, value: s.end }));
  const fieldNote = el('div', { class: 'field' }, el('label', {}, '备注'), el('textarea', { id: 'md-note', rows: 2 }, s.note || ''));
  const actions = el('div', { class: 'modal-actions' },
    el('button', { class: 'danger', onclick: () => { if (confirm('确定删除该排班？')) { removeShift(shiftId); close(); onChange && onChange(); } } }, '删除'),
    el('div', { class: 'spacer' }),
    el('button', { onclick: () => { close(); } }, '取消'),
    el('button', { class: 'primary', onclick: () => {
      const anchorIds = Array.from(modal.querySelector('#md-anchors').selectedOptions).map(o => o.value);
      const start = modal.querySelector('#md-start').value;
      const end = modal.querySelector('#md-end').value;
      const note = modal.querySelector('#md-note').value.trim();
      if (!anchorIds.length) { alert('请选择至少一位主播'); return; }
      const startIdx = parseTimeToIndex(start); const endIdx = parseTimeToIndex(end);
      if (!(endIdx > startIdx)) { alert('结束时间必须晚于开始时间'); return; }
      const proposed = { ...s, start, end, anchorIds, note };
      const chk = checkShiftConflicts(proposed, s.id);
      if (!chk.ok) { alert(chk.message); return; }
      replaceShift(s.id, { start, end, anchorIds, note });
      close(); onChange && onChange();
    } }, '保存')
  );

  modal.append(title, fieldAnchors, fieldStart, fieldEnd, fieldNote, actions);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() { try { document.body.removeChild(backdrop); } catch (e) {} }
}

function renderEvents(grid, opts) {
  const { weekStartDate, events = [], interactive = false, onChange } = opts;
  if (!events.length) return;
  // events: { id, date: 'YYYY-MM-DD', start: 'HH:mm', end: 'HH:mm', label?: string, roomLabel?: string, roomId, note, anchorIds }
  const weekStart = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
  const dateToIndex = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dateToIndex.set(toDateString(d), i);
  }

  const slotWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-width')) || 64;

  for (const ev of events) {
    const dayIdx = dateToIndex.get(ev.date);
    if (dayIdx === undefined) continue;
    const startIdx = clamp(parseTimeToIndex(ev.start), 0, 48);
    const endIdx = clamp(parseTimeToIndex(ev.end), startIdx + 1, 48);
    const colStart = startIdx + 1; // grid 列从 1 开始
    const colEnd = endIdx + 1;
    const row = dayIdx + 1;

    const block = el('div', {
      class: 'event-block',
      style: { gridColumn: `${colStart} / ${colEnd}`, gridRow: `${row} / ${row}` },
      'data-id': ev.id || '',
      'data-note': ev.note || '',
    }, [
      ev.roomLabel ? el('span', { class: 'event-room' }, ev.roomLabel) : null,
      el('span', { class: 'event-time' }, `${ev.start}-${ev.end}`),
      ev.label ? el('span', { class: 'event-label' }, ev.label) : null,
    ]);

    if (interactive) {
      const delBtn = el('button', { class: 'event-del', title: '删除', onclick: (e) => { e.stopPropagation(); if (confirm('确定删除该排班？')) { removeShift(ev.id); onChange && onChange(); } } }, '×');
      const leftH = el('div', { class: 'event-handle left' });
      const rightH = el('div', { class: 'event-handle right' });
      block.append(leftH, rightH, delBtn);

      // Tooltip for note
      block.addEventListener('mouseenter', () => { const text = String(ev.note || '').trim(); if (text) showTooltipFor(block, text); });
      block.addEventListener('mouseleave', hideTooltip);

      // Click to open edit modal (avoid if drag occurred)
      let moved = false; let dragMode = null; // 'move' | 'resize-left' | 'resize-right'
      let startX = 0; let origStart = startIdx; let origEnd = endIdx;

      function onMouseMove(e) {
        const dx = e.pageX - startX;
        const deltaSlots = Math.round(dx / slotWidth);
        if (deltaSlots !== 0) moved = true;
        if (dragMode === 'move') {
          const dur = origEnd - origStart;
          let ns = clamp(origStart + deltaSlots, 0, 48 - dur);
          let ne = ns + dur;
          block.style.gridColumn = `${ns + 1} / ${ne + 1}`;
        } else if (dragMode === 'resize-left') {
          let ns = clamp(origStart + deltaSlots, 0, origEnd - 1);
          block.style.gridColumn = `${ns + 1} / ${endIdx + 1}`;
        } else if (dragMode === 'resize-right') {
          let ne = clamp(origEnd + deltaSlots, origStart + 1, 48);
          block.style.gridColumn = `${startIdx + 1} / ${ne + 1}`;
        }
      }
      function stop(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stop);
        block.classList.remove('dragging');

        if (!dragMode) return;
        const dx = e.pageX - startX; const deltaSlots = Math.round(dx / slotWidth);
        let newStart = startIdx; let newEnd = endIdx;
        if (dragMode === 'move') {
          const dur = endIdx - startIdx;
          newStart = clamp(origStart + deltaSlots, 0, 48 - dur);
          newEnd = newStart + dur;
        } else if (dragMode === 'resize-left') {
          newStart = clamp(origStart + deltaSlots, 0, endIdx - 1);
          newEnd = endIdx;
        } else if (dragMode === 'resize-right') {
          newStart = startIdx;
          newEnd = clamp(origEnd + deltaSlots, startIdx + 1, 48);
        }

        // Commit with validation
        if (newStart === startIdx && newEnd === endIdx) return; // nothing changed
        const proposed = { id: ev.id, date: ev.date, start: indexToTime(newStart), end: indexToTime(newEnd), roomId: ev.roomId, anchorIds: ev.anchorIds || [], note: ev.note || '' };
        const chk = checkShiftConflicts(proposed, ev.id);
        if (!chk.ok) {
          alert(chk.message);
          // revert UI by re-rendering
          onChange && onChange();
          return;
        }
        replaceShift(ev.id, { start: proposed.start, end: proposed.end });
        onChange && onChange();
      }
      function startDrag(e, mode) {
        dragMode = mode; moved = false;
        startX = e.pageX; origStart = startIdx; origEnd = endIdx;
        block.classList.add('dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stop);
      }

      block.addEventListener('mousedown', (e) => {
        if (e.target === leftH) { startDrag(e, 'resize-left'); return; }
        if (e.target === rightH) { startDrag(e, 'resize-right'); return; }
        if ((e.target).classList && (e.target).classList.contains('event-del')) return;
        startDrag(e, 'move');
      });

      block.addEventListener('click', (e) => {
        if (moved) return; // was a drag
        openEditModal(ev.id, { onChange });
      });
    } else {
      // Non-interactive: still show note tooltip
      block.addEventListener('mouseenter', () => { const text = String(ev.note || '').trim(); if (text) showTooltipFor(block, text); });
      block.addEventListener('mouseleave', hideTooltip);
    }

    grid.appendChild(block);
  }
}

// 渲染 7 天 x 48 半小时列的网格骨架，并可选叠加事件块
export function renderScheduleGrid(opts = {}) {
  const { weekStartDate = getWeekStart(new Date()), events = [], dayDateLabels = true, interactive = false, onChange } = opts;
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
  renderEvents(grid, { weekStartDate: start, events, interactive, onChange });

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
