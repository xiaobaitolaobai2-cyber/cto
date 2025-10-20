(function(){
  const anchors = [
    { id: 'a1', name: '小李' },
    { id: 'a2', name: '小王' },
    { id: 'a3', name: '小张' },
    { id: 'a4', name: '小刘' },
    { id: 'a5', name: '可可' },
    { id: 'a6', name: 'Momo' },
  ];

  const rooms = [
    { id: 1, name: '直播间1' },
    { id: 2, name: '直播间2' },
    { id: 3, name: '直播间3' },
  ];

  /** @type {Array<{id:number, roomId:number, day:number, startSlot:number, endSlot:number, anchorIds:string[], note?:string}>} */
  const shifts = [];

  let _nextId = 1;

  function addShift(shift) {
    const item = { ...shift, id: _nextId++ };
    shifts.push(item);
    return item;
  }

  function updateShift(id, patch) {
    const idx = shifts.findIndex(s => s.id === id);
    if (idx >= 0) {
      shifts[idx] = { ...shifts[idx], ...patch };
      return shifts[idx];
    }
    return null;
  }

  function removeShift(id) {
    const idx = shifts.findIndex(s => s.id === id);
    if (idx >= 0) shifts.splice(idx, 1);
  }

  window.State = {
    anchors,
    rooms,
    shifts,
    addShift,
    updateShift,
    removeShift,
  };
})();
