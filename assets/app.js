import { clear, el, setActiveTab } from './ui.js';
import { state, getRooms, getAnchors, getShifts, updateShifts, clearAllShifts } from './state.js';
import { renderScheduleGrid, getWeekStart } from './schedule.js';

let selectedAnchorId = null;

function currentRoute() {
  const h = (location.hash || '').replace('#', '');
  return h === 'mine' ? 'mine' : 'manage';
}

function toDateString(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function parseTimeStr(t) { const [h,m] = t.split(':').map(Number); return { h, m }; }

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function makeId() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`; }

function buildEventsForWeek(weekStartDate, { onlyAnchorId = null } = {}) {
  const rooms = getRooms();
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));
  const weekStart = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return toDateString(d); });
  const events = [];
  for (const s of getShifts()) {
    if (onlyAnchorId && !Array.isArray(s.anchorIds) ? true : (onlyAnchorId && !s.anchorIds.includes(onlyAnchorId))) continue;
    if (!weekDates.includes(s.date)) continue;
    const labelParts = [];
    if (Array.isArray(s.anchorIds)) {
      const anchorNames = getAnchors().filter(a => s.anchorIds.includes(a.id)).map(a => a.name);
      if (anchorNames.length) labelParts.push(anchorNames.join('、'));
    }
    if (s.note) labelParts.push(s.note);
    events.push({
      date: s.date,
      start: s.start,
      end: s.end,
      roomLabel: roomMap.get(s.roomId) || `直播间#${s.roomId}`,
      label: labelParts.join(' | '),
    });
  }
  return events;
}

function renderManageView() {
  const section = el('section', { class: 'view-manage' });

  // 顶部工具栏（清空数据）
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { class: 'left' }, el('span', { class: 'muted' }, '排班管理（周视图 7x48）')),
    el('div', { class: 'right' },
      el('button', { class: 'danger', onclick: () => { if (confirm('确定清空所有排班数据？')) { clearAllShifts(); renderApp(); } } }, '清空数据')
    )
  );
  section.appendChild(toolbar);

  // 快速添加排班表单
  const anchors = getAnchors();
  const rooms = getRooms();
  const form = el('form', { class: 'manage-form', onsubmit: (e) => {
    e.preventDefault();
    const anchorIds = Array.from(form.querySelector('#mf-anchors').selectedOptions).map(o => o.value);
    const date = form.querySelector('#mf-date').value;
    const start = form.querySelector('#mf-start').value;
    const end = form.querySelector('#mf-end').value;
    const roomId = Number(form.querySelector('#mf-room').value);
    const note = form.querySelector('#mf-note').value.trim();
    if (!anchorIds.length) { alert('请选择至少一位主播'); return; }
    if (!date || !start || !end) { alert('请完整填写日期与时间'); return; }
    const { h: sh, m: sm } = parseTimeStr(start);
    const { h: eh, m: em } = parseTimeStr(end);
    if (eh < sh || (eh === sh && em <= sm)) { alert('结束时间必须晚于开始时间'); return; }

    updateShifts(prev => [
      ...prev,
      { id: makeId(), date, start, end, roomId, note, anchorIds }
    ]);
    renderApp();
  } },
    el('div', { class: 'field' },
      el('label', {}, '主播（可多选）'),
      el('select', { id: 'mf-anchors', multiple: true }, anchors.map(a => el('option', { value: a.id }, a.name))),
    ),
    el('div', { class: 'field' }, el('label', {}, '日期'), el('input', { id: 'mf-date', type: 'date' })),
    el('div', { class: 'field' }, el('label', {}, '开始时间'), el('input', { id: 'mf-start', type: 'time', step: 1800, value: '09:00' })),
    el('div', { class: 'field' }, el('label', {}, '结束时间'), el('input', { id: 'mf-end', type: 'time', step: 1800, value: '12:00' })),
    el('div', { class: 'field' }, el('label', {}, '直播间'), el('select', { id: 'mf-room' }, rooms.map(r => el('option', { value: r.id }, r.name)))),
    el('div', { class: 'field' }, el('label', {}, '备注'), el('textarea', { id: 'mf-note', rows: 1, placeholder: '可选' })),
    el('div', { class: 'actions' }, el('button', { type: 'submit', class: 'primary' }, '添加排班')),
  );

  // 默认日期设定为本周一
  const weekStart = getWeekStart(new Date());
  form.querySelector('#mf-date').value = toDateString(weekStart);

  section.appendChild(form);

  // 网格 + 叠加所有主播的本周排班
  const events = buildEventsForWeek(weekStart);
  section.appendChild(renderScheduleGrid({ weekStartDate: weekStart, events, onShiftsChange: renderApp }));
  return section;
}

