const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const state = { business: null, mode: 'login' };

async function api(path, opts = {}) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = opts.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method: opts.method || 'GET', headers, body });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    location.reload();
    return;
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- auth ----------
function applyMode() {
  const reg = state.mode === 'register';
  $$('.field-reg').forEach((el) => el.classList.toggle('hidden', !reg));
  $('#auth-submit').textContent = reg ? 'Create account' : 'Sign in';
  $('#auth-sub').textContent = reg
    ? 'Set up your business assistant in under a minute.'
    : 'Sign in to manage your support assistant.';
  $('#auth-toggle').textContent = reg ? 'Already have an account? Sign in' : 'Create an account';
  $('#auth-error').textContent = '';
}

$('#auth-toggle').onclick = () => {
  state.mode = state.mode === 'login' ? 'register' : 'login';
  applyMode();
};

$('#auth-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#auth-error').textContent = '';
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const data = await api(state.mode === 'register' ? '/auth/register' : '/auth/login', { method: 'POST', body });
    localStorage.setItem('token', data.token);
    e.target.reset();
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
};

$('#logout').onclick = () => {
  localStorage.removeItem('token');
  boot();
};

function showAuth() {
  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
  applyMode();
}

function showApp() {
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#biz-name').textContent = state.business.name;
}

async function boot() {
  if (!localStorage.getItem('token')) return showAuth();
  try {
    const { business } = await api('/auth/me');
    state.business = business;
    showApp();
    show('overview');
  } catch {
    localStorage.removeItem('token');
    showAuth();
  }
}

// ---------- navigation ----------
function show(view) {
  $$('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== view));
  const loaders = { overview: loadOverview, documents: loadDocs, questions: loadQuestions, conversations: loadConversations };
  loaders[view]?.().catch((err) => alert(err.message));
}
$$('nav button').forEach((b) => (b.onclick = () => show(b.dataset.view)));

// ---------- overview ----------
async function loadOverview() {
  const s = await api('/dashboard/stats');
  $('#stats').innerHTML = [
    ['Conversations', s.conversations],
    ['Customer questions', s.questions],
    ['Answered', s.answered],
    ['Open unanswered', s.openUnanswered],
    ['Documents', s.documents],
  ]
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
  $('#share-link').value = `${location.origin}/chat/${state.business.slug}`;
  const acts = await api('/dashboard/activity');
  $('#activity').innerHTML = acts.length
    ? acts.map((a) => `<li><span>${esc(a.content)}</span><time>${fmt(a.created_at)}</time></li>`).join('')
    : '<li class="empty">No customer questions yet. Share your chat link to get started.</li>';
}

$('#copy-link').onclick = async () => {
  await navigator.clipboard.writeText($('#share-link').value);
  $('#copy-link').textContent = 'Copied';
  setTimeout(() => ($('#copy-link').textContent = 'Copy'), 1500);
};

// ---------- documents ----------
async function loadDocs() {
  const docs = await api('/documents');
  $('#doc-rows').innerHTML = docs.length
    ? docs
        .map(
          (d) => `<tr>
            <td>${esc(d.original_name)}</td>
            <td>${esc(d.file_type.toUpperCase())}</td>
            <td>${fmt(d.created_at)}</td>
            <td><span class="badge ${d.status}">${d.status}</span>
              ${d.error_message ? `<small class="err-text">${esc(d.error_message)}</small>` : ''}</td>
            <td>${d.chunk_count}</td>
            <td class="actions">
              <label class="link">Replace<input type="file" accept=".pdf,.docx,.txt" hidden data-replace="${d.id}"></label>
              <button class="link danger" data-del="${d.id}" type="button">Delete</button>
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="empty">No documents yet. Upload an FAQ, price list or policy to get started.</td></tr>';
}

async function sendFile(path, method, file) {
  const status = $('#upload-status');
  status.className = 'status';
  status.textContent = `Processing ${file.name}…`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const doc = await api(path, { method, body: fd });
    if (doc.status === 'failed') {
      status.className = 'status error';
      status.textContent = `Could not process file: ${doc.error_message}`;
    } else {
      status.className = 'status ok';
      status.textContent = `${doc.original_name} is ready (${doc.chunk_count} sections indexed).`;
    }
  } catch (err) {
    status.className = 'status error';
    status.textContent = err.message;
  }
  loadDocs();
}

$('#file-input').onchange = (e) => {
  const file = e.target.files[0];
  if (file) sendFile('/documents/upload', 'POST', file);
  e.target.value = '';
};

$('#doc-rows').onchange = (e) => {
  const id = e.target.dataset.replace;
  if (id && e.target.files[0]) sendFile(`/documents/${id}`, 'PUT', e.target.files[0]);
};

$('#doc-rows').onclick = async (e) => {
  const id = e.target.dataset.del;
  if (!id || !confirm('Delete this document? Its content will no longer be used for answers.')) return;
  try {
    await api(`/documents/${id}`, { method: 'DELETE' });
    loadDocs();
  } catch (err) {
    alert(err.message);
  }
};

// ---------- unanswered questions ----------
async function loadQuestions() {
  const qs = await api('/questions?status=open');
  $('#q-list').innerHTML = qs.length
    ? qs
        .map(
          (q) => `<tr>
            <td>${esc(q.question)}</td>
            <td>${fmt(q.created_at)}</td>
            <td><button class="link" data-conv="${q.conversation_id}" type="button">View chat</button></td>
            <td class="actions">
              <button class="link" data-resolve="${q.id}" type="button">Mark resolved</button>
              <button class="link" data-ignore="${q.id}" type="button">Ignore</button>
            </td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No open questions. Every customer question was answered from your documents.</td></tr>';
}

$('#q-list').onclick = async (e) => {
  const t = e.target;
  if (t.dataset.conv) return openConversation(t.dataset.conv);
  const id = t.dataset.resolve || t.dataset.ignore;
  if (!id) return;
  try {
    await api(`/questions/${id}`, { method: 'PUT', body: { status: t.dataset.resolve ? 'resolved' : 'ignored' } });
    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
};

// ---------- conversations ----------
async function loadConversations() {
  const list = await api('/conversations');
  $('#conv-list').innerHTML = list.length
    ? list
        .map(
          (c) => `<li data-id="${c.id}">
            <strong>${esc(c.preview || 'Conversation')}</strong>
            <small>${c.message_count} messages · ${fmt(c.last_message_at)}</small>
          </li>`
        )
        .join('')
    : '<li class="empty">No conversations yet.</li>';
}

$('#conv-list').onclick = (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) openConversation(li.dataset.id);
};

async function openConversation(id) {
  show('conversations');
  const msgs = await api(`/conversations/${id}`);
  $('#conv-detail').innerHTML = msgs
    .map((m) => {
      const flag = m.role === 'assistant' && m.is_answered === false ? ' · <span class="badge open">not in documents</span>' : '';
      const src = m.source_document ? ` · Source: ${esc(m.source_document)}` : '';
      return `<div class="msg ${m.role}">
        <p>${esc(m.content)}</p>
        <time>${m.role === 'customer' ? 'Customer' : 'Assistant'} · ${fmt(m.created_at)}${src}${flag}</time>
      </div>`;
    })
    .join('');
}

boot();
