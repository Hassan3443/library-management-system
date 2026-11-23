/* Page renderers for the Library Management System front end demo. */

/* Escape user-supplied text before injecting it into innerHTML (XSS protection). */
function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Demo persistence: librarian actions and login state survive a page reload
   via localStorage (the demo has no backend). */
const LS_KEY = "lms_state_v1";
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }
const STATE = Object.assign(
  { addedBooks: [], removedBookIds: [], updatedBooks: {}, addedCopies: {},
    decisions: {}, suspended: {}, user: null },
  loadState()
);

/* Apply persisted actions to the in-memory demo data before any page renders. */
(function applyState() {
  STATE.removedBookIds.forEach(id => {
    const i = BOOKS.findIndex(b => b.id === id);
    if (i >= 0) BOOKS.splice(i, 1);
  });
  Object.keys(STATE.updatedBooks).forEach(id => {
    const b = bookById(Number(id));
    if (b) Object.assign(b, STATE.updatedBooks[id]);
  });
  Object.keys(STATE.addedCopies).forEach(id => {
    const b = bookById(Number(id));
    if (b) STATE.addedCopies[id].forEach(c => { if (!b.copies.some(x => x.id === c.id)) b.copies.push(c); });
  });
  STATE.addedBooks.forEach(b => { if (!bookById(b.id)) BOOKS.push(b); });
  MEMBERS.forEach(m => { if (m.id in STATE.suspended) m.suspended = STATE.suspended[m.id]; });
})();

/* Business rule (FR-05/FR-08): a member cannot place a borrow request while
   suspended, with an unpaid fine, or while holding 3 or more active loans. */
function memberEligibility() {
  const reasons = [];
  const record = MEMBERS.find(m => m.id === MEMBER.id);
  if (record && record.suspended) reasons.push("the member account is suspended");
  if (FINES.some(f => !f.paid)) reasons.push("there is an unpaid fine on the member account");
  const active = LOANS.filter(l => !l.returnDate).length;
  if (active >= 3) reasons.push("the member already holds " + active + " active loans (limit 3)");
  return { ok: reasons.length === 0, reasons: reasons };
}

