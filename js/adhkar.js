/* ═══════════════ الأذكار — حصن المسلم ═══════════════ */
const Adhkar = (function () {
  let DATA = null, curCat = null;
  const FAVS = [1, 2, 3, 27, 129, 130, 13, 96];       // أبواب يكثر استخدامها
  const ICONS = { 1: 'ص', 2: 'م', 3: 'ي', 27: 'صـ', 129: 'د', 130: 'ذ', 13: 'أ', 96: 'س' };
  const RESET_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v6h6M5.6 15.5A8 8 0 1 0 6 7.3L4 10"/></svg>';

  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const strip = t => t.replace(/[ً-ْٰـ]/g, '').replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  async function load() {
    if (DATA) return DATA;
    const res = await fetch('data/adhkar.json');
    if (!res.ok) throw new Error('تعذّر تحميل الأذكار');
    DATA = await res.json();
    return DATA;
  }

  /** الأدعية التي يكتبها المستخدم — باب افتراضي رقمه ٠ */
  function myDuas() {
    return { id: 0, cat: 'أدعيتي', custom: true,
             items: (Store.s.customDuas || []).map(d => ({ t: d.text, c: d.count || 1, title: d.title })) };
  }
  const allCats = () => [myDuas(), ...DATA];

  function renderIndex() {
    const mine = myDuas();
    $('#favStrip').innerHTML =
      `<button class="fav mine" data-cat="0"><b>دع</b><span>أدعيتي${mine.items.length ? ` (${toAr(mine.items.length)})` : ''}</span></button>`
      + FAVS.slice(0, 7).map(id => {
          const c = DATA.find(x => x.id === id); if (!c) return '';
          return `<button class="fav" data-cat="${id}"><b>${ICONS[id] || 'ذ'}</b><span>${c.cat}</span></button>`;
        }).join('');
    list(allCats());
  }

  function list(items) {
    $('#adhkarList').innerHTML = items.length ? items.map(c => `
      <button class="cat-item" data-cat="${c.id}">
        <span class="info"><b>${c.cat}</b><small>${toAr(c.items.length)} ${c.items.length === 1 ? 'ذكر' : 'أذكار'}</small></span>
        <span class="chev">‹</span>
      </button>`).join('') : `<p class="empty">لا توجد نتائج</p>`;
  }

  function search(q) {
    const qq = strip(q.trim());
    if (qq.length < 2) return list(allCats());
    list(allCats().filter(c => strip(c.cat).includes(qq) || c.items.some(i => strip(i.t).includes(qq))));
  }

  const progKey = id => 'c' + id;
  function getProg(id) { return Store.s.adhkarProgress[progKey(id)] || {}; }
  function setProg(id, p) { Store.s.adhkarProgress[progKey(id)] = p; Store.save(); }

  function open(id) {
    curCat = id === 0 ? myDuas() : DATA.find(c => c.id === id);
    if (!curCat) return;
    if (window.Nav) Nav.enter();
    $('#adhkarIndex').classList.add('hidden');
    $('#adhkarView').classList.remove('hidden');
    $('#adTitle').textContent = curCat.cat;
    renderItems();
    $('#adhkarItems').scrollTop = 0;
  }

  function renderItems() {
    const p = getProg(curCat.id);
    $('#adhkarItems').innerHTML = curCat.items.map((it, i) => {
      const done = p[i] || 0, left = Math.max(0, it.c - done), fin = left === 0;
      return `<div class="dhikr ${fin ? 'done' : ''}" data-i="${i}">
        ${it.title ? `<h4 class="dtitle">${esc(it.title)}</h4>` : ''}
        <p class="dtext">${esc(it.t)}</p>
        <div class="dfoot">
          <button class="dcount" data-i="${i}">${fin ? '✓ تم' : `${toAr(left)} / ${toAr(it.c)}`}</button>
          <div class="dacts">
            ${curCat.custom ? `<button class="mini" data-edit="${i}" aria-label="تعديل الدعاء">حرّر</button>` : ''}
            <button class="mini" data-copy="${i}" aria-label="نسخ الذكر">نسخ</button>
            <button class="mini icon-only" data-reset="${i}" aria-label="إعادة عدّ الذكر">${RESET_ICON}</button>
          </div>
        </div>
      </div>`;
    }).join('')
      + (curCat.custom && !curCat.items.length
          ? `<p class="empty">لا توجد أدعية بعد.<br>اضغط «إضافة دعاء» لتكتب دعاءك الخاص.</p>`
          : `<div class="dhikr-end">تقبّل الله منك</div>`);
    $('#btnAddDua').classList.toggle('hidden', !curCat.custom);
    updateProgress();
  }

  function updateProgress() {
    const p = getProg(curCat.id);
    const done = curCat.items.filter((it, i) => (p[i] || 0) >= it.c).length;
    $('#adProgress').textContent = `${toAr(done)} من ${toAr(curCat.items.length)} مكتملة`;
  }

  function tap(i) {
    const p = getProg(curCat.id), it = curCat.items[i];
    const now = Math.min(it.c, (p[i] || 0) + 1);
    p[i] = now; setProg(curCat.id, p);
    const card = $(`.dhikr[data-i="${i}"]`), btn = $(`.dcount[data-i="${i}"]`);
    const left = it.c - now;
    btn.textContent = left === 0 ? '✓ تم' : `${toAr(left)} / ${toAr(it.c)}`;
    btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
    vibrate(left === 0 ? [30, 40, 30] : 18);
    if (left === 0) {
      card.classList.add('done');
      const next = card.nextElementSibling;
      if (next && !next.classList.contains('done')) setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'center' }), 260);
    }
    updateProgress();
  }

  function bind() {
    $('#adhkarIndex').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]');
      if (b) open(+b.dataset.cat);
    });
    $('#adhkarSearch').addEventListener('input', e => search(e.target.value));
    $('#btnBackAdhkar').addEventListener('click', () => (window.Nav ? Nav.exit(back) : back()));
    $('#btnResetAdhkar').addEventListener('click', () => { setProg(curCat.id, {}); renderItems(); toast('تمت إعادة العدّ'); });
    $('#adhkarItems').addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]');
      if (ed) { editDua(+ed.dataset.edit); return; }
      const c = e.target.closest('[data-copy]');
      if (c) { try { await navigator.clipboard.writeText(curCat.items[+c.dataset.copy].t); toast('تم النسخ'); } catch (_) {} return; }
      const r = e.target.closest('[data-reset]');
      if (r) { const p = getProg(curCat.id); p[+r.dataset.reset] = 0; setProg(curCat.id, p); renderItems(); return; }
      const d = e.target.closest('.dhikr');
      if (d) tap(+d.dataset.i);
    });

    $('#btnAddDua').addEventListener('click', () => editDua(-1));
    $('#btnCancelDua').addEventListener('click', closeEditor);
    $('#btnSaveDua').addEventListener('click', saveDua);
    $('#btnSaveDua2').addEventListener('click', saveDua);
    $('#btnDeleteDua').addEventListener('click', deleteDua);
  }

  /* ───────── محرّر الأدعية المخصصة ───────── */
  let editIdx = -1;

  function editDua(i) {
    editIdx = i;
    const d = i >= 0 ? (Store.s.customDuas || [])[i] : null;
    $('#duaEditorTitle').textContent = d ? 'تعديل الدعاء' : 'دعاء جديد';
    $('#duaTitle').value = d ? (d.title || '') : '';
    $('#duaText').value = d ? d.text : '';
    $('#duaCount').value = String(d ? (d.count || 1) : 1);
    $('#btnDeleteDua').classList.toggle('hidden', !d);
    $('#adhkarView').classList.add('hidden');
    $('#duaEditor').classList.remove('hidden');
    setTimeout(() => $('#duaText').focus(), 80);
  }

  function closeEditor() {
    $('#duaEditor').classList.add('hidden');
    $('#adhkarView').classList.remove('hidden');
  }

  function saveDua() {
    const text = $('#duaText').value.trim();
    if (!text) { toast('اكتب نصّ الدعاء أولاً'); $('#duaText').focus(); return; }
    const list = (Store.s.customDuas || []).slice();
    const item = { title: $('#duaTitle').value.trim(), text, count: +$('#duaCount').value || 1 };
    if (editIdx >= 0) list[editIdx] = item; else list.push(item);
    Store.set('customDuas', list);
    Notify.syncWidget();
    closeEditor(); curCat = myDuas(); renderItems(); renderIndex();
    toast(editIdx >= 0 ? 'تم حفظ التعديل' : 'أُضيف الدعاء');
  }

  function deleteDua() {
    if (editIdx < 0 || !confirm('حذف هذا الدعاء نهائياً؟')) return;
    const list = (Store.s.customDuas || []).slice();
    list.splice(editIdx, 1);
    Store.set('customDuas', list);
    // إزاحة عدّادات التقدّم بعد الحذف
    const p = getProg(0), np = {};
    Object.keys(p).forEach(k => { const n = +k; if (n < editIdx) np[n] = p[k]; else if (n > editIdx) np[n - 1] = p[k]; });
    setProg(0, np);
    Notify.syncWidget();
    closeEditor(); curCat = myDuas(); renderItems(); renderIndex();
    toast('حُذف الدعاء');
  }

  function back() {
    $('#duaEditor').classList.add('hidden');
    $('#adhkarView').classList.add('hidden'); $('#adhkarIndex').classList.remove('hidden');
  }

  return { load, renderIndex, bind, open, back, get isOpen() { return !$('#adhkarView').classList.contains('hidden') || !$('#duaEditor').classList.contains('hidden'); } };
})();
