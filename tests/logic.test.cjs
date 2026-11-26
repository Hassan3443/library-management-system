/* Regression tests for docs/js/logic.js. Run: node tests/logic.test.cjs */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const L = require("../docs/js/logic.js");

/* Fresh copy of the seed data for every test. */
function freshDb() {
  const src = fs.readFileSync(path.join(__dirname, "../docs/js/data.js"), "utf8");
  return new Function(src + "; return { BOOKS, LOANS, FINES, PENDING_REQUESTS, RESERVATIONS, MEMBERS, TODAY, FINE_PER_DAY };")();
}
const book = (db, id) => db.BOOKS.find(b => b.id === id);
const copy = (db, id) => db.BOOKS.flatMap(b => b.copies).find(c => c.id === id);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/* ---- BUG-01: confirming a return changes state ---- */
test("return on time closes the loan and frees the copy", () => {
  const db = freshDb();
  const r = L.returnLoan(db, 504, "2026-11-23"); /* Sara, book 2, copy C2-2, due 2026-11-30 */
  assert(r.ok);
  const loan = db.LOANS.find(l => l.id === 504);
  assert.strictEqual(loan.returnDate, "2026-11-23");
  assert.strictEqual(loan.status, "returned");
  assert.strictEqual(copy(db, "C2-2").status, "available");
  assert.strictEqual(r.fine, null);
  assert.strictEqual(L.availabilityLabel(book(db, 2)), "available");
});
test("late return records a fine of 5 EGP per day", () => {
  const db = freshDb();
  const r = L.returnLoan(db, 501, "2026-11-23"); /* due 2026-11-03, 20 days late */
  assert.strictEqual(r.fine.amount, 100);
  assert.strictEqual(r.fine.overdueDays, 20);
  assert(db.FINES.some(f => f.id === r.fine.id && f.loanId === 501 && !f.paid));
});
test("return exactly on the due date has no fine, one day late is 5 EGP", () => {
  const db = freshDb();
  assert.strictEqual(L.previewReturn(db, 502, "2026-11-26").fine, 0);
  assert.strictEqual(L.previewReturn(db, 502, "2026-11-27").fine, 5);
});
test("returned copy is held when a reservation queue exists", () => {
  const db = freshDb();
  const r = L.returnLoan(db, 503, "2026-11-23"); /* book 9 has reservation 701 */
  assert.strictEqual(copy(db, "C9-1").status, "reserved");
  assert.strictEqual(r.notify.id, 701);
});
test("a loan cannot be returned twice", () => {
  const db = freshDb();
  L.returnLoan(db, 502, "2026-11-23");
  assert.strictEqual(L.returnLoan(db, 502, "2026-11-23").ok, false);
});
/* ---- BUG-12: return date validation ---- */
test("invalid return dates are rejected", () => {
  const db = freshDb();
  for (const d of ["abc", "", "2026-13-40", "2026-02-30", null]) assert.strictEqual(L.previewReturn(db, 502, d).ok, false, String(d));
  assert.strictEqual(L.previewReturn(db, 502, "2026-11-01").ok, false); /* before borrow date 2026-11-12 */
});

/* ---- BUG-03: request and reserve are stored ---- */
test("borrow request is stored, once", () => {
  const db = freshDb();
  const r = L.requestBorrow(db, 112, 3);
  assert(r.ok);
  assert(db.PENDING_REQUESTS.some(x => x.id === r.request.id && x.memberId === 112 && x.bookId === 3));
  assert.strictEqual(L.requestBorrow(db, 112, 3).ok, false); /* duplicate */
});
test("request ids are unique and increasing", () => {
  const db = freshDb();
  const a = L.requestBorrow(db, 112, 5).request.id;
  const b = L.requestBorrow(db, 112, 7).request.id;
  assert(a > 611 && b > a);
});
test("cannot request more copies than are free", () => {
  const db = freshDb();
  /* book 4 has one copy and request #610 (Sara) already waits for it */
  assert.strictEqual(L.requestBorrow(db, 112, 4).ok, false);
  assert.strictEqual(db.PENDING_REQUESTS.filter(r => r.bookId === 4).length, 1);
  /* book 3 has one copy: the first request takes it, the second is refused */
  assert(L.requestBorrow(db, 112, 3).ok);
  assert.strictEqual(L.requestBorrow(db, 104, 3).ok, false);
});
test("reservation joins the queue with the next position, no duplicates", () => {
  const db = freshDb();
  const r = L.reserve(db, 112, 6); /* 104 is first in line for book 6 (seed) */
  assert(r.ok);
  assert.strictEqual(r.reservation.queuePosition, 2);
  assert(db.RESERVATIONS.some(x => x.id === r.reservation.id));
  assert.strictEqual(L.reserve(db, 112, 6).ok, false);
});
test("cannot reserve a book that is available, in maintenance, or already held", () => {
  const db = freshDb();
  assert.strictEqual(L.reserve(db, 112, 4).ok, false); /* available */
  assert.strictEqual(L.reserve(db, 112, 11).ok, false); /* maintenance only (BUG-08) */
  assert.strictEqual(L.reserve(db, 101, 2).ok, false); /* 101 holds book 2 and has a fine */
  assert.strictEqual(L.reserve(db, 104, 2).ok, false); /* 104 holds book 2 */
});
test("suspended or fined members cannot reserve", () => {
  const db = freshDb();
  assert.strictEqual(L.reserve(db, 108, 2).ok, false);
});
test("maintenance-only book is labelled as unavailable, not on loan (BUG-08)", () => {
  const db = freshDb();
  assert.strictEqual(L.availabilityLabel(book(db, 11)), "unavailable");
  assert.strictEqual(L.availabilityLabel(book(db, 2)), "all-on-loan");
  assert.strictEqual(L.availabilityLabel(book(db, 4)), "available");
});

