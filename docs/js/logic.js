/* Business logic for the Library Management System demo.
   Pure functions over a plain data object `db` (BOOKS, LOANS, FINES, PENDING_REQUESTS,
   RESERVATIONS, MEMBERS, TODAY, FINE_PER_DAY). No DOM access, so it runs in the browser
   and in Node (see tests/logic.test.cjs). Every action returns { ok, error?, ... }. */
(function (root) {
  const LOAN_DAYS = 14;
  const MAX_LOANS = 3;

  function parseDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + "T00:00:00Z");
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
  }
  function addDays(s, n) {
    const d = parseDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }

  /* Monotonic id counters. They live on db.seq and only ever go up, so an id that was
     removed (a book, a loan of a removed member) is never handed out again. */
  function initSeq(db) {
    const max = arr => arr.reduce((m, x) => Math.max(m, x.id), 0);
    const s = db.seq || (db.seq = {});
    s.book = Math.max(s.book || 0, max(db.BOOKS));
    s.loan = Math.max(s.loan || 0, max(db.LOANS));
    s.fine = Math.max(s.fine || 0, max(db.FINES));
    s.request = Math.max(s.request || 0, max(db.PENDING_REQUESTS));
    s.reservation = Math.max(s.reservation || 0, max(db.RESERVATIONS));
    return s;
  }
  function nextId(db, kind) { return ++initSeq(db)[kind]; }

  const fail = error => ({ ok: false, error: error });
  const bookOf = (db, id) => db.BOOKS.find(b => b.id === id);
  const memberOf = (db, id) => db.MEMBERS.find(m => m.id === id);
  const openLoans = (db, memberId) => db.LOANS.filter(l => l.memberId === memberId && !l.returnDate);
  const pendingOf = (db, memberId) => db.PENDING_REQUESTS.filter(r => r.memberId === memberId);

  /* Rules: not suspended, no unpaid fine, and fewer than 3 loans (active plus pending). */
  function eligibility(db, memberId, opts) {
    const o = opts || {};
    const reasons = [];
    const m = memberOf(db, memberId);
    if (!m) return { ok: false, reasons: ["member not found"] };
    if (m.suspended) reasons.push("account suspended");
    if (db.FINES.some(f => f.memberId === memberId && !f.paid)) reasons.push("unpaid fine");
    if (!o.skipLoanLimit) {
      const active = openLoans(db, memberId).length;
      const pending = o.countPending === false ? 0 : pendingOf(db, memberId).length;
      if (active + pending >= MAX_LOANS) {
        reasons.push(`${active} active loan(s) and ${pending} pending (limit ${MAX_LOANS})`);
      }
    }
    return { ok: reasons.length === 0, reasons: reasons };
  }

  function availableCopies(book) { return book.copies.filter(c => c.status === "available"); }

  /* Why a book with no available copy cannot be borrowed, in words. */
  function availabilityLabel(book) {
    if (availableCopies(book).length > 0) return "available";
    if (book.copies.some(c => c.status === "on-loan")) return "all-on-loan";
    if (book.copies.some(c => c.status === "reserved")) return "reserved";
    return "unavailable";
  }

  function requestBorrow(db, memberId, bookId) {
    const book = bookOf(db, bookId);
    const m = memberOf(db, memberId);
    if (!book || !m) return fail("Unknown book or member.");
    const e = eligibility(db, memberId);
    if (!e.ok) return fail("Borrow request blocked: " + e.reasons.join("; ") + ".");
    if (openLoans(db, memberId).some(l => l.bookId === bookId)) return fail("You already hold a copy of this book.");
    if (db.PENDING_REQUESTS.some(r => r.memberId === memberId && r.bookId === bookId)) return fail("You already have a pending request for this book.");
    const free = availableCopies(book).length - db.PENDING_REQUESTS.filter(r => r.bookId === bookId).length;
    if (free <= 0) return fail("No copy is free for a new request (available copies are already requested).");
    const req = { id: nextId(db, "request"), memberId: memberId, memberName: m.name, bookId: bookId, date: db.TODAY };
    db.PENDING_REQUESTS.push(req);
    return { ok: true, request: req };
  }

  function renumberQueue(db, bookId) {
    db.RESERVATIONS.filter(r => r.bookId === bookId)
      .sort((a, b) => a.queuePosition - b.queuePosition || a.id - b.id)
      .forEach((r, i) => { r.queuePosition = i + 1; });
  }

  function reserve(db, memberId, bookId) {
    const book = bookOf(db, bookId);
    const m = memberOf(db, memberId);
    if (!book || !m) return fail("Unknown book or member.");
    const e = eligibility(db, memberId, { skipLoanLimit: true });
    if (!e.ok) return fail("Reservation blocked: " + e.reasons.join("; ") + ".");
    if (availableCopies(book).length > 0) return fail("A copy is available, so request to borrow it instead.");
    if (!book.copies.some(c => c.status === "on-loan")) return fail("This book has no copy on loan, so it cannot be reserved.");
    if (openLoans(db, memberId).some(l => l.bookId === bookId)) return fail("You already hold a copy of this book.");
    if (db.RESERVATIONS.some(r => r.memberId === memberId && r.bookId === bookId)) return fail("You are already in the queue for this book.");
    const pos = db.RESERVATIONS.filter(r => r.bookId === bookId).length + 1;
    const r = { id: nextId(db, "reservation"), memberId: memberId, memberName: m.name, bookId: bookId, date: db.TODAY, queuePosition: pos };
    db.RESERVATIONS.push(r);
    return { ok: true, reservation: r };
  }

  function cancelReservation(db, reservationId) {
    const i = db.RESERVATIONS.findIndex(r => r.id === reservationId);
    if (i < 0) return fail("Reservation not found.");
    const bookId = db.RESERVATIONS[i].bookId;
    db.RESERVATIONS.splice(i, 1);
    renumberQueue(db, bookId);
    /* A held copy goes back on the shelf when nobody is waiting any more. */
    const book = bookOf(db, bookId);
    if (book && !db.RESERVATIONS.some(r => r.bookId === bookId)) {
      const held = book.copies.find(c => c.status === "reserved");
      if (held) held.status = "available";
    }
    return { ok: true };
  }

  function rejectRequest(db, requestId) {
    const i = db.PENDING_REQUESTS.findIndex(r => r.id === requestId);
    if (i < 0) return fail("Request not found.");
    const r = db.PENDING_REQUESTS.splice(i, 1)[0];
    return { ok: true, request: r };
  }

  /* Librarian confirms a request: re-check member and copy, then create the loan. */
  function confirmRequest(db, requestId) {
    const req = db.PENDING_REQUESTS.find(r => r.id === requestId);
    if (!req) return fail("Request not found.");
    const book = bookOf(db, req.bookId);
    if (!book) return fail("The requested book no longer exists. Reject the request.");
    const e = eligibility(db, req.memberId, { countPending: false });
    if (!e.ok) return fail("Cannot confirm: " + e.reasons.join("; ") + ". Reject it or resolve this first.");
    const copy = availableCopies(book)[0];
    if (!copy) return fail("Cannot confirm: no copy of this book is available.");
    copy.status = "on-loan";
    const loan = { memberId: req.memberId, id: nextId(db, "loan"), bookId: req.bookId, copyId: copy.id,
      borrowDate: db.TODAY, dueDate: addDays(db.TODAY, LOAN_DAYS), returnDate: null, status: "active" };
    db.LOANS.push(loan);
    db.PENDING_REQUESTS.splice(db.PENDING_REQUESTS.indexOf(req), 1);
    /* The member no longer waits in the queue for a book they now hold. */
    const q = db.RESERVATIONS.find(r => r.memberId === req.memberId && r.bookId === req.bookId);
    if (q) cancelReservation(db, q.id);
    return { ok: true, loan: loan };
  }

  /* Pure preview used by the Return page before the librarian confirms. */
  function previewReturn(db, loanId, returnDate) {
    const loan = db.LOANS.find(l => l.id === loanId);
    if (!loan) return fail("Loan not found.");
    if (loan.returnDate) return fail("This loan was already returned.");
    if (!parseDate(returnDate)) return fail("Enter a valid return date.");
    if (daysBetween(loan.borrowDate, returnDate) < 0) return fail("The return date cannot be before the borrow date (" + loan.borrowDate + ").");
    const late = Math.max(0, daysBetween(loan.dueDate, returnDate));
    return { ok: true, loan: loan, overdueDays: late, fine: late * db.FINE_PER_DAY };
  }

  function returnLoan(db, loanId, returnDate) {
    const p = previewReturn(db, loanId, returnDate);
    if (!p.ok) return p;
    const loan = p.loan;
    loan.returnDate = returnDate;
    loan.status = "returned";
    let fine = null;
    if (p.fine > 0) {
      fine = { id: nextId(db, "fine"), memberId: loan.memberId, loanId: loan.id, overdueDays: p.overdueDays, amount: p.fine, paid: false };
      db.FINES.push(fine);
    }
    const book = bookOf(db, loan.bookId);
    const copy = book && book.copies.find(c => c.id === loan.copyId);
    const queue = db.RESERVATIONS.filter(r => r.bookId === loan.bookId).sort((a, b) => a.queuePosition - b.queuePosition);
    if (copy) copy.status = queue.length ? "reserved" : "available";
    return { ok: true, loan: loan, fine: fine, notify: queue.length ? queue[0] : null };
  }

  function payFine(db, fineId) {
    const f = db.FINES.find(x => x.id === fineId);
    if (!f) return fail("Fine not found.");
    if (f.paid) return fail("This fine is already paid.");
    f.paid = true;
    return { ok: true, fine: f };
  }

  /* A book cannot be removed while a copy is out, requested or reserved. */
  function canRemoveBook(db, bookId) {
    const reasons = [];
    const open = db.LOANS.filter(l => l.bookId === bookId && !l.returnDate).length;
    const pending = db.PENDING_REQUESTS.filter(r => r.bookId === bookId).length;
    const queued = db.RESERVATIONS.filter(r => r.bookId === bookId).length;
    if (open) reasons.push(open + " open loan(s)");
    if (pending) reasons.push(pending + " pending request(s)");
    if (queued) reasons.push(queued + " reservation(s)");
    return { ok: reasons.length === 0, reasons: reasons };
  }

  function removeBook(db, bookId) {
    const i = db.BOOKS.findIndex(b => b.id === bookId);
    if (i < 0) return fail("Book not found.");
    const c = canRemoveBook(db, bookId);
    if (!c.ok) return fail("Cannot remove: " + c.reasons.join(", ") + ".");
    initSeq(db); /* remember the highest id before it disappears */
    db.BOOKS.splice(i, 1);
    return { ok: true };
  }

  function addBook(db, data) {
    const title = (data.title || "").trim();
    if (!title) return fail("Enter a book title.");
    const id = nextId(db, "book");
    const n = Math.max(1, Number(data.copies) || 1);
    const book = { id: id, title: title, author: (data.author || "").trim() || "Unknown",
      category: (data.category || "").trim() || "General", isbn: "pending", year: 2026, copies: [] };
    for (let i = 0; i < n; i++) book.copies.push({ id: `C${id}-${i + 1}`, status: "available", location: "Intake" });
    db.BOOKS.push(book);
    return { ok: true, book: book };
  }

  /* Search over title, author, category and ISBN. Every word must match somewhere. */
  function searchBooks(books, query) {
    const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
    return books.filter(b => {
      const hay = `${b.title} ${b.author} ${b.category} ${b.isbn}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }

  const api = { LOAN_DAYS, MAX_LOANS, parseDate, addDays, daysBetween, initSeq, eligibility, availableCopies,
    availabilityLabel, requestBorrow, reserve, cancelReservation, rejectRequest, confirmRequest, previewReturn,
    returnLoan, payFine, canRemoveBook, removeBook, addBook, searchBooks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LMS = api;
})(typeof window !== "undefined" ? window : globalThis);
