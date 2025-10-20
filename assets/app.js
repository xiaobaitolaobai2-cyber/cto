import { clear, el, setActiveTab } from './ui.js';
import { state, getRooms, getAnchors } from './state.js';
import { renderScheduleGrid } from './schedule.js';

function currentRoute() {
  const h = (location.hash || '').replace('#', '');
  return h === 'mine' ? 'mine' : 'manage';
}

function renderManageView() {
  const section = el('section', { class: 'view-manage' });
  section.appendChild(renderScheduleGrid());
  return section;
}

function renderMineView() {
  const section = el('section', { class: 'view-mine' });
  section.appendChild(renderScheduleGrid());
  return section;
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
