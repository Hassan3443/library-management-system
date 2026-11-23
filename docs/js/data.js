/* Mock data for the Library Management System front end demo.
   Mirrors the class diagram: Book, BookCopy, Member, Librarian, Loan, Fine, Reservation. */

const BOOKS = [
  { id: 1, title: "Clean Code", author: "Robert C. Martin", category: "Software", isbn: "978-0132350884", year: 2008,
    copies: [ { id: "C1-1", status: "available", location: "Shelf A3" }, { id: "C1-2", status: "on-loan", location: "Shelf A3" } ] },
  { id: 2, title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Software", isbn: "978-0262033848", year: 2009,
    copies: [ { id: "C2-1", status: "on-loan", location: "Shelf A1" }, { id: "C2-2", status: "on-loan", location: "Shelf A1" } ] },
  { id: 3, title: "Database System Concepts", author: "Abraham Silberschatz", category: "Databases", isbn: "978-0078022159", year: 2019,
    copies: [ { id: "C3-1", status: "available", location: "Shelf B2" } ] },
  { id: 4, title: "The Pragmatic Programmer", author: "David Thomas", category: "Software", isbn: "978-0135957059", year: 2019,
    copies: [ { id: "C4-1", status: "available", location: "Shelf A3" } ] },
  { id: 5, title: "Data Science from Scratch", author: "Joel Grus", category: "Data Science", isbn: "978-1492041139", year: 2019,
    copies: [ { id: "C5-1", status: "available", location: "Shelf C1" }, { id: "C5-2", status: "available", location: "Shelf C1" } ] },
  { id: 6, title: "Python Crash Course", author: "Eric Matthes", category: "Programming", isbn: "978-1718502703", year: 2023,
    copies: [ { id: "C6-1", status: "on-loan", location: "Shelf C2" } ] },
  { id: 7, title: "Design Patterns", author: "Erich Gamma", category: "Software", isbn: "978-0201633610", year: 1994,
    copies: [ { id: "C7-1", status: "available", location: "Shelf A2" } ] },
  { id: 8, title: "SQL in 10 Minutes", author: "Ben Forta", category: "Databases", isbn: "978-0135182796", year: 2019,
    copies: [ { id: "C8-1", status: "available", location: "Shelf B2" }, { id: "C8-2", status: "reserved", location: "Shelf B2" } ] },
  { id: 9, title: "Hands-On Machine Learning", author: "Aurelien Geron", category: "Data Science", isbn: "978-1098125974", year: 2022,
    copies: [ { id: "C9-1", status: "on-loan", location: "Shelf C1" }, { id: "C9-2", status: "on-loan", location: "Shelf C1" } ] },
  { id: 10, title: "Operating System Concepts", author: "Abraham Silberschatz", category: "Systems", isbn: "978-1119800361", year: 2021,
    copies: [ { id: "C10-1", status: "available", location: "Shelf B1" } ] },
  { id: 11, title: "Computer Networks", author: "Andrew Tanenbaum", category: "Systems", isbn: "978-0132126953", year: 2010,
    copies: [ { id: "C11-1", status: "maintenance", location: "Shelf B1" } ] },
  { id: 12, title: "The Mythical Man-Month", author: "Frederick Brooks", category: "Software", isbn: "978-0201835953", year: 1995,
    copies: [ { id: "C12-1", status: "available", location: "Shelf A2" } ] }
];

const MEMBER = { id: 101, name: "Hassan Ali", email: "hassan.ali@example.com", joinDate: "2025-09-14", active: true };

/* Loan period is 14 days. Fine = 5 EGP per overdue day. */
const LOANS = [
  { id: 501, bookId: 2, copyId: "C2-1", borrowDate: "2026-10-20", dueDate: "2026-11-03", returnDate: null, status: "overdue" },
  { id: 502, bookId: 6, copyId: "C6-1", borrowDate: "2026-11-12", dueDate: "2026-11-26", returnDate: null, status: "active" },
  { id: 503, bookId: 9, copyId: "C9-1", borrowDate: "2026-11-15", dueDate: "2026-11-29", returnDate: null, status: "active" },
  { id: 498, bookId: 3, copyId: "C3-1", borrowDate: "2026-09-01", dueDate: "2026-09-15", returnDate: "2026-09-12", status: "returned" },
  { id: 492, bookId: 7, copyId: "C7-1", borrowDate: "2026-08-10", dueDate: "2026-08-24", returnDate: "2026-08-30", status: "returned" },
  { id: 487, bookId: 5, copyId: "C5-1", borrowDate: "2026-07-05", dueDate: "2026-07-19", returnDate: "2026-07-18", status: "returned" }
];

const FINES = [
  { id: 301, loanId: 492, overdueDays: 6, amount: 30, paid: false }
];

const PENDING_REQUESTS = [
  { id: 610, memberId: 104, memberName: "Sara Mahmoud", bookId: 4, date: "2026-11-22" },
  { id: 611, memberId: 108, memberName: "Omar Khaled", bookId: 10, date: "2026-11-23" }
];

const RESERVATIONS = [
  { id: 701, memberId: 101, memberName: "Hassan Ali", bookId: 9, date: "2026-11-18", queuePosition: 1 },
  { id: 702, memberId: 104, memberName: "Sara Mahmoud", bookId: 2, date: "2026-11-19", queuePosition: 1 }
];

const MEMBERS = [
  { id: 101, name: "Hassan Ali", email: "hassan.ali@example.com", activeLoans: 3, unpaidFines: 30, suspended: false },
  { id: 104, name: "Sara Mahmoud", email: "sara.m@example.com", activeLoans: 1, unpaidFines: 0, suspended: false },
  { id: 108, name: "Omar Khaled", email: "omar.k@example.com", activeLoans: 2, unpaidFines: 45, suspended: true }
];

const FINE_PER_DAY = 5;
const TODAY = "2026-11-23";

function bookById(id) { return BOOKS.find(b => b.id === id); }
function availableCopies(book) { return book.copies.filter(c => c.status === "available").length; }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function overdueDays(loan) {
  const end = loan.returnDate || TODAY;
  return Math.max(0, daysBetween(loan.dueDate, end));
}
function loanFine(loan) { return overdueDays(loan) * FINE_PER_DAY; }
