# Library Management System - Functional Requirements

**Course:** Information Systems Analysis and Design 1 (SA1)
**Project 4:** Library Management System

The Library Management System helps librarians organize books, manage library members,
and track borrowing and returning activities. Members can search for books and check
their availability before requesting to borrow them.

**Actors:** Library Member, Librarian

| ID | Actor | Requirement | Owner |
| --- | --- | --- | --- |
| FR-01 | Member | The system shall allow a visitor to register as a library member with name, email and password. | Person 1 |
| FR-02 | Member | The system shall allow a member to log in and log out securely. | Person 1 |
| FR-03 | Member | The system shall allow a member to search for books by title, author or category. | Person 2 |
| FR-04 | Member | The system shall display book details (title, author, category, ISBN, publication year) together with real-time availability of its copies. | Person 2 |
| FR-05 | Member | The system shall allow a member to submit a borrow request for an available book. | Person 3 |
| FR-06 | Member | The system shall show the member their current loans with borrowing date and due date for each loan. | Person 4 |
| FR-07 | Member | The system shall keep and display the member's full borrowing history. | Person 4 |
| FR-08 | Member | The system shall allow a member to initiate the return of a borrowed book. | Person 5 |
| FR-09 | Member | The system shall allow a member to reserve a book that is currently on loan, and place them in a reservation queue. | Person 6 |
| FR-10 | Member | The system shall display the member's outstanding fines with the amount and the loan that caused each fine. | Person 4 |
| FR-11 | Member | The system shall notify a member when a loan is approaching its due date or becomes overdue. | Person 6 |
| FR-12 | Librarian | The system shall allow a librarian to add, update and remove books from the catalog. | Person 7 |
| FR-13 | Librarian | The system shall allow a librarian to manage individual book copies and their status (available, on loan, reserved, under maintenance). | Person 7 |
| FR-14 | Librarian | The system shall allow a librarian to review and confirm borrow requests, recording the borrowing date and due date. | Person 3 |
| FR-15 | Librarian | The system shall allow a librarian to process returned books and update copy availability accordingly. | Person 5 |
| FR-16 | Librarian | The system shall automatically identify overdue loans and calculate the fine for each based on the number of overdue days. | Person 5 |
| FR-17 | Librarian | The system shall allow a librarian to view and manage member accounts, including suspending members with unpaid fines. | Person 7 |
| FR-18 | Librarian | The system shall allow a librarian to view the reservation queue for each book and notify the next member when a copy becomes available. | Person 6 |

**Owner** is the team member who explains that requirement in the discussion (see the study plan). Person 1: FR-01, FR-02. Person 2: FR-03, FR-04. Person 3: FR-05, FR-14. Person 4: FR-06, FR-07, FR-10. Person 5: FR-08, FR-15, FR-16. Person 6: FR-09, FR-11, FR-18. Person 7: FR-12, FR-13, FR-17.

## Business rules

- A loan is issued for 14 days; the due date is recorded when the librarian confirms the borrow request.
- Overdue fine = 5 EGP per overdue day, computed when the book is returned and shown in overdue reports.
- A member with unpaid fines or 3 active loans cannot submit new borrow requests.
- A reservation is offered to the first member in the queue when a copy is returned.

## Consistency note

These 18 requirements are the single source of truth for the rest of the deliverables:
the Use Case diagram covers all 18, the Activity diagram shows FR-05 -> FR-14 -> FR-08 -> FR-15 -> FR-16
(the borrow/return workflow), the Sequence diagram details the borrow request scenario (FR-04 -> FR-05 -> FR-14),
and the front end demonstrates the member and librarian flows behind them.
