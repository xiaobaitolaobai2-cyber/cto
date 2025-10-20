import { el, dayNames, formatTime } from './ui.js';

// 渲染 7 天 x 48 半小时列的网格骨架
export function renderScheduleGrid(opts = {}) {
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
  for (let d = 0; d < 7; d++) {
    dayCol.appendChild(el('div', { class: 'day-label' }, dayNames[d]));
  }

  const bodyScroll = el('div', { class: 'grid-scroll body-scroll' });
  const grid = el('div', { class: 'grid-body' });
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 48; c++) {
      const isHour = c % 2 === 0;
      grid.appendChild(el('div', { class: `grid-cell ${isHour ? 'hour' : 'half'}` }));
    }
  }
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