function statusBadge(status) {
  const map = {
    "available": ["ok", "Available"],
    "on-loan": ["warn", "On loan"],
    "reserved": ["info", "Reserved"],
    "maintenance": ["muted", "Maintenance"],
    "active": ["ok", "Active"],
    "overdue": ["danger", "Overdue"],
    "returned": ["muted", "Returned"]
  };
  const [cls, label] = map[status] || ["muted", status];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ---------- Book Catalog ---------- */
function renderCatalog() {
  const cats = [...new Set(BOOKS.map(b => b.category))].sort();
  const catSel = document.getElementById("cat");
  cats.forEach(c => catSel.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));

  function draw() {
    const q = document.getElementById("q").value.trim().toLowerCase();
    const cat = catSel.value;
    const av = document.getElementById("avail").value;
    const rows = BOOKS.filter(b => {
      const text = `${b.title} ${b.author} ${b.category}`.toLowerCase();
      const nAvail = availableCopies(b);
      return (!q || text.includes(q)) && (!cat || b.category === cat) &&
        (!av || (av === "yes") === nAvail > 0);
    });
    document.getElementById("count").textContent =
      `${rows.length} of ${BOOKS.length} titles shown`;
    document.getElementById("rows").innerHTML = rows.map(b => {
      const n = availableCopies(b);
      const badge = n > 0
        ? `<span class="badge ok">${n} of ${b.copies.length} available</span>`
        : `<span class="badge warn">All copies on loan</span>`;
      return `<tr>
        <td><div class="book-cover">${esc(b.title[0] || "?")}</div></td>
        <td><div class="book-title">${esc(b.title)}</div><div class="book-meta">ISBN ${esc(b.isbn)} - ${esc(b.year)}</div></td>
        <td>${esc(b.author)}</td><td>${esc(b.category)}</td><td>${badge}</td>
        <td><a class="btn small" href="book.html?id=${b.id}">Details</a></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6">No books match your search.</td></tr>`;
  }
  ["q", "cat", "avail"].forEach(id => document.getElementById(id).addEventListener("input", draw));
  draw();
}

/* ---------- Book Details ---------- */
function renderBookDetails() {
  const id = Number(new URLSearchParams(location.search).get("id"));
  const b = bookById(id);
  const main = document.getElementById("main");
  if (!b) {
    main.innerHTML = `<div class="card"><h1>Book not found</h1><p><a href="catalog.html">Back to catalog</a></p></div>`;
    return;
  }
  const nAvail = availableCopies(b);
  const queue = RESERVATIONS.filter(r => r.bookId === b.id);
  const elig = memberEligibility();
  main.innerHTML = `
    <p class="subtitle"><a href="catalog.html">&larr; Back to catalog</a></p>
    <div class="card">
      <h1>${esc(b.title)}</h1>
      <p class="subtitle">${esc(b.author)} - ${esc(b.category)} - ${esc(b.year)} - ISBN ${esc(b.isbn)}</p>
      <p>${nAvail > 0
        ? `<span class="badge ok">${nAvail} of ${b.copies.length} copies available</span>`
        : `<span class="badge warn">All copies on loan</span>`}</p>
      <div style="margin-top:18px">
        <button class="btn" id="borrow" ${nAvail && elig.ok ? "" : "disabled"}>Request to borrow (FR-05)</button>
        <button class="btn secondary" id="reserve" ${nAvail ? "disabled" : ""}>Reserve this book (FR-09)</button>
      </div>
      <div id="action-result" style="margin-top:14px"></div>
    </div>
    <h2>Copies</h2>
    <div class="card" style="padding:0; overflow:auto">
      <table>
        <thead><tr><th>Copy</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>${b.copies.map(c =>
          `<tr><td>${esc(c.id)}</td><td>${esc(c.location)}</td><td>${statusBadge(c.status)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${queue.length ? `<h2>Reservation queue</h2>
    <div class="card"><p>${queue.length} member(s) waiting. First in queue: ${esc(queue[0].memberName)} (since ${esc(queue[0].date)}).</p></div>` : ""}
  `;
  if (!elig.ok) {
    document.getElementById("action-result").innerHTML =
      `<div class="notice">Borrowing is blocked for this member: ${elig.reasons.join("; ")}.
       Resolve this on the <a href="member.html">member dashboard</a> first (FR-08).</div>`;
  }
  document.getElementById("borrow").addEventListener("click", () => {
    const current = memberEligibility();
    if (!current.ok) {
      document.getElementById("action-result").innerHTML =
        `<div class="notice">Borrow request blocked: ${current.reasons.join("; ")} (FR-08).</div>`;
      return;
    }
    document.getElementById("action-result").innerHTML =
      `<div class="notice ok">Borrow request sent. A librarian will review and confirm it; the due date is set at confirmation (FR-14).</div>`;
  });
  document.getElementById("reserve").addEventListener("click", () => {
    document.getElementById("action-result").innerHTML =
      `<div class="notice ok">You joined the reservation queue at position ${queue.length + 1}. You will be notified when a copy is returned (FR-09, FR-18).</div>`;
  });
}

/* ---------- Member Dashboard ---------- */
function renderMemberDashboard() {
  const mine = LOANS.filter(l => !l.returnDate);
  document.getElementById("profile").innerHTML = `
    <strong>${esc(MEMBER.name)}</strong> (${esc(MEMBER.email)})<br>
    <span class="book-meta">Member since ${MEMBER.joinDate} - ${mine.length} active loans</span>`;

  const notices = [];
  mine.forEach(l => {
    const b = bookById(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    if (l.status === "overdue") notices.push(`<div class="notice">Overdue: "${esc(b.title)}" was due on ${l.dueDate}. Please return it; fines accrue at ${FINE_PER_DAY} EGP/day (FR-11).</div>`);
    else if (days <= 3) notices.push(`<div class="notice ok">Reminder: "${esc(b.title)}" is due in ${days} day(s), on ${l.dueDate} (FR-11).</div>`);
  });
  const elig = memberEligibility();
  if (!elig.ok) notices.unshift(`<div class="notice">Borrowing is currently blocked for this account: ${elig.reasons.join("; ")} (FR-08).</div>`);
  document.getElementById("notices").innerHTML = notices.join("");

  document.getElementById("loans").innerHTML = mine.map(l => {
    const b = bookById(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    const due = l.status === "overdue"
      ? `<span class="badge danger">${Math.abs(days)} day(s) late</span>`
      : `<span class="badge info">${days} day(s) left</span>`;
    return `<tr><td><div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)}</div></td>
      <td>${esc(l.copyId)}</td><td>${l.borrowDate}</td><td>${l.dueDate}</td><td>${due}</td>
      <td><a class="btn small secondary" href="return.html">Return</a></td></tr>`;
  }).join("");

  document.getElementById("fines").innerHTML = FINES.map(f => {
    const l = LOANS.find(x => x.id === f.loanId);
    const b = bookById(l.bookId);
    return `<tr><td>#${f.id}</td><td>"${esc(b.title)}" (loan #${l.id})</td><td>${f.overdueDays}</td>
      <td>${f.amount} EGP</td><td>${f.paid ? '<span class="badge ok">Paid</span>' : '<span class="badge danger">Unpaid</span>'}</td></tr>`;
  }).join("") || `<tr><td colspan="5">No outstanding fines.</td></tr>`;

  document.getElementById("reservations").innerHTML =
    RESERVATIONS.filter(r => r.memberId === MEMBER.id).map(r => {
      const b = bookById(r.bookId);
      return `<tr><td><div class="book-title">${esc(b.title)}</div></td><td>${r.date}</td><td>#${r.queuePosition}</td></tr>`;
    }).join("") || `<tr><td colspan="3">No active reservations.</td></tr>`;
}

