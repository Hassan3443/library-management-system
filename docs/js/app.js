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
    data: null, suspended: {}, user: null, accounts: [], addedMembers: [], promoted: {}, removedMembers: [] },
  loadState()
);

/* Shared data object for the business logic in logic.js (arrays are shared by reference). */
const DB = { BOOKS, LOANS, FINES, PENDING_REQUESTS, RESERVATIONS, MEMBERS, TODAY, FINE_PER_DAY };

/* Persist the mutable library records (loans, fines, requests, reservations, copy
   status, id counters) after every action, so a reload shows the same state. */
function persistData() {
  const copies = {};
  BOOKS.forEach(b => b.copies.forEach(c => { copies[c.id] = c.status; }));
  STATE.data = { loans: LOANS, fines: FINES, pending: PENDING_REQUESTS, reservations: RESERVATIONS,
    copies: copies, seq: LMS.initSeq(DB) };
  saveState();
}
function replaceContents(target, source) { target.splice(0, target.length, ...source); }

/* Never throw on a book that was removed later: history keeps its loans. */
function bookSafe(id) {
  return bookById(id) || { id: id, title: "Removed book #" + id, author: "-", category: "-", isbn: "-", year: "-", copies: [] };
}

/* Delete a member and everything that belongs to them from the in-memory demo data. */
function dropWhere(arr, fn) { for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) arr.splice(i, 1); }
function removeMemberData(id) {
  dropWhere(MEMBERS, m => m.id === id);
  dropWhere(LOANS, l => l.memberId === id);
  dropWhere(FINES, f => f.memberId === id);
  dropWhere(RESERVATIONS, r => r.memberId === id);
  dropWhere(PENDING_REQUESTS, r => r.memberId === id);
}

/* Apply persisted actions to the in-memory demo data before any page renders. */
(function applyState() {
  Object.keys(STATE.updatedBooks).forEach(id => {
    const b = bookById(Number(id));
    if (b) Object.assign(b, STATE.updatedBooks[id]);
  });
  Object.keys(STATE.addedCopies).forEach(id => {
    const b = bookById(Number(id));
    if (b) STATE.addedCopies[id].forEach(c => { if (!b.copies.some(x => x.id === c.id)) b.copies.push(c); });
  });
  STATE.addedBooks.forEach(b => { if (!bookById(b.id)) BOOKS.push(b); });
  STATE.addedMembers.forEach(m => { if (!MEMBERS.some(x => x.id === m.id)) MEMBERS.push(m); });
  if (STATE.data) {
    replaceContents(LOANS, STATE.data.loans);
    replaceContents(FINES, STATE.data.fines);
    replaceContents(PENDING_REQUESTS, STATE.data.pending);
    replaceContents(RESERVATIONS, STATE.data.reservations);
    BOOKS.forEach(b => b.copies.forEach(c => { if (STATE.data.copies[c.id]) c.status = STATE.data.copies[c.id]; }));
    DB.seq = STATE.data.seq;
  }
  /* Id counters are taken before removals, so a removed book's id is never reused. */
  LMS.initSeq(DB);
  STATE.removedBookIds.forEach(id => {
    const i = BOOKS.findIndex(b => b.id === id);
    if (i >= 0) BOOKS.splice(i, 1);
  });
  STATE.removedMembers.forEach(removeMemberData);
  MEMBERS.forEach(m => { if (m.id in STATE.suspended) m.suspended = STATE.suspended[m.id]; });
})();


/* ---------- Accounts and session (credentials checked against ACCOUNTS + registered accounts) ---------- */
function allAccounts() { return ACCOUNTS.concat(STATE.accounts).filter(a => !(a.memberId && STATE.removedMembers.includes(a.memberId))); }
function accountRole(acc) {
  return (acc.role === "librarian" || (acc.memberId && STATE.promoted[acc.memberId])) ? "librarian" : "member";
}
function currentAccount() {
  if (!STATE.user || !STATE.user.email) return null;
  return allAccounts().find(a => a.email.toLowerCase() === STATE.user.email.toLowerCase()) || null;
}
function currentRole() { const a = currentAccount(); return a ? accountRole(a) : "guest"; }
function currentMember() {
  const a = currentAccount();
  return (a && a.memberId && MEMBERS.find(m => m.id === a.memberId)) || null;
}
if (STATE.user && !currentAccount()) { STATE.user = null; saveState(); }  /* drop sessions from older demo versions */

