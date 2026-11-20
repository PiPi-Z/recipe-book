/* ============================================
   甜心小厨 · 应用逻辑
   ============================================ */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const PASSWORD = '092878';
  const CAT_TYPES = {
    cuisine: { name: '菜系', emoji: '🍜' },
    method: { name: '烹饪方式', emoji: '🔥' },
    tool: { name: '烹饪工具', emoji: '🍳' },
    occasion: { name: '适用场合', emoji: '🎉' },
    tag: { name: '标签', emoji: '🏷️' }
  };

  const S = {
    recipes: [], cats: [],
    filter: 'all', filterDim: 'cuisine', filterOpen: false,
    keyword: '',
    editingId: null,
    cover: '',
    unlocked: false
  };

  /* ---------- 工具 ---------- */
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }
  function timeText(min) {
    if (!min) return '—';
    min = Number(min);
    if (min < 60) return min + ' 分钟';
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
  }
  function view(name) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view' + name[0].toUpperCase() + name.slice(1)).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setNav(id) {
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    if (id) $(id).classList.add('active');
  }

  /* ---------- 密码锁 ---------- */
  let pin = '';
  function initLock() {
    // 键盘/点击监听始终绑定（即使本次会话已解锁，之后手动锁定还能再次解锁）
    $('#pinPad').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'clear') pin = '';
      else if (k === 'del') pin = pin.slice(0, -1);
      else if (/^\d$/.test(k) && pin.length < 6) pin += k;
      renderPin();
      if (pin.length === 6) setTimeout(checkPin, 150);
    });
    document.addEventListener('keydown', e => {
      if (!$('#lockScreen').classList.contains('show')) return;
      if (/^\d$/.test(e.key) && pin.length < 6) { pin += e.key; renderPin(); if (pin.length === 6) setTimeout(checkPin, 150); }
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); renderPin(); }
    });
    // 同一会话内已解锁则直接进入（刷新免输入）
    if (sessionStorage.getItem('ck_unlocked') === '1') {
      unlock(); return;
    }
    $('#lockScreen').classList.add('show');
  }
  function renderPin() {
    $$('#pinDots span').forEach((d, i) => d.classList.toggle('filled', i < pin.length));
  }
  function checkPin() {
    if (pin === PASSWORD) {
      sessionStorage.setItem('ck_unlocked', '1');
      unlock();
    } else {
      $('#lockScreen').classList.add('shake');
      $('#lockError').classList.add('show');
      setTimeout(() => {
        pin = ''; renderPin();
        $('#lockScreen').classList.remove('shake');
        $('#lockError').classList.remove('show');
      }, 700);
    }
  }
  function unlock() {
    S.unlocked = true;
    $('#lockScreen').classList.remove('show');
    $('#app').style.display = '';
    refreshAll();
  }
  function lock() {
    sessionStorage.removeItem('ck_unlocked');
    pin = ''; renderPin();
    $('#app').style.display = 'none';
    $('#lockScreen').classList.add('show');
  }

  /* ---------- 数据加载 ---------- */
  async function refreshAll() {
    await Store.ensureDefaults();
    const [r, c] = await Promise.all([Store.listRecipes(), Store.listCategories()]);
    S.recipes = r; S.cats = c;
    updateCount();
    renderFilterGroups();
    renderList();
  }
  function updateCount() {
    $('#recipeCount').textContent = `共 ${S.recipes.length} 道美味`;
  }

  /* ---------- 筛选栏 ---------- */
  function renderFilterGroups() {
    // 快捷按钮
    $$('.quick-filter .fchip').forEach(b => {
      b.onclick = () => setFilter(b.dataset.filter);
      b.classList.toggle('active', S.filter === b.dataset.filter);
    });
    // 筛选徽标
    const active = S.filter !== 'all' && S.filter !== 'fav';
    $('#filterBadge').textContent = active ? '· 1' : '';
    $('#filterToggle').classList.toggle('has-filter', active);
    // 维度 tabs
    const tabs = $('#filterDimTabs');
    tabs.innerHTML = Object.keys(CAT_TYPES).map(type =>
      `<button class="dim-tab ${S.filterDim === type ? 'active' : ''}" data-dim="${type}">${CAT_TYPES[type].emoji} ${CAT_TYPES[type].name}</button>`
    ).join('');
    $$('.dim-tab', tabs).forEach(b => b.onclick = () => { S.filterDim = b.dataset.dim; renderFilterGroups(); });
    // 当前维度的选项
    const cats = S.cats.filter(c => c.type === S.filterDim);
    const opts = $('#filterOptions');
    opts.innerHTML = `<button class="opt-chip ${S.filter === 'all' ? 'active' : ''}" data-filter="all">不限</button>` +
      cats.map(c => {
        const key = S.filterDim + ':' + c.name;
        return `<button class="opt-chip ${S.filter === key ? 'active' : ''}" data-filter="${esc(key)}">${esc(c.name)}</button>`;
      }).join('');
    $$('.opt-chip', opts).forEach(b => b.onclick = () => setFilter(b.dataset.filter));
    // 面板展开状态
    $('#filterPanel').classList.toggle('open', S.filterOpen);
  }
  function setFilter(f) {
    S.filter = f;
    if (f === 'all' || f === 'fav') { /* 保持快捷按钮切换 */ }
    renderFilterGroups(); renderList();
  }
  function matchFilter(r) {
    if (S.filter === 'all') return true;
    if (S.filter === 'fav') return !!r.favorite;
    const [type, val] = S.filter.split(':');
    if (type === 'tag') return (r.tags || []).includes(val);
    return r[type] === val;
  }
  function matchSearch(r) {
    if (!S.keyword) return true;
    const k = S.keyword.toLowerCase();
    const hay = [r.name, r.note, r.cuisine, r.method, r.tool, r.occasion,
      ...(r.tags || []), ...(r.tools || []),
      ...((r.ingredients || []).map(i => i.name)),
      ...((r.steps || []).map(s => s.text))].join(' ').toLowerCase();
    return hay.includes(k);
  }

  /* ---------- 菜谱列表 ---------- */
  function renderList() {
    const list = S.recipes.filter(r => matchFilter(r) && matchSearch(r));
    const grid = $('#recipeGrid');
    $('#emptyState').style.display = list.length ? 'none' : 'flex';
    if (!list.length) {
      if (S.keyword) { $('#emptyTitle').textContent = '没找到相关菜谱'; $('#emptyDesc').textContent = '换个关键词试试吧～'; }
      else if (S.filter !== 'all') { $('#emptyTitle').textContent = '这里还没有菜谱'; $('#emptyDesc').textContent = '这个分类下暂时空空的'; }
      else { $('#emptyTitle').textContent = '还没有菜谱呢'; $('#emptyDesc').textContent = '点右下角的 ＋ 添加第一道美味吧'; }
      grid.innerHTML = ''; return;
    }
    grid.innerHTML = list.map((r, i) => `
      <article class="recipe-card" data-id="${r.id}" style="--rot:${(i % 3 - 1) * 1.2}deg;animation-delay:${Math.min(i, 12) * 45}ms">
        <div class="tape"></div>
        <div class="rc-photo">
          ${r.cover ? `<img src="${r.cover}" alt="${esc(r.name)}" loading="lazy">` : `<div class="rc-noimg">🍽️</div>`}
          ${r.favorite ? '<span class="rc-fav">♥</span>' : ''}
        </div>
        <div class="rc-info">
          <h3>${esc(r.name)}</h3>
          <div class="rc-meta">
            <span>⏱ ${timeText(r.cookTime)}</span>
            ${r.cuisine ? `<span>· ${esc(r.cuisine)}</span>` : ''}
          </div>
          <div class="rc-tags">${(r.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        </div>
      </article>`).join('');
    $$('.recipe-card', grid).forEach(card => card.onclick = () => openDetail(card.dataset.id));
  }

  /* ---------- 详情 ---------- */
  function openDetail(id) {
    const r = S.recipes.find(x => x.id === id); if (!r) return;
    $('#detailHero').innerHTML = `
      <button class="detail-back" id="detailBack">‹</button>
      <button class="detail-fav ${r.favorite ? 'on' : ''}" id="detailFav">${r.favorite ? '♥' : '♡'}</button>
      ${r.cover ? `<img src="${r.cover}" alt="${esc(r.name)}">` : `<div class="detail-noimg">🍽️</div>`}
      <div class="detail-hero-cap"><h1>${esc(r.name)}</h1></div>`;
    const catLine = [['菜系', r.cuisine], ['方式', r.method], ['工具', r.tool], ['场合', r.occasion]]
      .filter(x => x[1]).map(x => `<span class="dc-chip"><small>${x[0]}</small>${esc(x[1])}</span>`).join('');
    $('#detailBody').innerHTML = `
      <div class="detail-quick">
        <div><span class="q-ico">⏱️</span><b>${timeText(r.cookTime)}</b><small>烹饪时间</small></div>
        <div><span class="q-ico">🍴</span><b>${esc(r.serving || '—')}</b><small>份量</small></div>
        <div><span class="q-ico">🥄</span><b>${(r.tools || []).length || '—'}</b><small>厨具</small></div>
      </div>
      ${catLine ? `<div class="detail-cats">${catLine}</div>` : ''}
      ${(r.tags || []).length ? `<div class="detail-tags">${r.tags.map(t => `<span class="tag"># ${esc(t)}</span>`).join('')}</div>` : ''}
      ${(r.tools || []).length ? `<section class="detail-sec"><h2><span>🥣</span> 所需厨具</h2><div class="tools-list">${r.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${(r.ingredients || []).length ? `<section class="detail-sec"><h2><span>🧺</span> 食材清单</h2><ul class="ing-list">${r.ingredients.map(i => `<li><span class="ing-dot"></span><span class="ing-name">${esc(i.name)}</span><span class="ing-amt">${esc(i.amount)}</span></li>`).join('')}</ul></section>` : ''}
      ${(r.steps || []).length ? `<section class="detail-sec"><h2><span>👩‍🍳</span> 烹饪步骤</h2><ol class="step-view">${r.steps.map((s, i) => `<li><span class="step-num">${i + 1}</span><div><p>${esc(s.text)}</p>${s.tip ? `<small>💡 ${esc(s.tip)}</small>` : ''}</div></li>`).join('')}</ol></section>` : ''}
      ${r.note ? `<section class="detail-sec"><h2><span>💌</span> 小贴士</h2><div class="note-box">${esc(r.note)}</div></section>` : ''}
      <div class="detail-foot">
        <button class="btn-edit" id="detailEdit">✎ 编辑菜谱</button>
        <button class="btn-del" id="detailDel">🗑 删除</button>
      </div>
      <p class="detail-date">记录于 ${fmtDate(r.createdAt)}</p>`;
    view('Detail'); setNav(null);
    $('#detailBack').onclick = () => { view('List'); setNav('#navList'); };
    $('#detailFav').onclick = async () => {
      r.favorite = !r.favorite; await Store.putRecipe(r);
      S.recipes = await Store.listRecipes();
      $('#detailFav').className = 'detail-fav ' + (r.favorite ? 'on' : '');
      $('#detailFav').textContent = r.favorite ? '♥' : '♡';
      renderList(); toast(r.favorite ? '已加入收藏 ♥' : '已取消收藏');
    };
    $('#detailEdit').onclick = () => openEdit(r.id);
    $('#detailDel').onclick = () => confirmDelete(r);
  }

  function confirmDelete(r) {
    $('#confirmTitle').textContent = `确定删除「${r.name}」吗？`;
    $('#confirmModal').classList.add('show');
    $('#confirmNo').onclick = () => $('#confirmModal').classList.remove('show');
    $('#confirmYes').onclick = async () => {
      await Store.delRecipe(r.id);
      $('#confirmModal').classList.remove('show');
      S.recipes = await Store.listRecipes();
      updateCount(); renderList(); view('List'); setNav('#navList');
      toast('菜谱已删除');
    };
  }

  /* ---------- 新增 / 编辑 ---------- */
  function openEdit(id) {
    S.editingId = id || null;
    const r = id ? S.recipes.find(x => x.id === id) : null;
    $('#editTitle').textContent = r ? '编辑菜谱' : '新增菜谱';
    // 填字段
    $('#fName').value = r ? r.name : '';
    $('#fTime').value = r ? (r.cookTime || '') : '';
    $('#fServing').value = r ? (r.serving || '') : '';
    $('#fTools').value = r ? (r.tools || []).join('、') : '';
    $('#fTags').value = r ? (r.tags || []).join(',') : '';
    $('#fNote').value = r ? (r.note || '') : '';
    S.cover = r ? (r.cover || '') : '';
    renderCover();
    // 食材 / 步骤
    renderIngredientInputs(r ? r.ingredients : null);
    renderStepInputs(r ? r.steps : null);
    // 分类选择
    renderSelectGroups(r);
    view('Edit'); setNav(null);
  }
  function renderCover() {
    const img = $('#coverPreview'), ph = $('#coverPlaceholder'), ch = $('#coverChange');
    if (S.cover) { img.src = S.cover; img.style.display = 'block'; ph.style.display = 'none'; ch.style.display = 'block'; }
    else { img.style.display = 'none'; ph.style.display = 'flex'; ch.style.display = 'none'; }
  }
  $('#coverUpload').addEventListener('click', e => { if (e.target.id !== 'coverChange') $('#coverInput').click(); });
  $('#coverChange').onclick = e => { e.stopPropagation(); $('#coverInput').click(); };
  $('#coverInput').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    toast('正在处理图片…');
    try { S.cover = await Store.compressImage(f); renderCover(); toast('图片已添加 ✓'); }
    catch (err) { toast('图片处理失败'); }
    e.target.value = '';
  };

  function renderIngredientInputs(items) {
    const list = $('#ingredientList');
    const arr = items && items.length ? items : [{ name: '', amount: '' }];
    list.innerHTML = arr.map((it, i) => ingredientRow(it, i)).join('');
    bindLineDeletes(list);
  }
  function ingredientRow(it, i) {
    return `<div class="line-row ing-row">
      <input class="ing-n" placeholder="食材名称" value="${esc(it.name)}">
      <input class="ing-a" placeholder="用量" value="${esc(it.amount)}">
      <button type="button" class="line-del" title="删除">✕</button>
    </div>`;
  }
  function renderStepInputs(items) {
    const list = $('#stepList');
    const arr = items && items.length ? items : [{ text: '', tip: '' }];
    list.innerHTML = arr.map((s, i) => stepRow(s, i)).join('');
    bindLineDeletes(list);
  }
  function stepRow(s, i) {
    return `<div class="line-row step-row">
      <span class="step-idx">${i + 1}</span>
      <div class="step-fields">
        <textarea class="step-t" rows="2" placeholder="描述这一步怎么做…">${esc(s.text)}</textarea>
        <input class="step-tip" placeholder="小贴士（选填）" value="${esc(s.tip)}">
      </div>
      <button type="button" class="line-del" title="删除">✕</button>
    </div>`;
  }
  function bindLineDeletes(list) {
    $$('.line-del', list).forEach(b => b.onclick = () => {
      b.closest('.line-row').remove();
      if (list.id === 'stepList') renumberSteps();
    });
  }
  function renumberSteps() {
    $$('#stepList .step-row').forEach((r, i) => $('.step-idx', r).textContent = i + 1);
  }
  $('#addIngredient').onclick = () => {
    $('#ingredientList').insertAdjacentHTML('beforeend', ingredientRow({ name: '', amount: '' }));
    bindLineDeletes($('#ingredientList'));
    $$('.ing-n', $('#ingredientList')).pop().focus();
  };
  $('#addStep').onclick = () => {
    $('#stepList').insertAdjacentHTML('beforeend', stepRow({ text: '', tip: '' }));
    bindLineDeletes($('#stepList')); renumberSteps();
    $$('.step-t', $('#stepList')).pop().focus();
  };

  function renderSelectGroups(r) {
    const box = $('#selectGroups'); box.innerHTML = '';
    ['cuisine', 'method', 'tool', 'occasion'].forEach(type => {
      const cats = S.cats.filter(c => c.type === type);
      if (!cats.length) return;
      const cur = r ? r[type] : '';
      const g = document.createElement('div');
      g.className = 'sel-group';
      g.innerHTML = `<div class="sel-title">${CAT_TYPES[type].emoji} ${CAT_TYPES[type].name}</div>
        <div class="sel-chips">${cats.map(c => `<button type="button" class="sel-chip ${cur === c.name ? 'on' : ''}" data-type="${type}" data-name="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>`;
      box.appendChild(g);
    });
    $$('.sel-chip', box).forEach(b => b.onclick = () => {
      const type = b.dataset.type;
      const wasOn = b.classList.contains('on');
      $$('.sel-chip[data-type="' + type + '"]', box).forEach(x => x.classList.remove('on'));
      if (!wasOn) b.classList.add('on');
    });
  }

  async function saveEdit() {
    const name = $('#fName').value.trim();
    if (!name) { toast('给菜谱起个名字吧～'); $('#fName').focus(); return; }
    const ingredients = $$('#ingredientList .ing-row').map(row => ({
      name: $('.ing-n', row).value.trim(), amount: $('.ing-a', row).value.trim()
    })).filter(x => x.name);
    const steps = $$('#stepList .step-row').map(row => ({
      text: $('.step-t', row).value.trim(), tip: $('.step-tip', row).value.trim()
    })).filter(x => x.text);
    const sel = {};
    $$('.sel-chip.on').forEach(b => { sel[b.dataset.type] = b.dataset.name; });
    const tags = $('#fTags').value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const old = S.editingId ? S.recipes.find(x => x.id === S.editingId) : {};
    const recipe = {
      ...old,
      name,
      cover: S.cover,
      cookTime: Number($('#fTime').value) || 0,
      serving: $('#fServing').value.trim(),
      tools: $('#fTools').value.split(/[、,，]/).map(s => s.trim()).filter(Boolean),
      ingredients, steps,
      cuisine: sel.cuisine || '', method: sel.method || '', tool: sel.tool || '', occasion: sel.occasion || '',
      tags, note: $('#fNote').value.trim()
    };
    await Store.putRecipe(recipe);
    S.recipes = await Store.listRecipes();
    updateCount(); renderList();
    view('List'); setNav('#navList');
    toast(S.editingId ? '修改已保存 ✓' : '菜谱添加成功 ✓');
    S.editingId = null;
  }
  $('#editSave').onclick = saveEdit;
  $('#editCancel').onclick = () => { view('List'); setNav('#navList'); };
  $('#addCharFake') && null;

  /* ---------- 分类管理 ---------- */
  function renderManage() {
    const box = $('#manageGroups'); box.innerHTML = '';
    Object.keys(CAT_TYPES).forEach(type => {
      const cats = S.cats.filter(c => c.type === type);
      const g = document.createElement('div');
      g.className = 'manage-card';
      g.innerHTML = `<div class="manage-title"><span>${CAT_TYPES[type].emoji} ${CAT_TYPES[type].name}</span>
        <button class="manage-add" data-type="${type}">＋ 添加</button></div>
        <div class="manage-items">${cats.map(c => `<span class="manage-item">${esc(c.name)}
          <button class="mi-del" data-id="${c.id}" title="删除">✕</button></span>`).join('') || '<small class="muted">暂无，点添加创建</small>'}</div>`;
      box.appendChild(g);
    });
    $$('.manage-add', box).forEach(b => b.onclick = () => openCatModal(b.dataset.type));
    $$('.mi-del', box).forEach(b => b.onclick = async () => {
      await Store.delCategory(b.dataset.id);
      S.cats = await Store.listCategories();
      renderManage(); renderFilterGroups();
      toast('已删除');
    });
  }
  function openCatModal(type) {
    $('#catModalTitle').textContent = '添加到「' + CAT_TYPES[type].name + '」';
    $('#catModal').classList.add('show');
    $('#catNameInput').value = '';
    setTimeout(() => $('#catNameInput').focus(), 100);
    const yes = $('#catModalYes'), no = $('#catModalNo');
    const submit = async () => {
      const name = $('#catNameInput').value.trim();
      if (!name) { toast('请输入名称'); return; }
      const exist = S.cats.some(c => c.type === type && c.name === name);
      if (exist) { toast('已经存在啦'); return; }
      await Store.putCategory({ id: 'cat_' + Date.now().toString(36), type, name });
      S.cats = await Store.listCategories();
      $('#catModal').classList.remove('show');
      renderManage(); renderFilterGroups();
      toast('添加成功 ✓');
    };
    yes.onclick = submit; no.onclick = () => $('#catModal').classList.remove('show');
    $('#catNameInput').onkeydown = e => { if (e.key === 'Enter') submit(); };
  }

  function renderCatTabs() {
    // 分类页入口由底部导航控制，此处无需额外 tab
  }

  /* ---------- 搜索 / 导航 ---------- */
  $('#filterToggle').onclick = () => { S.filterOpen = !S.filterOpen; renderFilterGroups(); };

  $('#searchInput').oninput = e => {
    S.keyword = e.target.value.trim();
    $('#searchClear').style.display = S.keyword ? 'block' : 'none';
    renderList();
  };
  $('#searchClear').onclick = () => {
    $('#searchInput').value = ''; S.keyword = '';
    $('#searchClear').style.display = 'none'; renderList();
  };
  $('#emptyAdd').onclick = () => openEdit();
  $('#navAdd').onclick = () => openEdit();
  $('#navList').onclick = () => { view('List'); setNav('#navList'); renderList(); };
  $('#navFav').onclick = () => { S.filter = 'fav'; view('List'); setNav('#navFav'); renderFilterGroups(); renderList(); };
  $('#navManage').onclick = () => { renderManage(); view('Manage'); setNav('#navManage'); };
  $('#navLock').onclick = lock;
  $('#lockBtn').onclick = lock;
  $$('[data-back="list"]').forEach(b => b.onclick = () => { view('List'); setNav('#navList'); });

  /* ---------- 图片查看 ---------- */
  window.viewImage = src => {
    $('#imgModalSrc').src = src;
    $('#imgModal').classList.add('show');
  };
  $('#imgModal').onclick = e => { if (e.target.id === 'imgModal') $('#imgModal').classList.remove('show'); };
  $('#imgModalClose').onclick = () => $('#imgModal').classList.remove('show');

  /* ---------- 启动 ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  initLock();
})();
