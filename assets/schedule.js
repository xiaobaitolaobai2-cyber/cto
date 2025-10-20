import { el, dayNames, formatTime } from './ui.js';
import { getAnchors, getRooms, getShifts, updateShifts } from './state.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function toDateString(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function parseTimeToIndex(t) {
  // t: 'HH:mm' => 0..48
  const [h, m] = t.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}
function indexToTime(idx) {
  const h = Math.floor(idx / 2);
  const m = idx % 2 ? 30 : 0;
  return `${pad2(h)}:${pad2(m)}`;
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
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

function attachDragSelect(grid, { weekStartDate, onShiftsChange }) {
  // 预计算每行对应的日期字符串
  const start = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
  const dayDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return toDateString(d); });

  // 给每个 cell 标注 row/col，并绑定事件
  const cells = Array.from(grid.querySelectorAll('.grid-cell'));
  const rows = 7, cols = 48;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = cells[idx];
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
    }
  }

  let isDragging = false;
  let dragRow = -1;
  let dragMode = 'add'; // 'add' | 'remove'

  function setCellSelected(cell, sel) {
    if (!cell) return;
    if (sel) cell.classList.add('is-selected');
    else cell.classList.remove('is-selected');
  }
  function clearRowSelection(row) {
    for (let c = 0; c < cols; c++) {
      const idx = row * cols + c;
      setCellSelected(cells[idx], false);
    }
  }
  function getRowSelection(row) {
    const selected = [];
    for (let c = 0; c < cols; c++) {
      const idx = row * cols + c;
      if (cells[idx].classList.contains('is-selected')) selected.push(c);
    }
    return selected;
  }
  function groupIntervals(selCols) {
    const sorted = Array.from(new Set(selCols)).sort((a,b) => a-b);
    const intervals = [];
    let s = null, e = null;
    for (const x of sorted) {
      if (s === null) { s = x; e = x + 1; }
      else if (x === e) { e = x + 1; }
      else { intervals.push({ start: s, end: e }); s = x; e = x + 1; }
    }
    if (s !== null) intervals.push({ start: s, end: e });
    return intervals;
  }

  function openModal(content) {
    const overlay = el('div', { class: 'modal-overlay' });
    const modal = el('div', { class: 'modal' });
    modal.appendChild(content);
    overlay.appendChild(modal);
    function close() { document.body.removeChild(overlay); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    return { close, overlay, modal };
  }

  function createShiftModal({ date, intervals }) {
    const anchors = getAnchors();
    const rooms = getRooms();
    const summary = el('div', { class: 'modal-summary' }, `本次将创建 ${intervals.length} 段区间`);
    const list = el('ul', { class: 'modal-intervals' }, intervals.map(it => el('li', {}, `${indexToTime(it.start)}-${indexToTime(it.end)}`)));

    const anchorSel = el('select', { multiple: true, size: Math.min(8, anchors.length) }, anchors.map(a => el('option', { value: a.id }, a.name)));
    const roomSel = el('select', {}, rooms.map(r => el('option', { value: r.id }, r.name)));
    const noteInput = el('input', { type: 'text', placeholder: '备注（可选）', title: '备注将单行显示，悬浮查看完整' });

    const actions = el('div', { class: 'modal-actions' });
    let modalCtl; // 稍后赋值
    const cancelBtn = el('button', { class: 'btn', onclick: () => modalCtl.close() }, '取消');
    const saveBtn = el('button', { class: 'btn primary', onclick: onSave }, '保存');
    actions.append(cancelBtn, saveBtn);

    const form = el('div', { class: 'modal-content' }, [
      el('h3', {}, `创建排班 - ${date}`),
      summary,
      list,
      el('div', { class: 'field' }, el('label', {}, '主播（可多选）'), anchorSel),
      el('div', { class: 'field' }, el('label', {}, '直播间'), roomSel),
      el('div', { class: 'field' }, el('label', {}, '备注'), noteInput),
      actions,
    ]);

    modalCtl = openModal(form);

    function onSave() {
      const anchorIds = Array.from(anchorSel.selectedOptions).map(o => o.value);
      if (!anchorIds.length) { alert('请选择至少一位主播'); return; }
      const roomId = Number(roomSel.value);
      const note = noteInput.value.trim();

      // 校验：同房间同天同时间不可重叠
      const sameDayShifts = getShifts().filter(s => s.date === date && s.roomId === roomId);
      for (const it of intervals) {
        for (const s of sameDayShifts) {
          const sStart = parseTimeToIndex(s.start);
          const sEnd = parseTimeToIndex(s.end);
          if (overlaps(it.start, it.end, sStart, sEnd)) {
            alert(`与同房间已存在排班冲突：${indexToTime(it.start)}-${indexToTime(it.end)} 与 ${s.start}-${s.end}`);
            return;
          }
        }
      }

      // 跨房间主播冲突校验
      const conflicts = [];
      const dayShiftsAllRooms = getShifts().filter(s => s.date === date);
      for (const aid of anchorIds) {
        for (const s of dayShiftsAllRooms) {
          if (!Array.isArray(s.anchorIds) || !s.anchorIds.includes(aid)) continue;
          const sStart = parseTimeToIndex(s.start);
          const sEnd = parseTimeToIndex(s.end);
          for (const it of intervals) {
            if (overlaps(it.start, it.end, sStart, sEnd)) {
              const anchor = getAnchors().find(a => a.id === aid);
              const room = getRooms().find(r => r.id === s.roomId);
              conflicts.push(`${anchor?.name || aid} 在 ${s.date} ${s.start}-${s.end} 已在 ${room?.name || s.roomId} 排班`);
            }
          }
        }
      }
      if (conflicts.length) { alert('存在主播跨房间时间冲突：\n' + conflicts.join('\n')); return; }

      // 通过，写入多个 shift
      updateShifts(prev => ([
        ...prev,
        ...intervals.map(it => ({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`, date, start: indexToTime(it.start), end: indexToTime(it.end), roomId, note, anchorIds }))
      ]));

      modalCtl.close();
      // 通知外层刷新
      if (typeof onShiftsChange === 'function') onShiftsChange();
    }
  }

  function editShiftModal(shift) {
    const anchors = getAnchors();
    const rooms = getRooms();
    const roomName = rooms.find(r => r.id === shift.roomId)?.name || `直播间#${shift.roomId}`;
    const title = el('h3', {}, `编辑排班 - ${shift.date} ${shift.start}-${shift.end} ${roomName}`);

    const anchorSel = el('select', { multiple: true, size: Math.min(8, anchors.length) }, anchors.map(a => el('option', { value: a.id, selected: Array.isArray(shift.anchorIds) ? shift.anchorIds.includes(a.id) : false }, a.name)));

    const actions = el('div', { class: 'modal-actions' });
    let modalCtl; // 稍后赋值
    const cancelBtn = el('button', { class: 'btn', onclick: () => modalCtl.close() }, '关闭');
    const saveBtn = el('button', { class: 'btn primary', onclick: onSave }, '更换主播');
    const delBtn = el('button', { class: 'btn danger', onclick: onDelete }, '取消排班');
    actions.append(delBtn, cancelBtn, saveBtn);

    const content = el('div', { class: 'modal-content' }, [title,
      el('div', { class: 'field' }, el('label', {}, '主播（可多选）'), anchorSel),
      actions,
    ]);

    modalCtl = openModal(content);

    function onSave() {
      const anchorIds = Array.from(anchorSel.selectedOptions).map(o => o.value);
      if (!anchorIds.length) { alert('请至少选择一位主播'); return; }
      // 跨房间主播冲突校验（编辑不会改变时间/直播间）
      const conflicts = [];
      const dayShiftsAllRooms = getShifts().filter(s => s.date === shift.date && s.id !== shift.id);
      const sStart = parseTimeToIndex(shift.start), sEnd = parseTimeToIndex(shift.end);
      for (const aid of anchorIds) {
        for (const s of dayShiftsAllRooms) {
          if (!Array.isArray(s.anchorIds) || !s.anchorIds.includes(aid)) continue;
          const oStart = parseTimeToIndex(s.start), oEnd = parseTimeToIndex(s.end);
          if (overlaps(sStart, sEnd, oStart, oEnd)) {
            const anchor = getAnchors().find(a => a.id === aid);
            const room = getRooms().find(r => r.id === s.roomId);
            conflicts.push(`${anchor?.name || aid} 在 ${s.date} ${s.start}-${s.end} 已在 ${room?.name || s.roomId} 排班`);
          }
        }
      }
      if (conflicts.length) { alert('存在主播跨房间时间冲突：\n' + conflicts.join('\n')); return; }

      updateShifts(prev => prev.map(s => s.id === shift.id ? { ...s, anchorIds } : s));
      modalCtl.close();
      if (typeof onShiftsChange === 'function') onShiftsChange();
    }

    function onDelete() {
      if (!confirm('确定取消该排班？')) return;
      updateShifts(prev => prev.filter(s => s.id !== shift.id));
      modalCtl.close();
      if (typeof onShiftsChange === 'function') onShiftsChange();
    }
  }

  function finalizeSelection() {
    if (!isDragging || dragRow < 0) return;
    const selectedCols = getRowSelection(dragRow);
    const dayDate = dayDates[dragRow];
    // 清理拖拽状态
    isDragging = false; dragRow = -1; dragMode = 'add';

    if (!selectedCols.length) return;
    const intervals = groupIntervals(selectedCols);

    // 命中已有块：若存在任意交集，取首个对齐并进入编辑弹窗
    const dayShifts = getShifts().filter(s => s.date === dayDate);
    let hit = null;
    outer: for (const it of intervals) {
      for (const s of dayShifts) {
        const sStart = parseTimeToIndex(s.start), sEnd = parseTimeToIndex(s.end);
        if (overlaps(it.start, it.end, sStart, sEnd)) { hit = s; break outer; }
      }
    }

    // 清除选中高亮
    for (let r = 0; r < rows; r++) clearRowSelection(r);

    if (hit) { editShiftModal(hit); return; }
    createShiftModal({ date: dayDate, intervals });
  }

  // 绑定交互
  cells.forEach(cell => {
    cell.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 左键
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      isDragging = true; dragRow = row;
      // 按住同一行，其余行先清空
      for (let r = 0; r < rows; r++) { if (r !== row) clearRowSelection(r); }
      dragMode = cell.classList.contains('is-selected') ? 'remove' : 'add';
      setCellSelected(cell, dragMode === 'add');
      e.preventDefault();
    });
    cell.addEventListener('mouseenter', () => {
      if (!isDragging) return;
      const row = Number(cell.dataset.row);
      if (row !== dragRow) return; // 仅同一行
      setCellSelected(cell, dragMode === 'add');
    });
  });

  document.addEventListener('mouseup', finalizeSelection);
}

// 渲染 7 天 x 48 半小时列的网格骨架，并可选叠加事件块
export function renderScheduleGrid(opts = {}) {
  const { weekStartDate = getWeekStart(new Date()), events = [], dayDateLabels = true, onShiftsChange = null } = opts;
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

  // 启用涂抹选格
  attachDragSelect(grid, { weekStartDate: start, onShiftsChange });

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
