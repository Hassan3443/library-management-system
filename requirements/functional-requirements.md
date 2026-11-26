# Library Management System - Functional Requirements

**Course:** Information Systems Analysis and Design 1 (SA1)
**Project 4:** Library Management System

The Library Management System helps librarians organize books, manage library members,
and track borrowing and returning activities. Members can search for books and check
their availability before requesting to borrow them.

**Actors:** Library Member, Librarian (due-date notices and the overdue check are triggered by the system itself, there is no third actor)

| ID | Actor | Requirement | Owner |
| --- | --- | --- | --- |
| FR-01 | Member | The system shall allow a visitor to register as a library member with name, email and password. | Person 1 |
| FR-02 | Member | The system shall allow a member or librarian to log in with email and password (checked against the stored accounts, a wrong password is rejected) and to log out. | Person 1 |
| FR-03 | Member | The system shall allow a member to search for books by title, author, category or ISBN. | Person 2 |
| FR-04 | Member | The system shall display book details (title, author, category, ISBN, publication year) together with real-time availability of its copies. | Person 2 |
| FR-05 | Member | The system shall allow a member to submit a borrow request for an available book. | Person 3 |
| FR-06 | Member | The system shall show the member their current loans with borrowing date and due date for each loan. | Person 4 |
| FR-07 | Member | The system shall keep and display the member's full borrowing history. | Person 4 |
| FR-08 | Member | The system shall allow a member to initiate the return of a borrowed book. | Person 5 |
| FR-09 | Member | The system shall allow a member to reserve a book that is currently on loan, place them in a reservation queue, and cancel their reservation. | Person 6 |
| FR-10 | Member | The system shall display the member's outstanding fines with the amount and the loan that caused each fine, and shall allow a librarian to record the payment of a fine. | Person 4 |
| FR-11 | Member | The system shall notify a member when a loan is approaching its due date or becomes overdue. | Person 6 |
| FR-12 | Librarian | The system shall allow a librarian to add, update and remove books from the catalog. | Person 7 |
| FR-13 | Librarian | The system shall allow a librarian to manage individual book copies (add or remove available copies) and their status (available, on loan, reserved, under maintenance). | Person 7 |
| FR-14 | Librarian | The system shall allow a librarian to review and confirm borrow requests, recording the borrowing date and due date. | Person 3 |
| FR-15 | Librarian | The system shall allow a librarian to process returned books and update copy availability accordingly. | Person 5 |
| FR-16 | Librarian | The system shall automatically identify overdue loans and calculate the fine for each based on the number of overdue days. | Person 5 |
| FR-17 | Librarian | The system shall allow a librarian to view and manage member accounts, including suspending members with unpaid fines and promoting a member to librarian. | Person 7 |
| FR-18 | Librarian | The system shall allow a librarian to view the reservation queue for each book and notify the next member when a copy becomes available. | Person 6 |
| FR-19 | Librarian | The system shall allow a librarian to remove a member, which deletes the member account, reservations and loan history. | Person 7 |

**Owner** is the team member who explains that requirement in the discussion (see the study plan). Person 1: FR-01, FR-02. Person 2: FR-03, FR-04. Person 3: FR-05, FR-14. Person 4: FR-06, FR-07, FR-10. Person 5: FR-08, FR-15, FR-16. Person 6: FR-09, FR-11, FR-18. Person 7: FR-12, FR-13, FR-17, FR-19.

## Business rules

- A loan is issued for 14 days; the due date is recorded when the librarian confirms the borrow request.
- Overdue fine = 5 EGP per overdue day, computed when the book is returned and shown in overdue reports.
- A member who is suspended, has an unpaid fine, or whose active loans plus pending requests reach 3 cannot submit a new borrow request. Paying the fine (recorded by a librarian) lifts the block.
- A member who is suspended or has an unpaid fine cannot reserve a book. A book can be reserved only while all its copies are on loan (not when a copy is available or all copies are in maintenance).
- Confirming a borrow request re-checks the member and the copy. It creates the loan and sets the copy to On Loan, or is refused with a reason (the librarian can then reject the request).
- A book with an open loan, a pending request or a reservation cannot be removed from the catalog. Removed book ids are never reused.
- Fines are only created when a late book is returned. A loan that is overdue but not yet returned shows its accrued fine in the overdue report and does not block borrowing by itself (known simplification, see Known limits).
- A member can be removed only when they have no active loans and no unpaid fines. Removing a member deletes their account, reservations and loan history. A librarian cannot be removed until the librarian role is taken away.
- A reservation is offered to the first member in the queue when a copy is returned: the returned copy is set to Reserved until it is collected or the reservation is cancelled.

## Known limits

- The demo has no hold-expiry or no-show rule for a Reserved copy, and no automatic suspension for unpaid fines (suspension is manual, FR-17).
- Overdue is derived from the due date and the frozen demo date (2026-11-23), not from a running clock.
- Passwords are plain text in the browser: this is a static demo with no backend.

## Consistency note

These 19 requirements are the single source of truth for the rest of the deliverables:
the Use Case diagram covers all 19 (21 use cases: UC20 cancel reservation and UC21 record fine payment were added to cover FR-09 and FR-10), the Activity diagram shows FR-05 -> FR-14 -> FR-08 -> FR-15 -> FR-16
(the borrow/return workflow), the Sequence diagram details the borrow request scenario (FR-04 -> FR-05 -> FR-14),
and the front end demonstrates the member and librarian flows behind them.
