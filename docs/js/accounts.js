/* Demo accounts (static demo: no backend, so credentials live in this file and are
   checked in the browser). Passwords are plain text on purpose, for demo use only.
   role: "librarian" or "member". memberId links a member account to its member record. */
const ACCOUNTS = [
  { email: "hassan@gmail.com", password: "12345678", name: "Hassan Ashraf", role: "librarian" },
  { email: "nour@library.test", password: "librarian2026", name: "Nour Adel", role: "librarian" },
  { email: "hassan.ashraf@example.com", password: "member101", name: "Hassan Ashraf", role: "member", memberId: 101 },
  { email: "sara.m@example.com", password: "sara1234", name: "Sara Mahmoud", role: "member", memberId: 104 },
  { email: "omar.k@example.com", password: "omar1234", name: "Omar Khaled", role: "member", memberId: 108 }
];
