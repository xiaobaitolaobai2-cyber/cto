// 通用 UI 与工具函数

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset' && v && typeof v === 'object') Object.assign(node.dataset, v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export const dayNames = ['周一','周二','周三','周四','周五','周六','周日'];

export function setActiveTab(route) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => {
    const r = t.getAttribute('data-route');
    if (r === route) t.classList.add('active');
    else t.classList.remove('active');
  });
}

export function pad2(n) { return String(n).padStart(2, '0'); }
export function formatTime(h, m) { return `${pad2(h)}:${pad2(m)}`; }
