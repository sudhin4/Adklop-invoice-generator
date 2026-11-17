const $ = s => document.querySelector(s);
const CKEY = 'inv_clients_v1', KEY = 'inv_data_v1', SKEY = 'inv_settings_v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Storage full. Use a smaller logo or QR image.'); } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹ ' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? d.split('-').reverse().join('-') : '';
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

let invoices = load(KEY, []);
let settings = load(SKEY, {
  name: '', company: '', address: '', phone: '', logo: '', qr: '',
  note: 'Thank you for choosing our services. Your timely payment helps us continue delivering the best results for your business.',
  tagline: 'Looking forward to working again'
});
let editingId = null;
let clients = load(CKEY, []), editingClient = null;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- helpers ---------- */
function nextNo() {
  const nums = invoices.map(i => parseInt(String(i.no).replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
}
function effStatus(i) {
  return i.status === 'pending' && i.due && i.due < today() ? 'overdue' : i.status;
}
function total(items) { return items.reduce((s, i) => s + (Number(i.cost) || 0), 0); }

/* ---------- items ---------- */
function addItemRow(it = { desc: '', period: '', cost: '' }) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `<input class="i-desc" placeholder="Description" value="${esc(it.desc)}">
    <input class="i-period" placeholder="Period" value="${esc(it.period)}">
    <input class="i-cost" type="number" min="0" step="any" placeholder="Cost" value="${esc(it.cost)}">
    <button type="button" class="x" aria-label="Remove item">×</button>`;
  row.querySelector('.x').onclick = () => { row.remove(); refresh(); };
  $('#items').appendChild(row);
}
function readItems() {
  return [...document.querySelectorAll('.item-row')].map(r => ({
    desc: r.querySelector('.i-desc').value.trim(),
    period: r.querySelector('.i-period').value.trim(),
    cost: r.querySelector('.i-cost').value
  })).filter(i => i.desc || i.cost);
}

/* ---------- form <-> data ---------- */
function readForm() {
  const items = readItems();
  return {
    id: editingId || 'i' + Date.now(),
    no: $('#no').value.trim(), date: $('#date').value, due: $('#due').value,
    status: $('#status').value,
    paidDate: $('#status').value === 'paid' ? (invoices.find(i => i.id === editingId)?.paidDate || today()) : '',
    seller: { name: $('#sName').value, company: $('#sCompany').value, address: $('#sAddress').value, phone: $('#sPhone').value, logo: settings.logo, qr: settings.qr },
    client: { name: $('#cName').value, company: $('#cCompany').value, address: $('#cAddress').value, phone: $('#cPhone').value, email: $('#cEmail').value },
    items, total: total(items), note: $('#note').value, tagline: $('#tagline').value
  };
}
function fillForm(d) {
  $('#no').value = d.no; $('#date').value = d.date; $('#due').value = d.due || ''; $('#status').value = d.status;
  $('#sName').value = d.seller.name; $('#sCompany').value = d.seller.company; $('#sAddress').value = d.seller.address; $('#sPhone').value = d.seller.phone;
  $('#cName').value = d.client.name; $('#cCompany').value = d.client.company; $('#cAddress').value = d.client.address; $('#cPhone').value = d.client.phone; $('#cEmail').value = d.client.email;
  $('#note').value = d.note; $('#tagline').value = d.tagline;
  $('#items').innerHTML = ''; (d.items.length ? d.items : [undefined]).forEach(i => addItemRow(i));
  settings.logo = d.seller.logo; settings.qr = d.seller.qr;
  fillPick();
  refresh();
}
function blankForm() {
  editingId = null;
  fillForm({
    no: nextNo(), date: today(), due: addDays(7), status: 'pending',
    seller: { name: settings.name, company: settings.company, address: settings.address, phone: settings.phone, logo: settings.logo, qr: settings.qr },
    client: { name: '', company: '', address: '', phone: '', email: '' },
    items: [{ desc: '', period: '', cost: '' }], note: settings.note, tagline: settings.tagline
  });
  $('#formTitle').textContent = 'New invoice'; $('#saveBtn').textContent = 'Save invoice';
}

/* ---------- paper ---------- */
function renderPaper(el, d) {
  const s = d.seller, c = d.client;
  const initials = (s.company || s.name || 'INV').slice(0, 2).toUpperCase();
  const rows = d.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.desc)}</td><td>${esc(it.period)}</td><td>${it.cost !== '' ? money(it.cost) : ''}</td></tr>`).join('');
  el.innerHTML = `
    <div class="p-head">
      <div><h1>E-Invoice</h1>
        <div class="meta"><b>Invoice No:</b> #${esc(d.no)}<br><b>Date:</b> ${fmtDate(d.date)}${d.due ? `<br><b>Due:</b> ${fmtDate(d.due)}` : ''}</div>
        <div class="info">${s.name ? `Name : ${esc(s.name)}<br>` : ''}${s.company ? `Company Name: ${esc(s.company)}<br>` : ''}${s.address ? `Address : ${esc(s.address)}<br>` : ''}${s.phone ? `Phone No: ${esc(s.phone)}` : ''}</div>
      </div>
      <div class="logo">${s.logo ? `<img src="${s.logo}" alt="">` : esc(initials)}</div>
    </div>
    ${d.status === 'paid' ? '<div class="badge-paid">PAID</div>' : ''}
    <h3>Issued To:</h3>
    <div class="info">${c.name ? `Client Name : ${esc(c.name)}<br>` : ''}${c.company ? `Client Company Name: ${esc(c.company)}<br>` : ''}${c.address ? `Client Address : ${esc(c.address)}<br>` : ''}${c.phone ? `Phone No: ${esc(c.phone)}<br>` : ''}${c.email ? `Email: ${esc(c.email)}` : ''}</div>
    <table class="p-table"><thead><tr><th>Items</th><th>Description</th><th>Period</th><th>Cost</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="p-total">Total Amount: <b>${money(d.total)}</b></div>
    ${d.note ? `<div class="p-note"><h3 style="margin-top:0">Note:</h3><p>${esc(d.note)}</p></div>` : ''}
    ${s.qr ? `<img class="p-qr" src="${s.qr}" alt="Payment QR">` : ''}
    ${d.tagline ? `<div class="p-tag">“${esc(d.tagline)}”</div>` : ''}`;
}
function fitPreview() {
  const wrap = $('#previewWrap'), p = $('#preview');
  const z = Math.min(1, (wrap.clientWidth - 32) / 794);
  p.style.zoom = z;
}
function refresh() {
  const d = readForm();
  $('#totalText').textContent = money(d.total);
  renderPaper($('#preview'), d); fitPreview();
}

/* ---------- PDF ---------- */
async function downloadPDF(d) {
  if (!window.html2canvas || !window.jspdf) return toast('PDF libraries failed to load. Check your internet connection.');
  try {
    toast('Preparing PDF…');
    const ex = $('#export'); renderPaper(ex, d);
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 150));
    const canvas = await html2canvas(ex, { scale: 2, backgroundColor: '#fff', useCORS: true });
    const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
    const w = 210, h = canvas.height * w / canvas.width;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, Math.min(h, 297));
    pdf.save(`Invoice-${d.no}.pdf`);
    toast('Invoice downloaded');
  } catch (e) { console.error(e); toast('Could not create the PDF'); }
}

/* ---------- save ---------- */
function persistSettings(d) {
  Object.assign(settings, { name: d.seller.name, company: d.seller.company, address: d.seller.address, phone: d.seller.phone, note: d.note, tagline: d.tagline });
  store(SKEY, settings);
}
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const d = readForm();
  if (!d.client.name) return toast('Enter the client name');
  if (!d.items.length) return toast('Add at least one item');
  if (invoices.some(i => i.no === d.no && i.id !== d.id)) return toast('Invoice number already exists');
  const idx = invoices.findIndex(i => i.id === d.id);
  if (idx > -1) invoices[idx] = d; else invoices.push(d);
  store(KEY, invoices); persistSettings(d);
  if ($('#saveClient').checked) upsertClient(d.client);
  toast(idx > -1 ? 'Invoice updated' : 'Invoice saved');
  blankForm(); renderTrack();
});
$('#pdfBtn').onclick = () => downloadPDF(readForm());
$('#resetBtn').onclick = blankForm;
$('#addItem').onclick = () => { addItemRow(); };
$('#form').addEventListener('input', refresh);

function pickImage(inputId, key) {
  $(inputId).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1.5e6) { e.target.value = ''; return toast('Image must be under 1.5 MB'); }
    const r = new FileReader();
    r.onload = () => { settings[key] = r.result; store(SKEY, settings); refresh(); };
    r.readAsDataURL(f);
  });
}
pickImage('#logo', 'logo'); pickImage('#qr', 'qr');

/* ---------- tracking ---------- */
function renderTrack() {
  const q = $('#search').value.toLowerCase(), f = $('#filter').value;
  const sum = { paid: 0, pending: 0, overdue: 0 }, cnt = { paid: 0, pending: 0, overdue: 0 };
  invoices.forEach(i => { const s = effStatus(i); sum[s] += i.total; cnt[s]++; });
  const all = sum.paid + sum.pending + sum.overdue;
  $('#stats').innerHTML = [
    ['Total billed', all, `${invoices.length} invoices`, 'dark'],
    ['Paid', sum.paid, `${cnt.paid} invoices`, ''],
    ['Pending', sum.pending, `${cnt.pending} invoices`, ''],
    ['Overdue', sum.overdue, `${cnt.overdue} invoices`, '']
  ].map(([l, v, s, c]) => `<div class="stat ${c}"><span>${l}</span><strong>${money(v)}</strong><small>${s}</small></div>`).join('');

  const list = invoices.filter(i => (f === 'all' || effStatus(i) === f) &&
    (i.no.toLowerCase().includes(q) || i.client.name.toLowerCase().includes(q) || i.client.company.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  $('#empty').hidden = list.length > 0;
  $('#rows').innerHTML = list.map(i => {
    const s = effStatus(i);
    return `<tr data-id="${i.id}">
      <td>#${esc(i.no)}</td>
      <td>${esc(i.client.name)}${i.client.company ? `<br><small style="color:#6b6b6b">${esc(i.client.company)}</small>` : ''}</td>
      <td>${fmtDate(i.date)}</td><td>${fmtDate(i.due) || '-'}</td>
      <td class="r">${money(i.total)}</td>
      <td><select class="${s}" data-act="status" aria-label="Status">
        ${['pending', 'paid'].map(v => `<option value="${v}" ${i.status === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}
        ${s === 'overdue' ? '<option value="overdue" selected disabled>Overdue</option>' : ''}</select></td>
      <td><div class="row-actions"><button data-act="edit">Edit</button><button data-act="pdf">PDF</button><button data-act="del">Delete</button></div></td></tr>`;
  }).join('');
}
$('#rows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.closest('tr').dataset.id, inv = invoices.find(i => i.id === id);
  if (b.dataset.act === 'pdf') downloadPDF(inv);
  if (b.dataset.act === 'edit') {
    editingId = id; fillForm(inv);
    $('#formTitle').textContent = `Edit invoice #${inv.no}`; $('#saveBtn').textContent = 'Update invoice';
    showTab('create'); scrollTo({ top: 0 });
  }
  if (b.dataset.act === 'del' && confirm(`Delete invoice #${inv.no}? This cannot be undone.`)) {
    invoices = invoices.filter(i => i.id !== id); store(KEY, invoices); renderTrack(); toast('Invoice deleted');
  }
});
$('#rows').addEventListener('change', e => {
  if (e.target.dataset.act !== 'status') return;
  const inv = invoices.find(i => i.id === e.target.closest('tr').dataset.id);
  inv.status = e.target.value; inv.paidDate = inv.status === 'paid' ? today() : '';
  store(KEY, invoices); renderTrack(); toast(`Marked as ${inv.status}`);
});
$('#search').oninput = $('#filter').onchange = renderTrack;
$('#csvBtn').onclick = () => {
  if (!invoices.length) return toast('Nothing to export yet');
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Invoice No', 'Date', 'Due', 'Client', 'Company', 'Amount', 'Status', 'Paid On']].concat(
    invoices.map(i => [i.no, i.date, i.due, i.client.name, i.client.company, i.total, effStatus(i), i.paidDate]));
  const blob = new Blob(['\ufeff' + lines.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'invoices.csv'; a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
  if (name === 'track') renderTrack(); else if (name === 'clients') renderClients(); else fitPreview();
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
addEventListener('resize', fitPreview);

/* ---------- clients ---------- */
const sameClient = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  (a.company || '').trim().toLowerCase() === (b.company || '').trim().toLowerCase();

function upsertClient(c) {
  if (!c.name.trim()) return;
  const i = clients.findIndex(x => sameClient(x, c));
  if (i > -1) clients[i] = { ...clients[i], ...c, id: clients[i].id };
  else clients.push({ ...c, id: 'c' + Date.now() });
  store(CKEY, clients); fillPick(); renderClients();
}
function fillPick() {
  const sel = $('#clientPick');
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">' + (sorted.length ? 'Select a saved client' : 'No saved clients yet') + '</option>' +
    sorted.map(c => `<option value="${c.id}">${esc(c.name)}${c.company ? ' - ' + esc(c.company) : ''}</option>`).join('');
}
function setClientFields(c) {
  $('#cName').value = c.name; $('#cCompany').value = c.company || ''; $('#cAddress').value = c.address || '';
  $('#cPhone').value = c.phone || ''; $('#cEmail').value = c.email || '';
}
$('#clientPick').onchange = e => {
  const c = clients.find(x => x.id === e.target.value);
  if (c) { setClientFields(c); refresh(); }
};
function resetClientForm() {
  editingClient = null; $('#clientForm').reset();
  $('#clientTitle').textContent = 'Add client'; $('#clientSave').textContent = 'Add client'; $('#clientCancel').hidden = true;
}
$('#clientForm').addEventListener('submit', e => {
  e.preventDefault();
  const c = { name: $('#clName').value.trim(), company: $('#clCompany').value.trim(), address: $('#clAddress').value.trim(), phone: $('#clPhone').value.trim(), email: $('#clEmail').value.trim() };
  if (!c.name) return toast('Enter the client name');
  if (editingClient) {
    const i = clients.findIndex(x => x.id === editingClient);
    clients[i] = { ...c, id: editingClient }; store(CKEY, clients); fillPick(); renderClients(); toast('Client updated');
  } else if (clients.some(x => sameClient(x, c))) {
    return toast('This client already exists');
  } else { upsertClient(c); toast('Client added'); }
  resetClientForm();
});
$('#clientCancel').onclick = resetClientForm;
$('#clientSearch').oninput = renderClients;

function renderClients() {
  $('#storeNote').textContent = `${clients.length} client${clients.length === 1 ? '' : 's'} saved in this browser. They stay here until you clear this site's data, so export a backup now and then.`;
  const q = $('#clientSearch').value.toLowerCase();
  const list = clients.filter(c => (c.name + ' ' + c.company + ' ' + c.phone + ' ' + c.email).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  $('#clientEmpty').hidden = list.length > 0;
  $('#clientRows').innerHTML = list.map(c => {
    const inv = invoices.filter(i => sameClient(i.client, c));
    const due = inv.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0);
    return `<tr data-id="${c.id}">
      <td>${esc(c.name)}${c.company ? `<br><small style="color:#6b6b6b">${esc(c.company)}</small>` : ''}</td>
      <td>${esc(c.phone) || '-'}</td><td>${esc(c.email) || '-'}</td>
      <td>${inv.length}</td><td class="r">${money(due)}</td>
      <td><div class="row-actions"><button data-act="inv">New invoice</button><button data-act="edit">Edit</button><button data-act="del">Delete</button></div></td></tr>`;
  }).join('');
}
$('#clientRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.closest('tr').dataset.id, c = clients.find(x => x.id === id);
  if (b.dataset.act === 'inv') {
    blankForm(); setClientFields(c); $('#clientPick').value = id; refresh(); showTab('create'); scrollTo({ top: 0 });
  }
  if (b.dataset.act === 'edit') {
    editingClient = id;
    $('#clName').value = c.name; $('#clCompany').value = c.company; $('#clAddress').value = c.address; $('#clPhone').value = c.phone; $('#clEmail').value = c.email;
    $('#clientTitle').textContent = 'Edit client'; $('#clientSave').textContent = 'Update client'; $('#clientCancel').hidden = false;
    scrollTo({ top: 0, behavior: 'smooth' }); $('#clName').focus();
  }
  if (b.dataset.act === 'del' && confirm(`Delete ${c.name} from your clients? Their existing invoices are kept.`)) {
    clients = clients.filter(x => x.id !== id); store(CKEY, clients); fillPick(); renderClients(); toast('Client deleted');
  }
});

$('#saveClientBtn').onclick = () => {
  const c = readForm().client;
  if (!c.name.trim()) return toast('Enter the client name first');
  const existed = clients.some(x => sameClient(x, c));
  upsertClient(c); toast(existed ? 'Client details updated' : 'Client saved in this browser');
};

/* ---------- backup & permanent storage ---------- */
$('#backupBtn').onclick = () => {
  const data = { app: 'invoice-generator', version: 1, exported: new Date().toISOString(), clients, invoices, settings };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `invoice-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
};
$('#restoreBtn').onclick = () => $('#restoreFile').click();
$('#restoreFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.clients) || !Array.isArray(d.invoices)) throw 0;
      let addedC = 0, addedI = 0;
      d.clients.forEach(c => { if (c.name && !clients.some(x => sameClient(x, c))) { clients.push({ ...c, id: c.id || 'c' + Date.now() + addedC }); addedC++; } });
      d.invoices.forEach(i => { if (i.id && !invoices.some(x => x.id === i.id || x.no === i.no)) { invoices.push(i); addedI++; } });
      if (d.settings) settings = { ...d.settings, ...settings };
      store(CKEY, clients); store(KEY, invoices); store(SKEY, settings);
      fillPick(); renderClients(); renderTrack(); blankForm();
      toast(`Restored ${addedC} clients and ${addedI} invoices`);
    } catch { toast('That file is not a valid backup'); }
    e.target.value = '';
  };
  r.readAsText(f);
});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});


blankForm(); renderTrack(); renderClients();