/* ---------- Borrowing History ---------- */
function renderHistory() {
  document.getElementById("history").innerHTML = LOANS.slice().reverse().map(l => {
    const b = bookById(l.bookId);
    const fine = l.returnDate ? loanFine(l) : 0;
    return `<tr><td>#${l.id}</td>
      <td><div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)}</div></td>
      <td>${l.borrowDate}</td><td>${l.dueDate}</td><td>${l.returnDate || "-"}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${fine ? `<span class="badge danger">${fine} EGP</span>` : "-"}</td></tr>`;
  }).join("");
}

/* ---------- Return Book ---------- */
function renderReturnPage() {
  const sel = document.getElementById("loan");
  const mine = LOANS.filter(l => !l.returnDate);
  sel.innerHTML = mine.map(l => {
    const b = bookById(l.bookId);
    return `<option value="${l.id}">"${esc(b.title)}" (copy ${esc(l.copyId)}, due ${l.dueDate})</option>`;
  }).join("");
  document.getElementById("rdate").value = TODAY;

  document.getElementById("calc").addEventListener("click", () => {
    const l = mine.find(x => x.id === Number(sel.value));
    const b = bookById(l.bookId);
    const rdate = document.getElementById("rdate").value || TODAY;
    const late = Math.max(0, daysBetween(l.dueDate, rdate));
    const fine = late * FINE_PER_DAY;
    const waiting = RESERVATIONS.filter(r => r.bookId === b.id);
    document.getElementById("result").innerHTML = `
      <div class="card">
        <h2>Return summary</h2>
        <table>
          <tr><th>Book</th><td>"${esc(b.title)}" (copy ${esc(l.copyId)})</td></tr>
          <tr><th>Due date</th><td>${l.dueDate}</td></tr>
          <tr><th>Return date</th><td>${rdate}</td></tr>
          <tr><th>Overdue days</td><td>${late}</td></tr>
          <tr><th>Fine</th><td>${fine ? `<span class="badge danger">${fine} EGP (${late} x ${FINE_PER_DAY} EGP)</span>` : '<span class="badge ok">No fine</span>'}</td></tr>
        </table>
        ${waiting.length ? `<p style="margin-top:12px" class="book-meta">Note: ${waiting.length} member(s) have this book reserved; the next in queue will be notified (FR-18).</p>` : ""}
        <div style="margin-top:16px"><button class="btn" id="confirm">Confirm return</button></div>
        <div id="done" style="margin-top:12px"></div>
      </div>`;
    document.getElementById("confirm").addEventListener("click", () => {
      document.getElementById("done").innerHTML =
        `<div class="notice ok">Return recorded. The copy is available again${fine ? ` and a fine of ${fine} EGP was added to the member account` : ""}.</div>`;
      document.getElementById("confirm").disabled = true;
    });
  });
}

