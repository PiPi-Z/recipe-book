/* ============================================
   甜心小厨 · 数据存储层（IndexedDB）
   - 菜谱数据 + 本地图片（压缩后 dataURL）
   - 不依赖网络，数据留在各自设备浏览器
   ============================================ */
(function (global) {
  'use strict';

  const DB_NAME = 'sweetheart-kitchen';
  const DB_VER = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('recipes')) {
          const s = d.createObjectStore('recipes', { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!d.objectStoreNames.contains('categories')) {
          d.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('meta')) {
          d.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  function tx(store, mode, fn) {
    return open().then(d => new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      const req = fn(s);
      if (req) {
        req.onsuccess = () => { result = req.result; };
        req.onerror = () => reject(req.error);
      }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
    }));
  }

  const u = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- 默认分类 ---------- */
  const DEFAULT_CATS = [
    // 菜系
    { id: 'cuisine_中餐', type: 'cuisine', name: '中餐' },
    { id: 'cuisine_西餐', type: 'cuisine', name: '西餐' },
    { id: 'cuisine_日料', type: 'cuisine', name: '日料' },
    { id: 'cuisine_甜品', type: 'cuisine', name: '甜品烘焙' },
    { id: 'cuisine_饮品', type: 'cuisine', name: '饮品' },
    // 烹饪方式
    { id: 'method_炒', type: 'method', name: '炒' },
    { id: 'method_蒸', type: 'method', name: '蒸' },
    { id: 'method_煮', type: 'method', name: '煮' },
    { id: 'method_炖', type: 'method', name: '炖' },
    { id: 'method_烤', type: 'method', name: '烤' },
    { id: 'method_凉拌', type: 'method', name: '凉拌' },
    { id: 'method_煎', type: 'method', name: '煎' },
    // 烹饪工具
    { id: 'tool_炒锅', type: 'tool', name: '炒锅' },
    { id: 'tool_电饭煲', type: 'tool', name: '电饭煲' },
    { id: 'tool_烤箱', type: 'tool', name: '烤箱' },
    { id: 'tool_空气炸锅', type: 'tool', name: '空气炸锅' },
    { id: 'tool_蒸锅', type: 'tool', name: '蒸锅' },
    // 场合
    { id: 'occasion_日常', type: 'occasion', name: '日常' },
    { id: 'occasion_早餐', type: 'occasion', name: '早餐' },
    { id: 'occasion_聚会', type: 'occasion', name: '聚会' },
    { id: 'occasion_节日', type: 'occasion', name: '节日' },
    { id: 'occasion_宵夜', type: 'occasion', name: '宵夜' },
    // 标签
    { id: 'tag_快手', type: 'tag', name: '快手' },
    { id: 'tag_低脂', type: 'tag', name: '低脂' },
    { id: 'tag_家常', type: 'tag', name: '家常' },
    { id: 'tag_下饭', type: 'tag', name: '下饭' },
    { id: 'tag_颜值', type: 'tag', name: '高颜值' },
  ];

  async function ensureDefaults() {
    const all = await listCategories();
    if (all.length) return;
    for (const c of DEFAULT_CATS) await tx('categories', 'readwrite', s => s.put(c));
  }

  /* ---------- 分类 ---------- */
  function listCategories() {
    return tx('categories', 'readonly', s => s.getAll()).then(r => r || []);
  }
  function putCategory(c) {
    if (!c.id) c.id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return tx('categories', 'readwrite', s => s.put(c)).then(() => c);
  }
  function delCategory(id) {
    return tx('categories', 'readwrite', s => s.delete(id));
  }

  /* ---------- 菜谱 ---------- */
  function listRecipes() {
    return tx('recipes', 'readonly', s => s.getAll()).then(r => (r || []).sort((a, b) => b.createdAt - a.createdAt));
  }
  function getRecipe(id) {
    return tx('recipes', 'readonly', s => s.get(id));
  }
  function putRecipe(r) {
    if (!r.id) r.id = u();
    const now = Date.now();
    if (!r.createdAt) r.createdAt = now;
    r.updatedAt = now;
    return tx('recipes', 'readwrite', s => s.put(r)).then(() => r);
  }
  function delRecipe(id) {
    return tx('recipes', 'readwrite', s => s.delete(id));
  }

  /* ---------- meta（如上次解锁时间） ---------- */
  function getMeta(key) { return tx('meta', 'readonly', s => s.get(key)); }
  function setMeta(key, value) { return tx('meta', 'readwrite', s => s.put({ key, value })); }

  /* ---------- 图片压缩：Canvas 缩放到最大边 1280，JPEG 0.82 ---------- */
  function compressImage(file, maxSide = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片格式不支持'));
        img.onload = () => {
          let { width: w, height: h } = img;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try { resolve(cv.toDataURL('image/jpeg', quality)); }
          catch (err) { reject(err); }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  global.Store = {
    open, ensureDefaults,
    listCategories, putCategory, delCategory,
    listRecipes, getRecipe, putRecipe, delRecipe,
    getMeta, setMeta, compressImage,
    DEFAULT_CATS
  };
})(window);
