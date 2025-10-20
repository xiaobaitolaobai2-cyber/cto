(function(){
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  let currentRoomId = State.rooms[0]?.id ?? 1;

  // Elements
  const roomSwitchEl = document.getElementById('room-switch');
  const gridHeaderEl = document.getElementById('grid-header');
  const weekGridEl = document.getElementById('week-grid');

  // Modal Elements
  const modal = document.getElementById('shift-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalRoomLabel = document.getElementById('modal-room-label');
  const modalTimeLabel = document.getElementById('modal-time-label');
  const anchorSearch = document.getElementById('anchor-search');
  const anchorList = document.getElementById('anchor-list');
  const noteInput = document.getElementById('note');
  const btnCancel = document.getElementById('btn-cancel');
  const btnDelete = document.getElementById('btn-delete');
  const btnSave = document.getElementById('btn-save');
  const editShiftIdInput = document.getElementById('edit-shift-id');

  // Selection state
  let selecting = null; // { day, startSlot, currentSlot, elRow, selectionEl }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function slotToTime(slot) {
    const totalMins = slot * 30;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return pad(h) + ':' + pad(m);
  }

  function renderRoomSwitch() {
    roomSwitchEl.innerHTML = '';
    State.rooms.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'room-btn' + (r.id === currentRoomId ? ' active' : '');
      btn.textContent = r.name.replace('直播间', '房间'); // 更短一些
      btn.title = r.name;
      btn.addEventListener('click', () => {
        currentRoomId = r.id;
        document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGrid();
      });
      roomSwitchEl.appendChild(btn);
    });
  }

  function renderHeader() {
    const left = document.createElement('div');
    left.className = 'day-label';
    left.textContent = '';

    const right = document.createElement('div');
    right.className = 'time-scale';

    for (let h = 0; h <= 24; h++) {
      const hour = document.createElement('div');
      hour.className = 'hour';
      hour.style.gridColumn = h === 24 ? '49 / 49' : 'span 2';
      hour.textContent = h < 24 ? (pad(h) + ':00') : '';
      right.appendChild(hour);
    }

    gridHeaderEl.innerHTML = '';
    gridHeaderEl.appendChild(left);
    gridHeaderEl.appendChild(right);
  }

  function createRow(day) {
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('div');
    label.className = 'day-label';
    label.textContent = DAYS[day];

    const slots = document.createElement('div');
    slots.className = 'slots';
    slots.dataset.day = String(day);

    for (let i = 0; i < 48; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.slot = String(i);
      slots.appendChild(cell);
    }

    // Mouse interactions for selection
    slots.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // left only
      const rect = slots.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const slot = Math.min(47, Math.max(0, Math.floor(x / (rect.width / 48))));
      const sel = document.createElement('div');
      sel.className = 'selection';
      slots.appendChild(sel);
      selecting = { day, startSlot: slot, currentSlot: slot, elRow: slots, selectionEl: sel };
      updateSelectionVisual();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!selecting || selecting.elRow !== slots) return;
      const rect = slots.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let slot = Math.round(x / (rect.width / 48));
      if (slot < 0) slot = 0; if (slot > 48) slot = 48;
      selecting.currentSlot = slot;
      updateSelectionVisual();
    });

    window.addEventListener('mouseup', (e) => {
      if (!selecting || selecting.elRow !== slots) return;
      const { day: d, startSlot, currentSlot } = selecting;
      slots.removeChild(selecting.selectionEl);
      const a = Math.min(startSlot, currentSlot);
      const b = Math.max(startSlot, currentSlot);
      selecting = null;
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      if (end <= start) return; // ignore empty
      openCreateModal({ day: d, startSlot: start, endSlot: end, roomId: currentRoomId });
    });

    row.appendChild(label);
    row.appendChild(slots);
    return row;
  }

  function updateSelectionVisual() {
    if (!selecting) return;
    const { startSlot, currentSlot, selectionEl } = selecting;
    const s = Math.min(startSlot, currentSlot);
    const e = Math.max(startSlot, currentSlot);
    const leftPct = (s / 48) * 100;
    const widthPct = ((e - s) / 48) * 100;
    selectionEl.style.left = leftPct + '%';
    selectionEl.style.width = widthPct + '%';
  }

  function renderGrid() {
    renderHeader();
    weekGridEl.innerHTML = '';

    for (let d = 0; d < 7; d++) {
      const row = createRow(d);
      weekGridEl.appendChild(row);
    }

    // Render existing shifts for current room
    const rowEls = weekGridEl.querySelectorAll('.row');
    const slotsContainerEls = weekGridEl.querySelectorAll('.row .slots');

    State.shifts.filter(s => s.roomId === currentRoomId).forEach(shift => {
      const container = slotsContainerEls[shift.day];
      const block = document.createElement('div');
      block.className = 'shift-block';
      const leftPct = (shift.startSlot / 48) * 100;
      const widthPct = ((shift.endSlot - shift.startSlot) / 48) * 100;
      block.style.left = leftPct + '%';
      block.style.width = widthPct + '%';
      const names = shift.anchorIds.map(id => State.anchors.find(a => a.id === id)?.name || id).join(',');
      const text = names + (shift.note ? '｜' + shift.note : '');
      block.textContent = text;
      block.title = `${DAYS[shift.day]} ${slotToTime(shift.startSlot)}-${slotToTime(shift.endSlot)}\n主播：${names}${shift.note ? `\n备注：${shift.note}` : ''}`;
      block.addEventListener('click', () => {
        openEditModal(shift);
      });
      container.appendChild(block);
    });

    // Update active button state
    [...roomSwitchEl.children].forEach((btn, i) => {
      const room = State.rooms[i];
      btn.classList.toggle('active', room.id === currentRoomId);
    });
  }

  function openCreateModal(init) {
    openModal({ ...init, mode: 'create' });
  }

  function openEditModal(shift) {
    openModal({ ...shift, mode: 'edit' });
  }

  function openModal(data) {
    const isEdit = data.mode === 'edit';
    modalTitle.textContent = isEdit ? '编辑排班' : '创建排班';
    modalRoomLabel.textContent = State.rooms.find(r => r.id === data.roomId)?.name || '';
    modalTimeLabel.textContent = `${DAYS[data.day]} ${slotToTime(data.startSlot)} - ${slotToTime(data.endSlot)}`;

    // Build anchor checkboxes
    anchorList.innerHTML = '';
    const selectedSet = new Set(isEdit ? data.anchorIds : []);
    State.anchors.forEach(a => {
      const item = document.createElement('label');
      item.className = 'anchor-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = a.id;
      cb.checked = selectedSet.has(a.id);
      const span = document.createElement('span');
      span.textContent = a.name;
      item.appendChild(cb);
      item.appendChild(span);
      anchorList.appendChild(item);
    });

    anchorSearch.value = '';
    noteInput.value = isEdit ? (data.note || '') : '';
    editShiftIdInput.value = isEdit ? String(data.id) : '';
    btnDelete.classList.toggle('hidden', !isEdit);

    function filterAnchors() {
      const q = anchorSearch.value.trim().toLowerCase();
      [...anchorList.children].forEach(el => {
        const name = el.textContent.toLowerCase();
        el.style.display = name.includes(q) ? '' : 'none';
      });
    }
    anchorSearch.oninput = filterAnchors;

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }

    btnCancel.onclick = () => {
      closeModal();
    };

    btnDelete.onclick = () => {
      const id = Number(editShiftIdInput.value);
      if (id) {
        State.removeShift(id);
        closeModal();
        renderGrid();
      }
    };

    btnSave.onclick = (e) => {
      e.preventDefault();
      const ids = [...anchorList.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
      if (ids.length < 1) {
        alert('请至少选择1位主播');
        return;
      }
      const note = noteInput.value.trim();
      if (editShiftIdInput.value) {
        const id = Number(editShiftIdInput.value);
        State.updateShift(id, { anchorIds: ids, note });
      } else {
        State.addShift({ roomId: data.roomId, day: data.day, startSlot: data.startSlot, endSlot: data.endSlot, anchorIds: ids, note });
      }
      closeModal();
      renderGrid();
    };
  }

  function closeModal() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  // Initial render
  renderRoomSwitch();
  renderGrid();
})();