/* Business rule (logic.js): a member cannot place a borrow request while suspended,
   with an unpaid fine, or when active loans plus pending requests reach 3. */
function memberEligibility() {
  const record = currentMember();
  return LMS.eligibility(DB, record ? record.id : -1);
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
function unavailableBadge(b) {
  const label = LMS.availabilityLabel(b);
  if (label === "all-on-loan") return `<span class="badge warn">All copies on loan</span>`;
  if (label === "reserved") return `<span class="badge info">Held for a reservation</span>`;
  return `<span class="badge muted">Not available (maintenance)</span>`;
}
function renderCatalog() {
  const cats = [...new Set(BOOKS.map(b => b.category))].sort();
  const catSel = document.getElementById("cat");
  cats.forEach(c => catSel.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));

  function draw() {
    const q = document.getElementById("q").value.trim().toLowerCase();
    const cat = catSel.value;
    const av = document.getElementById("avail").value;
    const rows = LMS.searchBooks(BOOKS, q).filter(b => {
      const nAvail = availableCopies(b);
      return (!cat || b.category === cat) && (!av || (av === "yes") === nAvail > 0);
    });
    document.getElementById("count").textContent =
      `${rows.length} of ${BOOKS.length} titles shown`;
    document.getElementById("rows").innerHTML = rows.map(b => {
      const n = availableCopies(b);
      const badge = n > 0
        ? `<span class="badge ok">${n} of ${b.copies.length} available</span>`
        : unavailableBadge(b);
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
  const role = currentRole();
  const canAct = role === "member";
  const elig = canAct ? memberEligibility() : { ok: false, reasons: [] };
  const me = currentMember();
  const holds = !!me && LOANS.some(l => l.memberId === me.id && !l.returnDate && l.bookId === b.id);
  const queued = !!me && queue.some(r => r.memberId === me.id);
  const requested = !!me && PENDING_REQUESTS.some(r => r.memberId === me.id && r.bookId === b.id);
  const canReserve = canAct && LMS.availabilityLabel(b) === "all-on-loan" && !holds && !queued &&
    LMS.eligibility(DB, me ? me.id : -1, { skipLoanLimit: true }).ok;
  main.innerHTML = `
    <p class="subtitle"><a href="catalog.html">&larr; Back to catalog</a></p>
    <div class="card">
      <h1>${esc(b.title)}</h1>
      <p class="subtitle">${esc(b.author)} - ${esc(b.category)} - ${esc(b.year)} - ISBN ${esc(b.isbn)}</p>
      <p>${nAvail > 0
        ? `<span class="badge ok">${nAvail} of ${b.copies.length} copies available</span>`
        : unavailableBadge(b)}</p>
      <div style="margin-top:18px" ${canAct ? "" : "hidden"}>
        <button class="btn" id="borrow" ${nAvail && elig.ok && !holds && !requested ? "" : "disabled"}>Request to borrow</button>
        <button class="btn secondary" id="reserve" ${canReserve ? "" : "disabled"}>Reserve this book</button>
      </div>
      ${canAct ? "" : `<p class="book-meta">${role === "guest" ? 'Log in as a member to borrow or reserve this book. <a href="login.html">Log in</a>' : "Librarians manage copies and requests from the Librarian Dashboard."}</p>`}
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
  if (canAct && !elig.ok) {
    document.getElementById("action-result").innerHTML =
      `<div class="notice">Borrowing is blocked for this member: ${elig.reasons.join("; ")}.
       Resolve this on the <a href="member.html">member dashboard</a> first.</div>`;
  }
  const show = (res, okText) => {
    if (res.ok) { persistData(); renderBookDetails(); }
    document.getElementById("action-result").innerHTML =
      `<div class="notice${res.ok ? " ok" : ""}">${esc(res.ok ? okText(res) : res.error)}</div>`;
  };
  document.getElementById("borrow").addEventListener("click", () => {
    if (!me) return;
    show(LMS.requestBorrow(DB, me.id, b.id), () =>
      "Borrow request sent. A librarian will review and confirm it; the due date is set at confirmation.");
  });
  document.getElementById("reserve").addEventListener("click", () => {
    if (!me) return;
    show(LMS.reserve(DB, me.id, b.id), r =>
      `You joined the reservation queue at position ${r.reservation.queuePosition}. You will be notified when a copy is returned.`);
  });
}

/* ---------- Member Dashboard ---------- */
function renderMemberDashboard() {
  const MEMBER = currentMember() || { id: -1, name: STATE.user.name || "Member", email: STATE.user.email, joinDate: TODAY };
  const mine = LOANS.filter(l => l.memberId === MEMBER.id && !l.returnDate);
  document.getElementById("profile").innerHTML = `
    <strong>${esc(MEMBER.name)}</strong> (${esc(MEMBER.email)})<br>
    <span class="book-meta">Member since ${MEMBER.joinDate || TODAY} - ${mine.length} active loans</span>`;

  const notices = [];
  mine.forEach(l => {
    const b = bookSafe(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    if (overdueDays(l) > 0) notices.push(`<div class="notice">Overdue: "${esc(b.title)}" was due on ${l.dueDate}. Please return it; fines accrue at ${FINE_PER_DAY} EGP/day.</div>`);
    else if (days <= 3) notices.push(`<div class="notice ok">Reminder: "${esc(b.title)}" is due in ${days} day(s), on ${l.dueDate}.</div>`);
  });
  const elig = memberEligibility();
  if (!elig.ok) notices.unshift(`<div class="notice">Borrowing is currently blocked for this account: ${elig.reasons.join("; ")}.</div>`);
  document.getElementById("notices").innerHTML = notices.join("");

  document.getElementById("loans").innerHTML = mine.map(l => {
    const b = bookSafe(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    const due = overdueDays(l) > 0
      ? `<span class="badge danger">${Math.abs(days)} day(s) late</span>`
      : `<span class="badge info">${days} day(s) left</span>`;
    return `<tr><td><div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)}</div></td>
      <td>${esc(l.copyId)}</td><td>${l.borrowDate}</td><td>${l.dueDate}</td><td>${due}</td>
      <td><a class="btn small secondary" href="return.html?loanId=${l.id}">Return</a></td></tr>`;
  }).join("");

  document.getElementById("fines").innerHTML = FINES.filter(f => f.memberId === MEMBER.id).map(f => {
    const l = LOANS.find(x => x.id === f.loanId);
    const b = bookSafe(l.bookId);
    return `<tr><td>#${f.id}</td><td>"${esc(b.title)}" (loan #${l.id})</td><td>${f.overdueDays}</td>
      <td>${f.amount} EGP</td><td>${f.paid ? '<span class="badge ok">Paid</span>' : '<span class="badge danger">Unpaid</span>'}</td></tr>`;
  }).join("") || `<tr><td colspan="5">No outstanding fines.</td></tr>`;

  document.getElementById("reservations").innerHTML =
    RESERVATIONS.filter(r => r.memberId === MEMBER.id).map(r => {
      const b = bookSafe(r.bookId);
      return `<tr><td><div class="book-title">${esc(b.title)}</div></td><td>${r.date}</td><td>#${r.queuePosition}</td>
        <td><button class="btn small secondary" data-cancel="${r.id}">Cancel</button></td></tr>`;
    }).join("") || `<tr><td colspan="4">No active reservations.</td></tr>`;
  document.getElementById("reservations").onclick = e => {
    const btn = e.target.closest("button[data-cancel]");
    if (!btn) return;
    if (LMS.cancelReservation(DB, Number(btn.dataset.cancel)).ok) { persistData(); renderMemberDashboard(); }
  };
}

/* ---------- Borrowing History ---------- */
function renderHistory() {
  const me = currentMember();
  document.getElementById("history").innerHTML = LOANS.filter(l => me && l.memberId === me.id).slice().reverse().map(l => {
    const b = bookSafe(l.bookId);
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
  const isLib = currentRole() === "librarian";
  const meM = currentMember();
  const mine = () => LOANS.filter(l => !l.returnDate && (isLib || (meM && l.memberId === meM.id)));
  if (isLib) {
    document.querySelector("h1").textContent = "Process Returns";
    document.querySelector(".subtitle").textContent = "Pick a returned loan, check the due date and fine, then confirm the return.";
  }
  const calc = document.getElementById("calc");
  function fillSelect(preferId) {
    const list = mine();
    sel.innerHTML = list.map(l => {
      const b = bookSafe(l.bookId);
      const who = isLib ? ((MEMBERS.find(m => m.id === l.memberId) || {}).name || "Member") + ": " : "";
      return `<option value="${l.id}">${esc(who)}"${esc(b.title)}" (copy ${esc(l.copyId)}, due ${l.dueDate})</option>`;
    }).join("");
    if (preferId && list.some(l => l.id === preferId)) sel.value = String(preferId);
    calc.disabled = list.length === 0;
    if (!list.length) {
      document.getElementById("notice").innerHTML = `<div class="notice">There are no active loans to return.</div>`;
    }
  }
  fillSelect(Number(new URLSearchParams(location.search).get("loanId")));
  document.getElementById("rdate").value = TODAY;

  calc.addEventListener("click", () => {
    const loanId = Number(sel.value);
    const rdate = document.getElementById("rdate").value;
    const p = LMS.previewReturn(DB, loanId, rdate);
    if (!p.ok) {
      document.getElementById("result").innerHTML = `<div class="notice">${esc(p.error)}</div>`;
      return;
    }
    const l = p.loan, late = p.overdueDays, fine = p.fine;
    const b = bookSafe(l.bookId);
    const waiting = RESERVATIONS.filter(r => r.bookId === l.bookId);
    document.getElementById("result").innerHTML = `
      <div class="card">
        <h2>Return summary</h2>
        <table>
          <tr><th>Book</th><td>"${esc(b.title)}" (copy ${esc(l.copyId)})</td></tr>
          <tr><th>Due date</th><td>${l.dueDate}</td></tr>
          <tr><th>Return date</th><td>${esc(rdate)}</td></tr>
          <tr><th>Overdue days</th><td>${late}</td></tr>
          <tr><th>Fine</th><td>${fine ? `<span class="badge danger">${fine} EGP (${late} x ${FINE_PER_DAY} EGP)</span>` : '<span class="badge ok">No fine</span>'}</td></tr>
        </table>
        ${waiting.length ? `<p style="margin-top:12px" class="book-meta">Note: ${waiting.length} member(s) have this book reserved; the copy will be held for the first in the queue.</p>` : ""}
        <div style="margin-top:16px"><button class="btn" id="confirm">Confirm return</button></div>
        <div id="done" style="margin-top:12px"></div>
      </div>`;
    document.getElementById("confirm").addEventListener("click", () => {
      const res = LMS.returnLoan(DB, loanId, rdate);
      if (!res.ok) {
        document.getElementById("done").innerHTML = `<div class="notice">${esc(res.error)}</div>`;
        return;
      }
      persistData();
      document.getElementById("done").innerHTML =
        `<div class="notice ok">Return recorded. ${res.notify ? `The copy is held for ${esc(res.notify.memberName)} (first in the reservation queue)` : "The copy is available again"}${res.fine ? ` and fine #${res.fine.id} of ${res.fine.amount} EGP was added to the member account` : ""}.</div>`;
      document.getElementById("confirm").disabled = true;
      fillSelect();
    });
  });
}

/* ---------- Librarian Dashboard ---------- */
function renderLibrarianDashboard() {
  const noticeEl = document.getElementById("notice");
  const say = (ok, text) => { noticeEl.innerHTML = `<div class="notice${ok ? " ok" : ""}">${esc(text)}</div>`; };

  function drawStats() {
    const activeLoans = LOANS.filter(l => !l.returnDate);
    const overdueLoans = activeLoans.filter(l => overdueDays(l) > 0);
    document.getElementById("stats").innerHTML = [
      { num: BOOKS.length, lbl: "Titles" },
      { num: PENDING_REQUESTS.length, lbl: "Pending requests" },
      { num: activeLoans.length, lbl: "Active loans" },
      { num: overdueLoans.length, lbl: "Overdue loans" }
    ].map(s => `<div class="stat"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join("");
    document.getElementById("overdue").innerHTML = overdueLoans.map(l => {
      const b = bookSafe(l.bookId);
      return `<tr><td>#${l.id}</td><td>"${esc(b.title)}"</td><td>${l.dueDate}</td>
        <td>${overdueDays(l)}</td><td><span class="badge danger">${loanFine(l)} EGP</span></td></tr>`;
    }).join("") || `<tr><td colspan="5">No overdue loans.</td></tr>`;
  }

  /* Pending requests: Confirm creates the loan, Reject removes the request. */
  const reqEl = document.getElementById("requests");
  function drawRequests() {
    reqEl.innerHTML = PENDING_REQUESTS.map(r => {
      const b = bookSafe(r.bookId);
      const bookCell = `<div class="book-title">${esc(b.title)}</div><div class="book-meta">${esc(b.author)}</div>`;
      return `<tr><td>#${r.id}</td><td>${esc(r.memberName)}</td><td>${bookCell}</td><td>${r.date}</td>
        <td><button class="btn small" data-act="ok" data-id="${r.id}">Confirm</button>
            <button class="btn small danger" data-act="no" data-id="${r.id}">Reject</button></td></tr>`;
    }).join("") || `<tr><td colspan="5">No pending requests.</td></tr>`;
  }
  reqEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.act === "ok") {
      const res = LMS.confirmRequest(DB, id);
      if (res.ok) say(true, `Request #${id} confirmed. Loan #${res.loan.id} created: copy ${res.loan.copyId}, due ${res.loan.dueDate}.`);
      else say(false, res.error);
    } else {
      const res = LMS.rejectRequest(DB, id);
      say(res.ok, res.ok ? `Request #${id} rejected.` : res.error);
    }
    persistData();
    refreshAll();
  });

  /* Unpaid fines: the librarian records the payment taken at the desk. */
  const fineEl = document.getElementById("fines");
  function drawFines() {
    fineEl.innerHTML = FINES.filter(f => !f.paid).map(f => {
      const m = MEMBERS.find(x => x.id === f.memberId);
      const l = LOANS.find(x => x.id === f.loanId);
      const b = l ? bookSafe(l.bookId) : null;
      return `<tr><td>#${f.id}</td><td>${esc(m ? m.name : "Member #" + f.memberId)}</td>
        <td>${b ? `"${esc(b.title)}" (loan #${l.id})` : "-"}</td><td>${f.amount} EGP</td>
        <td><button class="btn small" data-pay="${f.id}">Record payment</button></td></tr>`;
    }).join("") || `<tr><td colspan="5">No unpaid fines.</td></tr>`;
  }
  fineEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-pay]");
    if (!btn) return;
    const res = LMS.payFine(DB, Number(btn.dataset.pay));
    say(res.ok, res.ok ? `Fine #${res.fine.id} (${res.fine.amount} EGP) marked as paid.` : res.error);
    persistData();
    refreshAll();
  });

  /* Catalog management: add, update, remove books and register copies. */
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
  function newCopy(book) {
    return { id: `C${book.id}-${book.copies.length + 1}`, status: "available", location: "Intake" };
  }

  document.getElementById("addbook").addEventListener("click", () => {
    const data = readForm();
    if (!data.title) { say(false, "Enter a book title."); return; }
    if (editingId) {
      const b = bookById(editingId);
      if (b) {
        const patch = { title: data.title, author: data.author || "Unknown", category: data.category || "General" };
        Object.assign(b, patch);
        STATE.updatedBooks[editingId] = patch;
        const added = STATE.addedBooks.find(x => x.id === editingId);
        if (added) Object.assign(added, patch);
        saveState();
        say(true, `"${data.title}" updated.`);
      }
      clearForm();
    } else {
      const res = LMS.addBook(DB, data);
      STATE.addedBooks.push(res.book);
      persistData();
      say(true, `"${res.book.title}" added to the catalog with ${res.book.copies.length} cop(y/ies).`);
    }
    refreshAll();
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
      const c = newCopy(b);
      b.copies.push(c);
      STATE.addedCopies[id] = (STATE.addedCopies[id] || []).concat(c);
      const added = STATE.addedBooks.find(x => x.id === id);
      if (added && !added.copies.includes(c)) added.copies.push(c);
      persistData();
      refreshAll();
    } else if (btn.dataset.op === "remove") {
      const res = LMS.removeBook(DB, id);
      if (!res.ok) { say(false, `"${b.title}": ${res.error}`); return; }
      if (!STATE.removedBookIds.includes(id)) STATE.removedBookIds.push(id);
      delete STATE.updatedBooks[id];
      delete STATE.addedCopies[id];
      persistData();
      say(true, `"${b.title}" removed from the catalog.`);
      refreshAll();
    }
  });

  function drawReservations() {
    document.getElementById("reservations").innerHTML = RESERVATIONS.map(r => {
      const b = bookSafe(r.bookId);
      return `<tr><td><div class="book-title">${esc(b.title)}</div></td><td>${esc(r.memberName)}</td>
        <td>${r.date}</td><td>#${r.queuePosition}</td></tr>`;
    }).join("") || `<tr><td colspan="4">No active reservations.</td></tr>`;
  }
  function refreshAll() { drawStats(); drawRequests(); drawFines(); drawCatalog(); drawReservations(); }
  refreshAll();
}


