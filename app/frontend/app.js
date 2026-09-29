const API_URL = 'http://127.0.0.1:8000';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { events: [], view: 'dash', filter: 'all', q: '' };

async function api(path, opt = {}) {
  const r = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) },
    ...opt
  });
  if (r.status === 204) return null;
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) {
    let m = d && d.detail;
    if (Array.isArray(m)) m = m.map(e => (e.loc.slice(-1)[0] + ': ' + e.msg).replace('Value error, ', '')).join(' | ');
    throw new Error(m || 'Não foi possível concluir a ação. Tente novamente.');
  }
  return d;
}
function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
}
const fmt = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const pctOf = e => Math.min(100, Math.round(e.registrations_count / e.capacity * 100));
const level = p => p >= 100 ? 'full' : p >= 75 ? 'mid' : '';
const isPast = e => new Date(e.ends_at) < Date.now();
const ic = d => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const IC = {
  cal: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  gauge: 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0',
  ticket: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM13 5v14',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
};
const mini = e => { const d = new Date(e.starts_at); return `<div class="mini g${e.id % 6}"><b>${d.getDate()}</b>${d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</div>`; };
function countUp() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.querySelectorAll('[data-n]').forEach(el => {
    const n = +el.dataset.n, s = el.dataset.s || '', t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))) + s; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

async function loadAll() {
  try {
    let all = [], skip = 0, rows;
    do { rows = await api(`/events?skip=${skip}&limit=100`); all = all.concat(rows); skip += 100; } while (rows.length === 100);
    state.events = all; render();
  } catch (e) { toast(e.message, true); }
}

