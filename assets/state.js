// 数据模型与本地存储与业务校验

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

// ===== 时间工具 =====
function pad2(n) { return String(n).padStart(2, '0'); }
export function indexToTime(i) {
  const h = Math.floor(i / 2);
  const m = (i % 2) ? 30 : 0;
  return `${pad2(h)}:${pad2(m)}`;
}
export function parseTimeToIndex(t) {
  if (typeof t !== 'string') return 0;
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  return Math.max(0, Math.min(48, (isNaN(h) ? 0 : h) * 2 + ((isNaN(m) ? 0 : m) >= 30 ? 1 : 0)));
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd; // 允许贴边，不视为重叠
}

// ===== 冲突校验 =====
// proposed: { id?, date, start, end, roomId, anchorIds, note? }
export function checkShiftConflicts(proposed, ignoreId = null) {
  if (!proposed) return { ok: true };
  const date = proposed.date;
  const startIdx = typeof proposed.start === 'number' ? proposed.start : parseTimeToIndex(proposed.start);
  const endIdx = typeof proposed.end === 'number' ? proposed.end : parseTimeToIndex(proposed.end);
  const roomId = proposed.roomId;
  const anchors = Array.isArray(proposed.anchorIds) ? proposed.anchorIds : [];

  const roomsMap = new Map(getRooms().map(r => [r.id, r.name]));
  const anchorsMap = new Map(getAnchors().map(a => [a.id, a.name]));

  for (const s of getShifts()) {
    if (s.id === ignoreId) continue;
    if (s.date !== date) continue;
    const sStart = parseTimeToIndex(s.start);
    const sEnd = parseTimeToIndex(s.end);

    // 规则 1：同一直播间同一时间不可重叠
    if (s.roomId === roomId && rangesOverlap(startIdx, endIdx, sStart, sEnd)) {
      const msg = `同房间重叠：${roomsMap.get(roomId) || roomId} 时段 ${indexToTime(sStart)}-${indexToTime(sEnd)} 与当前编辑时段重叠。`;
      return { ok: false, reason: 'room-overlap', message: msg, conflict: s };
    }

    // 规则 2：主播跨房间冲突（同一时间不能出现在多个直播间）
    if (rangesOverlap(startIdx, endIdx, sStart, sEnd)) {
      const sAnchors = Array.isArray(s.anchorIds) ? s.anchorIds : [];
      const inter = anchors.filter(id => sAnchors.includes(id));
      if (inter.length) {
        const names = inter.map(id => anchorsMap.get(id) || id).join('、');
        const roomName = roomsMap.get(s.roomId) || s.roomId;
        const overlStart = Math.max(startIdx, sStart);
        const overlEnd = Math.min(endIdx, sEnd);
        const msg = `主播跨房间冲突：${names} 在 ${indexToTime(overlStart)}-${indexToTime(overlEnd)} 已排在 ${roomName}。`;
        return { ok: false, reason: 'anchor-overlap', message: msg, conflict: s, anchors: inter };
      }
    }
  }

  return { ok: true };
}

// ===== 便捷操作函数 =====
export function removeShift(id) {
  updateShifts(prev => prev.filter(s => s.id !== id));
}

export function replaceShift(id, patch) {
  updateShifts(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
}