/* ---------- Librarian Dashboard ---------- */
function renderLibrarianDashboard() {
  const activeLoans = LOANS.filter(l => !l.returnDate);
  const overdueLoans = activeLoans.filter(l => l.status === "overdue" || overdueDays(l) > 0);
  document.getElementById("stats").innerHTML = [
    { num: BOOKS.length, lbl: "Titles" },
    { num: PENDING_REQUESTS.length, lbl: "Pending requests" },
    { num: activeLoans.length, lbl: "Active loans" },
    { num: overdueLoans.length, lbl: "Overdue loans" }
  ].map(s => `<div class="stat"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join("");

  /* Pending requests: confirm/reject decisions persist across reloads. */
  const reqEl = document.getElementById("requests");
  function drawRequests() {
    reqEl.innerHTML = PENDING_REQUESTS.map(r => {
      const b = bookById(r.bookId);
      const decision = STATE.decisions[r.id];
      const bookCell = `<div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)}</div>`;
      const action = decision === "ok"
        ? `<span class="badge ok">Confirmed</span> Loan recorded, due in 14 days (FR-14).`
        : decision === "no"
          ? `<span class="badge muted">Rejected</span> The member was notified.`
          : `<button class="btn small" data-act="ok" data-id="${r.id}">Confirm</button>
             <button class="btn small danger" data-act="no" data-id="${r.id}">Reject</button>`;
      return `<tr><td>#${r.id}</td><td>${esc(r.memberName)}</td><td>${bookCell}</td><td>${r.date}</td><td>${action}</td></tr>`;
    }).join("") || `<tr><td colspan="5">No pending requests.</td></tr>`;
  }
  drawRequests();
  reqEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    STATE.decisions[btn.dataset.id] = btn.dataset.act;
    saveState();
    drawRequests();
  });

  document.getElementById("overdue").innerHTML = overdueLoans.map(l => {
    const b = bookById(l.bookId);
    const days = overdueDays(l);
    return `<tr><td>#${l.id}</td><td>"${esc(b.title)}"</td><td>${l.dueDate}</td>
      <td>${days}</td><td><span class="badge danger">${loanFine(l)} EGP</span></td></tr>`;
  }).join("") || `<tr><td colspan="5">No overdue loans.</td></tr>`;

  /* Catalog management: add, update, remove books and register copies (FR-12, FR-13). */
  const noticeEl = document.getElementById("notice");
  const catBody = document.getElementById("catalog-table");
  let editingId = null;

  function readForm() {
    return {
      title: document.getElementById("bt").value.trim(),
      author: document.getElementById("ba").value.trim(),
      category: document.getElementById("bc").value.trim(),
      copies: Math.max(1, Number(document.getElementById("bn").value) || 1)
    };
  }
  function clearForm() {
    editingId = null;
    document.getElementById("addbook").textContent = "Add book";
    ["bt", "ba", "bc"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("bn").value = 1;
  }
  function newCopies(book, n) {
    return Array.from({ length: n }, (_, i) =>
      ({ id: `C${book.id}-${book.copies.length + i + 1}`, status: "available", location: "Intake" }));
  }

  document.getElementById("addbook").addEventListener("click", () => {
    const data = readForm();
    if (!data.title) return;
    if (editingId) {
      const b = bookById(editingId);
      if (b) {
        Object.assign(b, { title: data.title, author: data.author, category: data.category });
        STATE.updatedBooks[editingId] = { title: data.title, author: data.author, category: data.category };
        const added = STATE.addedBooks.find(x => x.id === editingId);
        if (added) Object.assign(added, { title: data.title, author: data.author, category: data.category });
        saveState();
        noticeEl.innerHTML = `<div class="notice ok">"${esc(data.title)}" updated (FR-12).</div>`;
      }
      clearForm();
    } else {
      const b = {
        id: Math.max(0, ...BOOKS.map(x => x.id)) + 1,
        title: data.title, author: data.author || "Unknown",
        category: data.category || "General", isbn: "pending", year: 2026, copies: []
      };
      b.copies = newCopies(b, data.copies);
      BOOKS.push(b);
      STATE.addedBooks.push(b);
      saveState();
      noticeEl.innerHTML =
        `<div class="notice ok">"${esc(b.title)}" added to the catalog with ${b.copies.length} cop(y/ies) (FR-12, FR-13).</div>`;
    }
    drawCatalog();
  });

  function drawCatalog() {
    catBody.innerHTML = BOOKS.map(b =>
      `<tr><td><div class="book-title">${esc(b.title)}</div></td><td>${esc(b.author)}</td><td>${esc(b.category)}</td>
       <td>${availableCopies(b)} / ${b.copies.length}</td>
       <td><button class="btn small secondary" data-op="edit" data-id="${b.id}">Edit</button>
           <button class="btn small secondary" data-op="copy" data-id="${b.id}">+ Copy</button>
           <button class="btn small danger" data-op="remove" data-id="${b.id}">Remove</button></td></tr>`
    ).join("");
  }
  drawCatalog();

  catBody.addEventListener("click", e => {
    const btn = e.target.closest("button[data-op]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const b = bookById(id);
    if (!b) return;
    if (btn.dataset.op === "edit") {
      editingId = id;
      document.getElementById("bt").value = b.title;
      document.getElementById("ba").value = b.author;
      document.getElementById("bc").value = b.category;
      document.getElementById("bn").value = 1;
      document.getElementById("addbook").textContent = "Update book";
      window.scrollTo(0, 0);
    } else if (btn.dataset.op === "copy") {
      const c = newCopies(b, 1)[0];
      b.copies.push(c);
      STATE.addedCopies[id] = (STATE.addedCopies[id] || []).concat(c);
      const added = STATE.addedBooks.find(x => x.id === id);
      if (added) added.copies.push(c);
      saveState();
      drawCatalog();
    } else if (btn.dataset.op === "remove") {
      BOOKS.splice(BOOKS.indexOf(b), 1);
      const ai = STATE.addedBooks.findIndex(x => x.id === id);
      if (ai >= 0) STATE.addedBooks.splice(ai, 1);
      else if (!STATE.removedBookIds.includes(id)) STATE.removedBookIds.push(id);
      delete STATE.updatedBooks[id];
      delete STATE.addedCopies[id];
      saveState();
      drawCatalog();
    }
  });

  /* Member management: suspend/reactivate is functional and persists (FR-17). */
  const memEl = document.getElementById("members");
  function drawMembers() {
    memEl.innerHTML = MEMBERS.map(m =>
      `<tr><td><div class="book-title">${esc(m.name)}</div></td><td>${esc(m.email)}</td>
       <td>${m.activeLoans}</td><td>${m.unpaidFines ? m.unpaidFines + " EGP" : "-"}</td>
       <td>${m.suspended ? '<span class="badge danger">Suspended</span>' : '<span class="badge ok">Active</span>'}</td>
       <td><button class="btn small secondary" data-member="${m.id}">${m.suspended ? "Reactivate" : "Suspend"}</button></td></tr>`).join("");
  }
  drawMembers();
  memEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-member]");
    if (!btn) return;
    const m = MEMBERS.find(x => x.id === Number(btn.dataset.member));
    m.suspended = !m.suspended;
    STATE.suspended[m.id] = m.suspended;
    saveState();
    drawMembers();
  });

  document.getElementById("reservations").innerHTML = RESERVATIONS.map(r => {
    const b = bookById(r.bookId);
    return `<tr><td><div class="book-title">${esc(b.title)}</div></td><td>${esc(r.memberName)}</td>
      <td>${r.date}</td><td>#${r.queuePosition}</td></tr>`;
  }).join("");
}

