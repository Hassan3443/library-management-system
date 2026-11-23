/* Page renderers for the Library Management System front end demo. */

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
  cats.forEach(c => catSel.insertAdjacentHTML("beforeend", `<option>${c}</option>`));

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
        <td><div class="book-cover">${b.title[0]}</div></td>
        <td><div class="book-title">${b.title}</div><div class="book-meta">ISBN ${b.isbn} - ${b.year}</div></td>
        <td>${b.author}</td><td>${b.category}</td><td>${badge}</td>
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
  main.innerHTML = `
    <p class="subtitle"><a href="catalog.html">&larr; Back to catalog</a></p>
    <div class="card">
      <h1>${b.title}</h1>
      <p class="subtitle">${b.author} - ${b.category} - ${b.year} - ISBN ${b.isbn}</p>
      <p>${nAvail > 0
        ? `<span class="badge ok">${nAvail} of ${b.copies.length} copies available</span>`
        : `<span class="badge warn">All copies on loan</span>`}</p>
      <div style="margin-top:18px">
        <button class="btn" id="borrow" ${nAvail ? "" : "disabled"}>Request to borrow (FR-05)</button>
        <button class="btn secondary" id="reserve" ${nAvail ? "disabled" : ""}>Reserve this book (FR-09)</button>
      </div>
      <div id="action-result" style="margin-top:14px"></div>
    </div>
    <h2>Copies</h2>
    <div class="card" style="padding:0; overflow:auto">
      <table>
        <thead><tr><th>Copy</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>${b.copies.map(c =>
          `<tr><td>${c.id}</td><td>${c.location}</td><td>${statusBadge(c.status)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${queue.length ? `<h2>Reservation queue</h2>
    <div class="card"><p>${queue.length} member(s) waiting. First in queue: ${queue[0].memberName} (since ${queue[0].date}).</p></div>` : ""}
  `;
  document.getElementById("borrow").addEventListener("click", () => {
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
    <strong>${MEMBER.name}</strong> (${MEMBER.email})<br>
    <span class="book-meta">Member since ${MEMBER.joinDate} - ${mine.length} active loans</span>`;

  const notices = [];
  mine.forEach(l => {
    const b = bookById(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    if (l.status === "overdue") notices.push(`<div class="notice">Overdue: "${b.title}" was due on ${l.dueDate}. Please return it; fines accrue at ${FINE_PER_DAY} EGP/day (FR-11).</div>`);
    else if (days <= 3) notices.push(`<div class="notice ok">Reminder: "${b.title}" is due in ${days} day(s), on ${l.dueDate} (FR-11).</div>`);
  });
  document.getElementById("notices").innerHTML = notices.join("");

  document.getElementById("loans").innerHTML = mine.map(l => {
    const b = bookById(l.bookId);
    const days = daysBetween(TODAY, l.dueDate);
    const due = l.status === "overdue"
      ? `<span class="badge danger">${Math.abs(days)} day(s) late</span>`
      : `<span class="badge info">${days} day(s) left</span>`;
    return `<tr><td><div class="book-title">${b.title}</div><div class="book-meta">${b.author}</div></td>
      <td>${l.copyId}</td><td>${l.borrowDate}</td><td>${l.dueDate}</td><td>${due}</td>
      <td><a class="btn small secondary" href="return.html">Return</a></td></tr>`;
  }).join("");

  document.getElementById("fines").innerHTML = FINES.map(f => {
    const l = LOANS.find(x => x.id === f.loanId);
    const b = bookById(l.bookId);
    return `<tr><td>#${f.id}</td><td>"${b.title}" (loan #${l.id})</td><td>${f.overdueDays}</td>
      <td>${f.amount} EGP</td><td>${f.paid ? '<span class="badge ok">Paid</span>' : '<span class="badge danger">Unpaid</span>'}</td></tr>`;
  }).join("") || `<tr><td colspan="5">No outstanding fines.</td></tr>`;

  document.getElementById("reservations").innerHTML =
    RESERVATIONS.filter(r => r.memberId === MEMBER.id).map(r => {
      const b = bookById(r.bookId);
      return `<tr><td><div class="book-title">${b.title}</div></td><td>${r.date}</td><td>#${r.queuePosition}</td></tr>`;
    }).join("") || `<tr><td colspan="3">No active reservations.</td></tr>`;
}

/* ---------- Borrowing History ---------- */
function renderHistory() {
  document.getElementById("history").innerHTML = LOANS.slice().reverse().map(l => {
    const b = bookById(l.bookId);
    const fine = l.returnDate ? loanFine(l) : 0;
    return `<tr><td>#${l.id}</td>
      <td><div class="book-title">${b.title}</div><div class="book-meta">${b.author}</div></td>
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
    return `<option value="${l.id}">"${b.title}" (copy ${l.copyId}, due ${l.dueDate})</option>`;
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
          <tr><th>Book</th><td>"${b.title}" (copy ${l.copyId})</td></tr>
          <tr><th>Due date</th><td>${l.dueDate}</td></tr>
          <tr><th>Return date</th><td>${rdate}</td></tr>
          <tr><th>Overdue days</th><td>${late}</td></tr>
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

  document.getElementById("requests").innerHTML = PENDING_REQUESTS.map((r, i) => {
    const b = bookById(r.bookId);
    return `<tr><td>#${r.id}</td><td>${r.memberName}</td>
      <td><div class="book-title">${b.title}</div><div class="book-meta">${b.author}</div></td>
      <td>${r.date}</td>
      <td><button class="btn small" data-act="ok" data-i="${i}">Confirm</button>
          <button class="btn small danger" data-act="no" data-i="${i}">Reject</button></td></tr>`;
  }).join("");
  document.getElementById("requests").addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const r = PENDING_REQUESTS[Number(btn.dataset.i)];
    const b = bookById(r.bookId);
    btn.closest("tr").innerHTML = `<td colspan="5">${btn.dataset.act === "ok"
      ? `<span class="badge ok">Confirmed</span> Loan recorded for "${b.title}", due in 14 days (FR-14).`
      : `<span class="badge muted">Rejected</span> The member was notified.`}</td>`;
  });

  document.getElementById("overdue").innerHTML = overdueLoans.map(l => {
    const b = bookById(l.bookId);
    const days = overdueDays(l);
    return `<tr><td>#${l.id}</td><td>"${b.title}"</td><td>${l.dueDate}</td>
      <td>${days}</td><td><span class="badge danger">${loanFine(l)} EGP</span></td></tr>`;
  }).join("") || `<tr><td colspan="5">No overdue loans.</td></tr>`;

  document.getElementById("addbook").addEventListener("click", () => {
    const t = document.getElementById("bt").value.trim();
    if (!t) return;
    const b = {
      id: Math.max(...BOOKS.map(x => x.id)) + 1,
      title: t,
      author: document.getElementById("ba").value.trim() || "Unknown",
      category: document.getElementById("bc").value.trim() || "General",
      isbn: "pending", year: 2026,
      copies: Array.from({ length: Number(document.getElementById("bn").value) || 1 },
        (_, i) => ({ id: `C${BOOKS.length + 1}-${i + 1}`, status: "available", location: "Intake" }))
    };
    BOOKS.push(b);
    document.getElementById("notice").innerHTML =
      `<div class="notice ok">"${b.title}" added to the catalog with ${b.copies.length} cop(y/ies) (FR-12, FR-13).</div>`;
  });

  document.getElementById("members").innerHTML = MEMBERS.map(m =>
    `<tr><td><div class="book-title">${m.name}</div></td><td>${m.email}</td>
     <td>${m.activeLoans}</td><td>${m.unpaidFines ? m.unpaidFines + " EGP" : "-"}</td>
     <td>${m.suspended ? '<span class="badge danger">Suspended</span>' : '<span class="badge ok">Active</span>'}</td></tr>`).join("");

  document.getElementById("reservations").innerHTML = RESERVATIONS.map(r => {
    const b = bookById(r.bookId);
    return `<tr><td><div class="book-title">${b.title}</div></td><td>${r.memberName}</td>
      <td>${r.date}</td><td>#${r.queuePosition}</td></tr>`;
  }).join("");
}