/* ---------- Members page (librarian only): suspend, promote to librarian ---------- */
function renderMembersPage() {
  const memEl = document.getElementById("members");
  const staffEl = document.getElementById("staff");
  function draw() {
    memEl.innerHTML = MEMBERS.map(m => {
      const acc = allAccounts().find(x => x.memberId === m.id);
      const isLib = acc && STATE.promoted[m.id];
      const loans = LOANS.filter(l => l.memberId === m.id && !l.returnDate).length;
      const fines = FINES.filter(f => f.memberId === m.id && !f.paid).reduce((s, f) => s + f.amount, 0);
      return `<tr><td><div class="book-title">${esc(m.name)}</div></td><td>${esc(m.email)}</td>
       <td>${loans}</td><td>${fines ? fines + " EGP" : "-"}</td>
       <td>${m.suspended ? '<span class="badge danger">Suspended</span>' : '<span class="badge ok">Active</span>'}${isLib ? ' <span class="badge info">Librarian</span>' : ""}</td>
       <td><button class="btn small secondary" data-suspend="${m.id}">${m.suspended ? "Reactivate" : "Suspend"}</button>
       ${acc && !isLib ? `<button class="btn small" data-promote="${m.id}">Make librarian</button>` : ""}
       ${isLib ? `<button class="btn small danger" data-demote="${m.id}">Remove librarian role</button>` : `<button class="btn small danger" data-remove="${m.id}">Remove member</button>`}</td></tr>`;
    }).join("");
    staffEl.innerHTML = allAccounts().filter(x => accountRole(x) === "librarian").map(x =>
      `<tr><td><div class="book-title">${esc(x.name)}</div></td><td>${esc(x.email)}</td>
       <td>${x.role === "librarian" ? "Librarian" : "Promoted member"}</td></tr>`).join("");
  }
  draw();
  memEl.addEventListener("click", e => {
    const s = e.target.closest("button[data-suspend]");
    const p = e.target.closest("button[data-promote]");
    const d = e.target.closest("button[data-demote]");
    const r = e.target.closest("button[data-remove]");
    if (r) {
      const id = Number(r.dataset.remove);
      const m = MEMBERS.find(x => x.id === id);
      const loans = LOANS.filter(l => l.memberId === id && !l.returnDate).length;
      const fines = FINES.filter(f => f.memberId === id && !f.paid).reduce((t, f) => t + f.amount, 0);
      const msg = document.getElementById("members-msg");
      if (loans || fines) {
        msg.innerHTML = `<div class="notice">${esc(m.name)} cannot be removed: ${[loans ? loans + " active loan(s)" : "", fines ? fines + " EGP unpaid fines" : ""].filter(Boolean).join(" and ")}. Resolve them first.</div>`;
        return;
      }
      if (!confirm("Remove " + m.name + " permanently? Their account, reservations and loan history are deleted.")) return;
      removeMemberData(id);
      persistData();
      STATE.removedMembers.push(id);
      STATE.addedMembers = STATE.addedMembers.filter(x => x.id !== id);
      delete STATE.promoted[id];
      saveState();
      msg.innerHTML = `<div class="notice ok">${esc(m.name)} was removed.</div>`;
      draw();
      return;
    }
    if (s) {
      const m = MEMBERS.find(x => x.id === Number(s.dataset.suspend));
      m.suspended = !m.suspended;
      STATE.suspended[m.id] = m.suspended;
    } else if (p) {
      STATE.promoted[Number(p.dataset.promote)] = true;
    } else if (d) {
      const own = currentAccount();
      if (own && own.memberId === Number(d.dataset.demote)) {
        document.getElementById("members-msg").innerHTML = `<div class="notice">You cannot remove your own librarian role while logged in.</div>`;
        return;
      }
      delete STATE.promoted[Number(d.dataset.demote)];
    } else return;
    saveState();
    draw();
  });
}