function renderMineView() {
  const section = el('section', { class: 'view-mine' });

  // 选择主播 + 导出 + 清空数据
  const anchors = getAnchors();
  if (!selectedAnchorId) selectedAnchorId = anchors[0]?.id || null;
  const select = el('select', { onchange: (e) => { selectedAnchorId = e.target.value; renderApp(); } },
    anchors.map(a => el('option', { value: a.id, selected: a.id === selectedAnchorId }, a.name))
  );

  const weekStart = getWeekStart(new Date());
  const { year, week } = getISOWeek(weekStart);
  const exportBtn = el('button', { class: 'primary', onclick: () => exportCSVForSelected(weekStart) }, '导出 CSV');
  const clearBtn = el('button', { class: 'danger', onclick: () => { if (confirm('确定清空所有排班数据？')) { clearAllShifts(); renderApp(); } } }, '清空数据');

  const toolbar = el('div', { class: 'toolbar' },
    el('div', { class: 'left' },
      el('span', { class: 'muted' }, '选择主播'),
      select,
      el('span', { class: 'muted' }, `当周（ISO ${year}-W${String(week).padStart(2,'0')}）`),
    ),
    el('div', { class: 'right' }, exportBtn, clearBtn)
  );
  section.appendChild(toolbar);

  // 仅叠加所选主播的当周排班（跨房间合并展示）
  const events = buildEventsForWeek(weekStart, { onlyAnchorId: selectedAnchorId });
  section.appendChild(renderScheduleGrid({ weekStartDate: weekStart, events, onShiftsChange: renderApp }));
  return section;
}

function exportCSVForSelected(weekStart) {
  if (!selectedAnchorId) return;
  const anchors = getAnchors();
  const rooms = getRooms();
  const anchorMap = new Map(anchors.map(a => [a.id, a.name]));
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));

  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return toDateString(d); });
  const rows = [];
  for (const s of getShifts()) {
    if (!Array.isArray(s.anchorIds) || !s.anchorIds.includes(selectedAnchorId)) continue;
    if (!weekDates.includes(s.date)) continue;
    const anchorNames = s.anchorIds.map(id => anchorMap.get(id) || id);
    rows.push([
      s.date,
      s.start,
      s.end,
      roomMap.get(s.roomId) || String(s.roomId),
      (s.note || '').replace(/\n|\r/g, ' '),
      anchorNames.join('、'),
    ]);
  }
  // CSV 构造
  const header = ['日期','开始时间','结束时间','直播间','备注','主播名单'];
  const csv = [header, ...rows].map(r => r.map(field => {
    const f = String(field ?? '');
    if (f.includes(',') || f.includes('"') || f.includes('\n')) return '"' + f.replace(/"/g, '""') + '"';
    return f;
  }).join(',')).join('\n');

  const { year, week } = getISOWeek(weekStart);
  const filename = `my_shifts_${year}-${String(week).padStart(2,'0')}.csv`;
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderApp() {
  const app = document.getElementById('app');
  clear(app);
  const route = currentRoute();
  setActiveTab(route);
  app.appendChild(route === 'mine' ? renderMineView() : renderManageView());
}

function init() {
  // 控制台输出静态数据
  console.log('[Rooms] 直播间列表:', getRooms());
  console.log('[Anchors] 主播列表:', getAnchors());

  renderApp();
  window.addEventListener('hashchange', renderApp);
}

// 初始化
window.addEventListener('DOMContentLoaded', init);