/* ---------- Login / Register (FR-01, FR-02; mock, no real authentication) ---------- */
function renderLoginPage() {
  const who = STATE.user;
  if (who) {
    document.getElementById("login-msg").innerHTML =
      `<div class="notice ok">Already logged in as ${esc(who.name)} (${esc(who.email)}). Go to your <a href="member.html">member dashboard</a>.</div>`;
  }
  document.getElementById("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("lemail").value.trim();
    STATE.user = { name: email.split("@")[0], email: email };
    saveState();
    document.getElementById("login-msg").innerHTML =
      `<div class="notice ok">Logged in as ${esc(email)}. Go to your <a href="member.html">member dashboard</a>.</div>`;
  });
  document.getElementById("register-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("rname").value.trim();
    const email = document.getElementById("remail").value.trim();
    STATE.user = { name: name, email: email };
    saveState();
    document.getElementById("register-msg").innerHTML =
      `<div class="notice ok">Account created for ${esc(name)} (${esc(email)}). Go to your <a href="member.html">member dashboard</a>.</div>`;
  });
}

/* Label table cells for the stacked mobile layout and preserve table
   semantics when display changes on small screens. */
(function () {
  const label = t => {
    const heads = [...t.querySelectorAll("thead th")].map(x => x.textContent.trim());
    t.setAttribute("role", "table");
    t.querySelectorAll("thead th").forEach(h => h.setAttribute("role", "columnheader"));
    t.querySelectorAll("tbody tr").forEach(r => {
      r.setAttribute("role", "row");
      [...r.children].forEach((c, i) => {
        c.setAttribute("data-label", heads[i] || "");
        c.setAttribute("role", "cell");
      });
    });
  };
  const run = () => document.querySelectorAll("table").forEach(label);
  run();
  document.querySelectorAll("table").forEach(t => new MutationObserver(run).observe(t, { childList: true, subtree: true }));
})();