/* ---------- Login / Register ---------- */
const HOME_BY_ROLE = { member: "member.html", librarian: "librarian.html" };
function renderLoginPage() {
  const showCard = which => {
    document.getElementById("login-card").hidden = which !== "login";
    document.getElementById("register-card").hidden = which !== "register";
    document.title = which === "register" ? "City Library - Register" : "City Library - Login";
  };
  const fromHash = () => showCard(location.hash === "#register" ? "register" : "login");
  window.addEventListener("hashchange", fromHash);
  fromHash();
  document.getElementById("google-btn").addEventListener("click", () => {
    document.getElementById("login-msg").innerHTML = `<div class="notice">Google sign-in is not available yet. Please use your email and password.</div>`;
  });
  const acc0 = currentAccount();
  if (acc0) {
    const r = accountRole(acc0);
    document.getElementById("login-msg").innerHTML =
      `<div class="notice ok">Already logged in as ${esc(acc0.name)} (${r}). Go to your <a href="${HOME_BY_ROLE[r]}">${r} dashboard</a>.</div>`;
  }
  document.getElementById("google-btn-reg").addEventListener("click", () => {
    document.getElementById("register-msg").innerHTML = `<div class="notice">Google sign-up is not available yet. Please register with your email and password.</div>`;
  });
  document.getElementById("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("lemail").value.trim().toLowerCase();
    const pass = document.getElementById("lpass").value;
    const acc = allAccounts().find(a => a.email.toLowerCase() === email && a.password === pass);
    if (!acc) {
      document.getElementById("login-msg").innerHTML = `<div class="notice">Wrong email or password.</div>`;
      return;
    }
    STATE.user = { email: acc.email, name: acc.name };
    saveState();
    window.location.href = HOME_BY_ROLE[accountRole(acc)];
  });
  document.getElementById("register-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("rname").value.trim();
    const email = document.getElementById("remail").value.trim().toLowerCase();
    const pass = document.getElementById("rpass").value;
    const msg = document.getElementById("register-msg");
    if (!name) { msg.innerHTML = `<div class="notice">Please enter your full name.</div>`; return; }
    if (pass.length < 6) { msg.innerHTML = `<div class="notice">Password must be at least 6 characters.</div>`; return; }
    if (allAccounts().some(a => a.email.toLowerCase() === email)) { msg.innerHTML = `<div class="notice">An account with this email already exists.</div>`; return; }
    const id = Math.max(199, ...STATE.removedMembers, ...MEMBERS.map(m => m.id)) + 1;
    const rec = { id: id, name: name, email: email, joinDate: TODAY, activeLoans: 0, unpaidFines: 0, suspended: false };
    STATE.addedMembers.push(rec);
    STATE.accounts.push({ email: email, password: pass, name: name, role: "member", memberId: id });
    STATE.user = { email: email, name: name };
    saveState();
    window.location.href = HOME_BY_ROLE.member;
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

/* Liveliness: count-up stats, scroll reveal, first-render row stagger.
   Skipped entirely when the user prefers reduced motion. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  function countUp(el) {
    var target = parseInt(el.textContent.replace(/[^\d-]/g, ""), 10);
    if (isNaN(target)) return;
    var t0 = performance.now(), dur = 750;
    requestAnimationFrame(function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * easeOut(p));
      if (p < 1) requestAnimationFrame(tick);
    });
  }
  var counted = new WeakSet();
  function scanStats(root) {
    root.querySelectorAll(".stat .num").forEach(function (el) {
      if (!counted.has(el)) { counted.add(el); countUp(el); }
    });
  }
  scanStats(document);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && n.querySelectorAll) scanStats(n); });
    });
  }).observe(document.body, { childList: true, subtree: true });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: .12 });
  document.querySelectorAll(".grid > *").forEach(function (el, i) {
    el.classList.add("rv");
    el.style.transitionDelay = (i % 6) * 55 + "ms";
    io.observe(el);
  });

  new MutationObserver(function () {
    document.querySelectorAll("tbody").forEach(function (tb) {
      if (tb.dataset.staggered || !tb.rows.length) return;
      tb.dataset.staggered = "1";
      Array.prototype.slice.call(tb.rows, 0, 12).forEach(function (r, i) {
        r.classList.add("row-in");
        r.style.animationDelay = i * 45 + "ms";
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();


/* Claude color + motion round: pointer spotlight + search swap-in */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('.grid .card, .stat'); if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();   /* delegated, so live-search re-renders keep working */

(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  new MutationObserver(muts => {
    if (performance.now() - t0 < 800) return;          /* leave first render to your stagger/reveal */
    muts.forEach(m => { let i = 0;
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1 || !n.matches('.card, tbody tr, li')) return;
        n.style.setProperty('--i', i++); n.classList.add('swap-in');
        n.addEventListener('animationend', () => n.classList.remove('swap-in'), { once: true });
      });
    });
  }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
})();

