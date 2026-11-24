# Library Management System

**Live demo: https://hassan3443.github.io/library-management-system/**

| Home | Book Catalog | Librarian Dashboard |
| --- | --- | --- |
| ![Home](screenshots/home.png) | ![Book Catalog](screenshots/catalog.png) | ![Librarian Dashboard](screenshots/librarian.png) |

University project for **Information Systems Analysis and Design 1 (SA1)**: analysis, design and a working front-end demo of a Library Management System.

The system helps librarians organize books, manage members, and track borrowing and returns. Members can search the catalog, check availability, borrow and return books, reserve titles that are on loan, and follow their due dates and fines.

## Deliverables

| Deliverable | Location |
| --- | --- |
| Functional requirements (18) | [requirements/functional-requirements.md](requirements/functional-requirements.md) |
| Data Flow Diagram, Level 0 and Level 1 | [diagrams/dfd0.png](diagrams/dfd0.png), [diagrams/dfd1.png](diagrams/dfd1.png) |
| Class Diagram | [diagrams/class-diagram.png](diagrams/class-diagram.png) ([source](diagrams/class-diagram.puml)) |
| Activity Diagram | [diagrams/activity-diagram.png](diagrams/activity-diagram.png) ([source](diagrams/activity-diagram.puml)) |
| Sequence Diagram | [diagrams/sequence-diagram.png](diagrams/sequence-diagram.png) ([source](diagrams/sequence-diagram.puml)) |
| Use Case Diagram | [diagrams/use-case-diagram.png](diagrams/use-case-diagram.png) ([source](diagrams/use-case-diagram.puml)) |
| Front end (8 pages) | [docs/](docs/) |

All diagrams are consistent with one another and with the 18 functional requirements, and the front end demonstrates the same flows.

## Front end

Eight pages, static HTML/CSS/JS with mock data (no backend required, per the project brief). Demo actions that change state (librarian decisions, catalog edits, suspension, login) persist in the browser via localStorage:

- **Home** - overview, live stats, feature map to the requirements
- **Book Catalog** - search by title/author/category with live availability (FR-03, FR-04)
- **Book Details** - copies and their status, borrow request and reservation actions (FR-05, FR-09)
- **Member Dashboard** - current loans, due-date reminders, overdue notices, fines, reservations (FR-06, FR-10, FR-11)
- **Borrowing History** - every loan with return dates and late fines (FR-07)
- **Return Book** - pick an active loan, see the fine calculation, confirm the return (FR-08, FR-15, FR-16)
- **Librarian Dashboard** - pending borrow requests with persistent confirm/reject, overdue report with fines, full catalog management (add, update, remove books, register copies), member suspension, reservation queues (FR-12 to FR-18)
- **Login / Register** - real credential check against the demo accounts in `docs/js/accounts.js` (static demo, so the check runs in the browser). Wrong password does not log in. Each role gets its own navigation and dashboard. New members can register.
- **Members** (librarian only) - list of members, suspend/reactivate, promote a member to librarian

**Demo accounts:** librarian `hassan@gmail.com` / `12345678`; members `sara.m@example.com` / `sara1234`, `omar.k@example.com` / `omar1234`, `hassan.ashraf@example.com` / `member101`.

### Run it

Open `docs/index.html` in a browser, or serve the folder:

```bash
cd docs && python3 -m http.server 8000
# then open http://localhost:8000
```


## Business rules

- Loans run 14 days from librarian confirmation
- Overdue fine: 5 EGP per overdue day
- Members with unpaid fines or 3 active loans cannot borrow; the demo enforces this by blocking the borrow action on Book Details and flagging it on the Member Dashboard
- Reservations are offered to the first member in the queue when a copy returns

## Diagram sources

Diagrams are written as code: [PlantUML](https://plantuml.com/) (`diagrams/*.puml`) for UML diagrams and [Graphviz](https://graphviz.org/) (`diagrams/*.dot`) for the data flow diagrams, rendered to PNG for the report.

## License

MIT - see [LICENSE](LICENSE).

## Author

Hassan Ashraf - [github.com/Hassan3443](https://github.com/Hassan3443)