/* ---- BUG-02: librarian confirm creates a loan ---- */
test("confirm creates an active loan due in 14 days and locks a copy", () => {
  const db = freshDb();
  const r = L.confirmRequest(db, 610); /* Sara, book 4 */
  assert(r.ok);
  assert.strictEqual(r.loan.borrowDate, "2026-11-23");
  assert.strictEqual(r.loan.dueDate, "2026-12-07");
  assert.strictEqual(r.loan.status, "active");
  assert.strictEqual(copy(db, r.loan.copyId).status, "on-loan");
  assert(!db.PENDING_REQUESTS.some(x => x.id === 610));
  assert(db.LOANS.some(l => l.id === r.loan.id));
  assert(new Set(db.LOANS.map(l => l.id)).size === db.LOANS.length);
});
test("confirm is refused for a suspended member with unpaid fines", () => {
  const db = freshDb();
  const r = L.confirmRequest(db, 611); /* Omar */
  assert.strictEqual(r.ok, false);
  assert(db.PENDING_REQUESTS.some(x => x.id === 611));
  assert.strictEqual(copy(db, "C10-1").status, "available");
  assert(L.rejectRequest(db, 611).ok);
  assert(!db.PENDING_REQUESTS.some(x => x.id === 611));
});
test("confirm is refused when no copy is left", () => {
  const db = freshDb();
  copy(db, "C4-1").status = "on-loan";
  assert.strictEqual(L.confirmRequest(db, 610).ok, false);
});
test("confirming removes the member's own reservation for that book", () => {
  const db = freshDb();
  db.RESERVATIONS.push({ id: 750, memberId: 104, memberName: "Sara Mahmoud", bookId: 4, date: "2026-11-22", queuePosition: 1 });
  assert(L.confirmRequest(db, 610).ok);
  assert(!db.RESERVATIONS.some(r => r.id === 750));
});

/* ---- BUG-07: 3-loan limit counts pending requests ---- */
test("pending requests count toward the 3-loan limit", () => {
  const db = freshDb();
  /* member 112 has 0 loans: three requests are fine, the fourth is not */
  assert(L.requestBorrow(db, 112, 3).ok);
  assert(L.requestBorrow(db, 112, 7).ok);
  assert(L.requestBorrow(db, 112, 5).ok);
  const r = L.requestBorrow(db, 112, 12);
  assert.strictEqual(r.ok, false);
  assert(/limit 3/.test(r.error));
});
test("confirming cannot push a member above 3 active loans", () => {
  const db = freshDb();
  db.PENDING_REQUESTS.push({ id: 900, memberId: 104, memberName: "Sara Mahmoud", bookId: 3, date: "2026-11-23" });
  db.PENDING_REQUESTS.push({ id: 901, memberId: 104, memberName: "Sara Mahmoud", bookId: 7, date: "2026-11-23" });
  db.PENDING_REQUESTS.push({ id: 902, memberId: 104, memberName: "Sara Mahmoud", bookId: 12, date: "2026-11-23" });
  assert(L.confirmRequest(db, 900).ok);
  assert(L.confirmRequest(db, 901).ok);
  assert.strictEqual(L.confirmRequest(db, 902).ok, false); /* 104 now holds 3 */
  assert.strictEqual(db.LOANS.filter(l => l.memberId === 104 && !l.returnDate).length, 3);
});