/* Press "/" anywhere to jump to the catalog search field. */
addEventListener('keydown', function (e) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  var s = document.getElementById('q');
  if (s) { e.preventDefault(); s.focus(); s.select(); }
});

/* ---------- Role-based navigation, page guard and logout ---------- */
(function () {
  const NAV = {
    guest: [["index.html", "Home"], ["catalog.html", "Book Catalog"], ["login.html", "Login"]],
    member: [["index.html", "Home"], ["catalog.html", "Book Catalog"], ["member.html", "My Dashboard"],
             ["history.html", "Borrowing History"], ["return.html", "Return Book"]],
    librarian: [["index.html", "Home"], ["catalog.html", "Book Catalog"], ["librarian.html", "Librarian Dashboard"],
                ["members.html", "Members"], ["return.html", "Process Returns"]]
  };
  const role = currentRole();
  const page = location.pathname.split("/").pop() || "index.html";
  const ALLOWED = { "member.html": ["member"], "history.html": ["member"],
                    "librarian.html": ["librarian"], "members.html": ["librarian"], "return.html": ["member", "librarian"] };
  if (ALLOWED[page] && !ALLOWED[page].includes(role)) {
    document.documentElement.style.display = "none";
    window.location.replace(role === "guest" ? "login.html" : HOME_BY_ROLE[role]);
    return;
  }
  const dl = document.getElementById("dash-link");
  if (dl && role !== "guest") { dl.href = HOME_BY_ROLE[role]; dl.textContent = "Go to my dashboard"; }
  const nav = document.querySelector(".main-nav");
  if (!nav) return;
  nav.innerHTML = NAV[role].map(([href, label]) =>
    `<a href="${href}"${href === page ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("");
  if (STATE.user) {
    const btn = document.createElement("a");
    btn.href = "login.html";
    btn.id = "logout-btn";
    btn.textContent = "Logout (" + STATE.user.name + ", " + role + ")";
    btn.addEventListener("click", e => {
      e.preventDefault();
      STATE.user = null;
      saveState();
      window.location.href = "login.html";
    });
    nav.appendChild(btn);
  }
})();