function when(iso) {
  const days = Math.ceil((new Date(iso) - Date.now()) / 864e5);
  return days <= 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`;
}

function renderDash() {
  const ev = state.events, up = ev.filter(e => !isPast(e));
  const regs = ev.reduce((s, e) => s + e.registrations_count, 0);
  const upRegs = up.reduce((s, e) => s + e.registrations_count, 0);
  const upCap = up.reduce((s, e) => s + e.capacity, 0);
  const occ = upCap ? Math.round(upRegs / upCap * 100) : 0;
  const top = [...ev].sort((a, b) => b.registrations_count - a.registrations_count).slice(0, 7);
  const next = up.slice().sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 5);
  const alerts = up.filter(e => pctOf(e) >= 80).sort((a, b) => pctOf(b) - pctOf(a));
  $('#subtitle').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase()) + ' · visão geral dos seus eventos';
  $('#view').innerHTML = `
  <div class="kpis">
    <div class="kpi" style="--c:#3f51d9"><i class="ico">${ic(IC.cal)}</i><small>Eventos</small><b data-n="${ev.length}">${ev.length}</b><span>${up.length} ainda por acontecer</span></div>
    <div class="kpi" style="--c:#1f9d74"><i class="ico">${ic(IC.users)}</i><small>Inscrições</small><b data-n="${regs}">${regs}</b><span>em todos os eventos</span></div>
    <div class="kpi" style="--c:#d98a1f"><i class="ico">${ic(IC.gauge)}</i><small>Ocupação dos próximos</small><b data-n="${occ}" data-s="%">${occ}%</b><span>${upRegs} de ${upCap} vagas</span></div>
    <div class="kpi" style="--c:#8a5cf0"><i class="ico">${ic(IC.ticket)}</i><small>Vagas abertas</small><b data-n="${upCap - upRegs}">${upCap - upRegs}</b><span>nos próximos eventos</span></div>
  </div>
  <div class="dash">
    <div class="panel"><h2>Inscrições por evento</h2>
      ${top.length ? top.map(e => `<div class="hb"><span class="n" title="${esc(e.title)}">${esc(e.title)}</span>
        <div class="track"><div class="fill ${level(pctOf(e))}" style="width:${pctOf(e)}%"></div></div>
        <span class="v">${e.registrations_count}/${e.capacity}</span></div>`).join('') : '<p class="meta">Cadastre eventos para ver o gráfico.</p>'}
    </div>
    <div class="panel"><h2>Ocupação dos próximos eventos</h2>
      <div class="donut-w"><div class="donut" style="--p:${occ}"><div>${occ}%<small>ocupado</small></div></div>
      <div class="legend"><span><i class="dot"></i>${upRegs} inscritos</span><span><i class="dot g"></i>${upCap - upRegs} vagas livres</span></div></div>
    </div>
    <div class="panel"><h2>Próximos eventos</h2>
      ${next.length ? next.map(e => `<div class="row">${mini(e)}<div class="grow"><div class="t">${esc(e.title)}</div><div class="meta">${fmt(e.starts_at)} · ${esc(e.location)}</div></div>
        <span class="badge">${when(e.starts_at)}</span></div>`).join('') : '<p class="meta">Nenhum evento futuro. Crie um em “Novo evento”.</p>'}
    </div>
    <div class="panel"><h2>Atenção às vagas</h2>
      ${alerts.length ? alerts.map(e => `<div class="row"><div class="grow"><div class="t">${esc(e.title)}</div><div class="meta">${e.available_spots} vagas restantes</div></div>
        <span class="badge ${e.available_spots ? 'warn' : 'bad'}">${e.available_spots ? pctOf(e) + '% cheio' : 'Esgotado'}</span></div>`).join('') : '<p class="meta">Nenhum evento próximo de lotar.</p>'}
    </div>
  </div>`;
  countUp();
}

function renderEvents() {
  $('#subtitle').textContent = 'Crie, edite e gerencie as inscrições de cada evento.';
  const q = state.q.toLowerCase();
  const list = state.events.filter(e =>
    (state.filter === 'all' || (state.filter === 'up' ? !isPast(e) : isPast(e))) &&
    (!q || (e.title + ' ' + e.location).toLowerCase().includes(q)));
  const chip = (k, t) => `<button class="chip" data-filter="${k}" aria-pressed="${state.filter === k}">${t}</button>`;
  $('#view').innerHTML = `<div class="toolbar">${chip('all', 'Todos')}${chip('up', 'Próximos')}${chip('past', 'Encerrados')}
    <input class="search" id="q" type="search" placeholder="Buscar por título ou local" value="${esc(state.q)}"></div>
    <div class="grid">${list.length ? list.map(card).join('') :
    `<div class="panel empty" style="grid-column:1/-1"><h3>Nenhum evento encontrado</h3><p>Ajuste o filtro ou cadastre um novo evento.</p><button class="btn primary" data-act="new">Novo evento</button></div>`}</div>`;
  const qi = $('#q');
  qi.oninput = () => { state.q = qi.value; const pos = qi.selectionStart; renderEvents(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
}

function card(e) {
  const d = new Date(e.starts_at), past = isPast(e), p = pctOf(e);
  return `<article class="card ${past ? 'past' : ''}">
    <div class="card-main"><div class="stub g${e.id % 6}"><b>${d.getDate()}</b><span>${d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>
    <div><h3>${esc(e.title)}</h3><div class="meta ml">${ic(IC.clock)}${fmt(e.starts_at)}</div><div class="meta ml">${ic(IC.pin)}${esc(e.location)}</div></div></div>
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
    <div class="spots"><div class="spots-row"><span>${e.registrations_count} de ${e.capacity} inscritos</span>
      <span class="badge ${past ? '' : e.available_spots ? 'ok' : 'bad'}">${past ? 'Encerrado' : e.available_spots ? e.available_spots + ' vagas' : 'Esgotado'}</span></div>
      <div class="track"><div class="fill ${level(p)}" style="width:${p}%"></div></div></div>
    <div class="actions"><button class="btn primary sm grow" data-act="regs" data-id="${e.id}">Inscrições</button>
      <button class="btn sm" data-act="edit" data-id="${e.id}">Editar</button>
      <button class="btn sm danger" data-act="del" data-id="${e.id}">Excluir</button></div></article>`;
}

function render() {
  $('#title').textContent = state.view === 'dash' ? 'Painel' : 'Eventos';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('on', n.dataset.view === state.view));
  state.view === 'dash' ? renderDash() : renderEvents();
}

const dlg = $('#dlg');
const openDlg = html => { $('#dlg-body').innerHTML = html; if (!dlg.open) dlg.showModal(); };
const closeDlg = () => dlg.close();
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
const head = t => `<div class="dlg-h"><h2>${t}</h2><button class="x" type="button" data-close aria-label="Fechar">×</button></div>`;

function eventForm(ev) {
  const v = ev || {};
  openDlg(`${head(ev ? 'Editar evento' : 'Novo evento')}
  <form id="ef"><div id="ferr"></div>
    <label>Título<input name="title" required minlength="3" maxlength="150" value="${esc(v.title)}"></label>
    <label>Descrição (opcional)<textarea name="description">${esc(v.description)}</textarea></label>
    <label>Local<input name="location" required minlength="2" maxlength="200" value="${esc(v.location)}"></label>
    <div class="two"><label>Início<input type="datetime-local" name="starts_at" required value="${v.starts_at ? toLocalInput(v.starts_at) : ''}"></label>
    <label>Término<input type="datetime-local" name="ends_at" required value="${v.ends_at ? toLocalInput(v.ends_at) : ''}"></label></div>
    <label>Capacidade<input type="number" name="capacity" min="1" required value="${v.capacity ?? ''}"></label>
    <div class="foot"><button class="btn" type="button" data-close>Cancelar</button><button class="btn primary" type="submit">${ev ? 'Salvar alterações' : 'Criar evento'}</button></div>
  </form>`);
  $('#ef').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.submitter; btn.disabled = true;
    const body = { title: f.get('title').trim(), description: f.get('description').trim() || null, location: f.get('location').trim(),
      starts_at: new Date(f.get('starts_at')).toISOString(), ends_at: new Date(f.get('ends_at')).toISOString(), capacity: +f.get('capacity') };
    try {
      await api(ev ? `/events/${ev.id}` : '/events', { method: ev ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      closeDlg(); toast(ev ? 'Alterações salvas.' : 'Evento criado.'); loadAll();
    } catch (er) { $('#ferr').innerHTML = `<div class="err">${esc(er.message)}</div>`; btn.disabled = false; }
  };
}

async function regsDialog(id) {
  try {
    const [ev, regs] = await Promise.all([api(`/events/${id}`), api(`/events/${id}/registrations?limit=100`)]);
    openDlg(`${head(esc(ev.title))}
      <div class="meta" style="margin:-6px 0 8px">${ev.registrations_count} de ${ev.capacity} inscritos · ${fmt(ev.starts_at)}</div>
      <div id="rerr"></div>
      ${new Date(ev.ends_at) < Date.now() ? '<div class="err">Este evento já foi encerrado. Novas inscrições estão bloqueadas.</div>' : `
      <form id="rf" class="reg-form"><label>Nome<input name="name" required minlength="2" maxlength="120"></label>
        <label>E-mail<input type="email" name="email" required></label><button class="btn primary" type="submit">Inscrever</button></form>`}
      <div>${regs.length ? regs.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.name)}</div><div class="meta">${esc(r.email)}</div></div>
        <button class="btn sm danger" data-cancel="${r.id}">Cancelar</button></div>`).join('') : '<p class="meta" style="padding:12px 0">Ainda não há inscritos neste evento.</p>'}</div>`);
    const rf = $('#rf');
    if (rf) rf.onsubmit = async e => {
      e.preventDefault(); const f = new FormData(rf), btn = e.submitter; btn.disabled = true;
      try {
        await api(`/events/${id}/registrations`, { method: 'POST', body: JSON.stringify({ name: f.get('name'), email: f.get('email') }) });
        toast('Inscrição confirmada.'); loadAll(); regsDialog(id);
      } catch (er) { $('#rerr').innerHTML = `<div class="err">${esc(er.message)}</div>`; btn.disabled = false; }
    };
    $('#dlg-body').onclick = async e => {
      if (e.target.closest('[data-close]')) return closeDlg();
      const b = e.target.closest('[data-cancel]');
      if (b && confirm('Cancelar esta inscrição?')) {
        try { await api(`/registrations/${b.dataset.cancel}`, { method: 'DELETE' }); toast('Inscrição cancelada.'); loadAll(); regsDialog(id); }
        catch (er) { toast(er.message, true); }
      }
    };
  } catch (e) { toast(e.message, true); }
}

document.addEventListener('click', async e => {
  if (e.target.closest('[data-close]')) return closeDlg();
  const nav = e.target.closest('[data-view]');
  if (nav) { state.view = nav.dataset.view; return render(); }
  const ch = e.target.closest('[data-filter]');
  if (ch) { state.filter = ch.dataset.filter; return renderEvents(); }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = +b.dataset.id, ev = state.events.find(x => x.id === id);
  if (b.dataset.act === 'new') eventForm();
  if (b.dataset.act === 'edit') eventForm(ev);
  if (b.dataset.act === 'regs') regsDialog(id);
  if (b.dataset.act === 'del' && confirm(`Excluir "${ev.title}" e todas as inscrições?`)) {
    try { await api(`/events/${id}`, { method: 'DELETE' }); toast('Evento excluído.'); loadAll(); } catch (er) { toast(er.message, true); }
  }
});
$('#new').onclick = () => eventForm();
$('#view').innerHTML = '<div class="kpis">' + '<div class="kpi sk"></div>'.repeat(4) + '</div><div class="dash">' + '<div class="panel sk tall"></div>'.repeat(2) + '</div>';
loadAll();