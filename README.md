# Library Management System

University project for **Information Systems Analysis and Design 1 (SA1)**: analysis, design and a working front-end demo of a Library Management System.

The system helps librarians organize books, manage members, and track borrowing and returns. Members can search the catalog, check availability, borrow and return books, reserve titles that are on loan, and follow their due dates and fines.

## Deliverables

| Deliverable | Location |
| --- | --- |
| Functional requirements (18) | [requirements/functional-requirements.md](requirements/functional-requirements.md) |
| Data Flow Diagram | [diagrams/dfd.png](diagrams/dfd.png) ([source](diagrams/dfd.mmd)) |
| Class Diagram | [diagrams/class-diagram.png](diagrams/class-diagram.png) ([source](diagrams/class-diagram.mmd)) |
| Activity Diagram | [diagrams/activity-diagram.png](diagrams/activity-diagram.png) ([source](diagrams/activity-diagram.mmd)) |
| Sequence Diagram | [diagrams/sequence-diagram.png](diagrams/sequence-diagram.png) ([source](diagrams/sequence-diagram.mmd)) |
| Use Case Diagram | [diagrams/use-case-diagram.png](diagrams/use-case-diagram.png) ([source](diagrams/use-case-diagram.mmd)) |
| Front end (7 pages) | [docs/](docs/) |

All diagrams are consistent with one another and with the 18 functional requirements, and the front end demonstrates the same flows.

## Front end

Seven pages, static HTML/CSS/JS with mock data (no backend required, per the project brief):

- **Home** - overview, live stats, feature map to the requirements
- **Book Catalog** - search by title/author/category with live availability (FR-03, FR-04)
- **Book Details** - copies and their status, borrow request and reservation actions (FR-05, FR-09)
- **Member Dashboard** - current loans, due-date reminders, overdue notices, fines, reservations (FR-06, FR-10, FR-11)
- **Borrowing History** - every loan with return dates and late fines (FR-07)
- **Return Book** - pick an active loan, see the fine calculation, confirm the return (FR-08, FR-15, FR-16)
- **Librarian Dashboard** - pending borrow requests, overdue report with fines, add-book form, member management, reservation queues (FR-12 to FR-18)

### Run it

Open `docs/index.html` in a browser, or serve the folder:

```bash
cd docs && python3 -m http.server 8000
# then open http://localhost:8000
```

The site is also published with GitHub Pages: https://hassan3443.github.io/library-management-system/

## Business rules

- Loans run 14 days from librarian confirmation
- Overdue fine: 5 EGP per overdue day
- Members with unpaid fines or 3 active loans cannot borrow
- Reservations are offered to the first member in the queue when a copy returns

## Diagram sources

Diagrams are written in [Mermaid](https://mermaid.js.org/) (`diagrams/*.mmd`) and rendered to PNG for the report.

## Author

Hassan Ashraf - [github.com/Hassan3443](https://github.com/Hassan3443)
