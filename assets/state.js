// 数据模型与本地存储

// 使用指定的持久化 key（验收示例：schedule_demo_v1）
const STORAGE_KEY = 'schedule_demo_v1';

const defaultRooms = [
  { id: 1, name: '1号直播间' },
  { id: 2, name: '2号直播间' },
  { id: 3, name: '3号直播间' },
];

const defaultAnchors = [
  { id: 'a1', name: '小明' },
  { id: 'a2', name: '小红' },
  { id: 'a3', name: '小李' },
  { id: 'a4', name: '小王' },
  { id: 'a5', name: '小赵' },
  { id: 'a6', name: '小刘' },
  { id: 'a7', name: '小陈' },
  { id: 'a8', name: '小周' },
  { id: 'a9', name: '小杨' },
  { id: 'a10', name: '小孙' },
  { id: 'a11', name: '小马' },
];

const defaultShifts = [];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rooms: defaultRooms, anchors: defaultAnchors, shifts: defaultShifts };
    const obj = JSON.parse(raw);
    return {
      rooms: Array.isArray(obj.rooms) ? obj.rooms : defaultRooms,
      anchors: Array.isArray(obj.anchors) ? obj.anchors : defaultAnchors,
      shifts: Array.isArray(obj.shifts) ? obj.shifts : defaultShifts,
    };
  } catch (e) {
    return { rooms: defaultRooms, anchors: defaultAnchors, shifts: defaultShifts };
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    // 忽略存储错误（容量/隐身模式等）
  }
}

export const state = loadState();

export function updateShifts(updater) {
  const next = typeof updater === 'function' ? updater(state.shifts) : updater;
  state.shifts = Array.isArray(next) ? next : state.shifts;
  saveState(state);
}

export function clearAllShifts() {
  state.shifts = [];
  saveState(state);
}

export function getRooms() { return state.rooms; }
export function getAnchors() { return state.anchors; }
export function getShifts() { return state.shifts; }