/* ---- BUG-05: fines can be paid ---- */
test("paying a fine lifts the borrowing block", () => {
  const db = freshDb();
  assert.strictEqual(L.eligibility(db, 101).ok, false);
  assert(L.payFine(db, 301).ok);
  assert(db.FINES.find(f => f.id === 301).paid);
  /* member 101 still holds 3 loans, so the loan limit remains */
  const e = L.eligibility(db, 101);
  assert(!e.reasons.some(x => /unpaid fine/.test(x)));
  assert.strictEqual(L.payFine(db, 301).ok, false);
  assert.strictEqual(L.payFine(db, 999).ok, false);
});
test("a paid fine for a member with free slots makes them eligible", () => {
  const db = freshDb();
  db.MEMBERS.find(m => m.id === 108).suspended = false;
  db.LOANS.filter(l => l.memberId === 108 && !l.returnDate).forEach(l => L.returnLoan(db, l.id, "2026-11-23"));
  assert.strictEqual(L.eligibility(db, 108).ok, false);
  L.payFine(db, 302);
  assert.strictEqual(L.eligibility(db, 108).ok, true);
});

/* ---- BUG-04: removing books ---- */
test("a book with open loans, requests or reservations cannot be removed", () => {
  const db = freshDb();
  assert.strictEqual(L.removeBook(db, 2).ok, false); /* open loans */
  assert.strictEqual(L.removeBook(db, 4).ok, false); /* pending request 610 */
  assert.strictEqual(L.removeBook(db, 9).ok, false); /* loans and reservation */
  assert(db.BOOKS.some(b => b.id === 2));
});
test("an unused book can be removed and its id is not reused", () => {
  const db = freshDb();
  const added = L.addBook(db, { title: "Temp" }).book;
  assert.strictEqual(added.id, 13);
  assert(L.removeBook(db, 13).ok);
  assert.strictEqual(L.addBook(db, { title: "Next" }).book.id, 14);
});
test("returning a book allows removing it afterwards", () => {
  const db = freshDb();
  L.rejectRequest(db, 610);
  assert(L.removeBook(db, 4).ok);
});
test("new book defaults and validation", () => {
  const db = freshDb();
  assert.strictEqual(L.addBook(db, { title: "   " }).ok, false);
  const b = L.addBook(db, { title: " X ", author: " ", category: "", copies: 2 }).book;
  assert.strictEqual(b.title, "X");
  assert.strictEqual(b.author, "Unknown");
  assert.strictEqual(b.category, "General");
  assert.deepStrictEqual(b.copies.map(c => c.id), [`C${b.id}-1`, `C${b.id}-2`]);
});

/* ---- seed data consistency ---- */
test("seed data: no reservation for a book the member holds", () => {
  const db = freshDb();
  for (const r of db.RESERVATIONS) {
    assert(!db.LOANS.some(l => l.memberId === r.memberId && l.bookId === r.bookId && !l.returnDate), "reservation " + r.id);
  }
});
test("seed data: copy status matches open loans, reserved copies have a queue", () => {
  const db = freshDb();
  for (const b of db.BOOKS) for (const c of b.copies) {
    const open = db.LOANS.some(l => l.copyId === c.id && !l.returnDate);
    assert.strictEqual(c.status === "on-loan", open, c.id);
    if (c.status === "reserved") assert(db.RESERVATIONS.some(r => r.bookId === b.id), c.id);
  }
});
test("seed data: ids are unique and every loan, fine, request points at real records", () => {
  const db = freshDb();
  for (const arr of [db.LOANS, db.FINES, db.PENDING_REQUESTS, db.RESERVATIONS, db.BOOKS, db.MEMBERS]) {
    assert.strictEqual(new Set(arr.map(x => x.id)).size, arr.length);
  }
  db.LOANS.forEach(l => { assert(book(db, l.bookId)); assert(copy(db, l.copyId)); assert(db.MEMBERS.some(m => m.id === l.memberId)); });
  db.FINES.forEach(f => assert(db.LOANS.some(l => l.id === f.loanId && l.memberId === f.memberId)));
  /* each fine equals overdue days x 5 EGP */
  db.FINES.forEach(f => assert.strictEqual(f.amount, f.overdueDays * db.FINE_PER_DAY));
  /* queue positions run 1..n per book */
  const byBook = {};
  db.RESERVATIONS.forEach(r => (byBook[r.bookId] = byBook[r.bookId] || []).push(r.queuePosition));
  Object.values(byBook).forEach(p => assert.deepStrictEqual(p.sort(), p.map((_, i) => i + 1)));
});

/* ---- search ---- */
test("search matches title, author, category and ISBN", () => {
  const db = freshDb();
  assert.deepStrictEqual(L.searchBooks(db.BOOKS, "clean code").map(b => b.id), [1]);
  assert.deepStrictEqual(L.searchBooks(db.BOOKS, "silberschatz").map(b => b.id), [3, 10]);
  assert.deepStrictEqual(L.searchBooks(db.BOOKS, "978-0132350884").map(b => b.id), [1]);
  assert.strictEqual(L.searchBooks(db.BOOKS, "").length, db.BOOKS.length);
  assert.strictEqual(L.searchBooks(db.BOOKS, "zzz").length, 0);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
