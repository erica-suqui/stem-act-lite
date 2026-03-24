# **Software Requirements Specification**

STEM-ACT Collaboration Hub

| Team Members: | Alexander Rodriguez, Erica Suqui, Joe Youn |
| :---- | :---- |
| Client: | Cheryl Tokarski – STEM-ACT Director |
| Document Version: | Draft v1.0 |
| Last Updated: | 02/05/2026  |

## **1\. Executive Summary**

### **1.1 Project Overview**

STEM-ACT administers a website built by WordPress, where users can view current STEM events. This project will expand the website by creating a plugin extension that improves the current approval workflow and enhances how events are displayed to users.

### **1.2 Problem Statement**

STEM-ACT relies mainly on manual processes to manage STEM event submissions. Event information is sent through forums and manually converted into public-facing content by copy and pasting new events into WordPress. This creates a greater burden on administrators, inconsistent event data formatting, limited scalability, and no streamlined publishing and approval process.

### **1.3 Solution**

The proposed solution is a custom WordPress plugin that replaces the current manual workflow with a structured, role-based submission and approval system.

* **Registration with Optional Event Submission:** New partner organizations register through an account creation form. During registration, they are prompted: "Would you like to add an event now?" Selecting "Yes" expands the form to include event details fields. Partners can add multiple events by selecting an "Add another event" checkbox. Selecting "No" completes registration without an event submission.  
* **Approval Workflow:** All event submissions—whether submitted during registration or later—move through the same approval states (pending, approved, denied) with admin-controlled moderation. There will be two tabs 1 for trusted partners and another for public users
* **Automated Publishing:** Approved events are automatically published to the public-facing event catalog.  
* **Tracking & Notifications:** Partners can track submission status and receive notifications on updates.

### **1.4 Client Context**

Our client is STEM-ACT of CT. They are an organization focusing on STEM in Connecticut, serving educators, families, students, and partner organizations across the state.

## **2\. User Personas**

### **Viewer \#1**

| Name | Natalia Smith |
| :---- | :---- |
| Role | Student at Main High School, President of Computer Club |
| Age | 17 |
| Technical Background | Intermediate |
| Technology Context | Laptop, Phone |

#### **Background:**

High school student and president of the Computer Club. She posts announcements about STEM events around the New Haven area for her school community.

#### **Needs:**

* Search through events on the STEM-ACT website  
* Use the map to find events near her location

#### **Pain Points:**

* The blog-style interface emphasizes event titles over addresses, making it hard to see locations  
* The current filter system doesn't allow filtering by location

#### **Goals:**

* A user interface that highlights event location and date more prominently

### **Viewer \#2**

| Name | Alfredo Jones |
| :---- | :---- |
| Role | Family Planner |
| Age | 49 |
| Technical Background | Novice |
| Technology Context | Phone, PC |

#### **Background:**

A parent looking for educational, family-friendly events for his two children.

#### **Needs:**

* Filter events by cost to determine which are worth paying for  
* Filter events by target audience to find family-friendly options

#### **Pain Points:**

* No way to filter events by ticket cost  
* No way to filter by intended audience (e.g., children, families)

#### **Goals:**

* A user interface with clear, filterable options focused on cost and audience

### **Organization \#1**

| Name | Cain Nisreen |
| :---- | :---- |
| Role | Professor, Computer Science Department |
| Age | — |
| Technical Background | Proficient |
| Technology Context | Computer |

#### **Background:**

A professor who submits STEM events to the STEM-ACT website. She reports to the Dean via email when clarification is needed and requires a quick way to edit events without back-and-forth communication.

#### **Needs:**

* Submit event details through the website to keep announcements centralized  
* Edit event posts when last-minute changes occur  
* Track the status of event requests to notify the Dean

#### **Pain Points:**

* Unable to communicate effectively with administrators  
* Cannot edit events without sending additional emails  
* Without an account, you must sort through emails from STEM-ACT manually

#### **Goals:**

* Automated form submission process  
* Personal dashboard to track submitted events and their statuses

### **Organization \#2**

| Name | Matthew Frank |
| :---- | :---- |
| Role | STEM Event Coordinator, Wilbur Elementary School |
| Age | 32 |
| Technical Background | Intermediate |
| Technology Context | Computer |

#### **Background:**

Learned about the STEM-ACT website through another organization and wants to use it to display events for students interested in STEM careers. As a new trusted partner, his organization has multiple events to submit.

#### **Needs:**

* An account designating him as the head of his organization  
* Ability to create and manage accounts for additional staff members  
* Event submission integrated with account creation to save time

#### **Pain Points:**

* Events must be submitted one by one, repeatedly entering organization info  
* Staff members must repeat the same tedious process even within the same organization

#### **Goals:**

* Verified organization account that streamlines event submissions  
* Shared visibility across staff so they can see approved events and avoid duplicate submissions

### **Administrator**

| Name | Cheryl Tokarski |
| :---- | :---- |
| Role | STEM-ACT Director |
| Age | — |
| Technical Background | Intermediate |
| Technology Context | PC, Laptop |

#### **Background:**

Director of the STEM-ACT website. Currently approves all events submitted via Google Forms manually.

#### **Needs:**

* Approve or deny requests submitted by Organizations  
* Communicate with partners when clarification is needed  
* View a list of all Organizations

#### **Pain Points:**

* Time-consuming to check all form requests through Google Forms  
* Google Forms displays responses ineffectively when many events are submitted

#### **Goals:**

* Simple approve/deny buttons that automatically format and publish events  
* Ability to add comments when denying an event

### **Super Administrator**

| Name | John |
| :---- | :---- |
| Role | STEM-ACT Website Administrator |
| Age | — |
| Technical Background | Proficient |
| Technology Context | Computer |

#### **Background:**

The developer who created the current WordPress website serves as a centralized hub for organizations to announce STEM events and reach a larger audience.

#### **Needs:**

* Assign administrator roles without granting excessive permissions

#### **Pain Points:**

* No centralized database of partner organizations for easier verification  
* Current system forces Organizations to fill out Google Forms repeatedly

#### **Goals:**

* Partners declare contact info once by creating an account  
* Simple "Add Event" button that only asks for event details, improving user experience

## **3\. User Stories**

**Trusted Partner Dashboard**

**US001 Organization (New Registration):** As a new trusted partner, I want to register an account and optionally submit one or more events during registration so that I can immediately begin the approval process without needing to navigate to a separate submission page.

**Acceptance Criteria:**

* I can create an account with my organization's email
* I can set a password based on security requirements
* Upon submitting registration, I receive a verification email at the address I provided
* I cannot access my dashboard or submit events until I verify my email
* I can click the confirmation link in the email to verify my account
* The verification link expires after 24 hours; I can request a new one if it expires
* After verifying, I am prompted "Would you like to add an event now?" with Yes/No options
* If I select Yes, I can add event details and use "Add another event" to submit multiple events
* If I select No, I complete registration without submitting an event
* I am redirected to the dashboard once registration is complete

**US002 Organization (Returning):** As a returning trusted partner, I want my login credentials to be saved so that I do not need to sign in every time I visit the STEM-ACT website.

**Acceptance Criteria:**

* I can check a "Remember Me" option when logging in  
* If checked, my session persists across browser sessions  
* I am redirected to my dashboard upon successful login

**US003** **Organizations**: As a returning trusted partner, I want to be able to reset my password on my own so I can quickly regain access without waiting for admin assistance.

**Acceptance Criteria:**

* I can click "Forgot Password" on the login page
* I am prompted to enter my registered email address
* I receive a time-limited password reset link at that email address
* I can click the link and be taken to a page to set a new password
* After successfully resetting, I am redirected to the login page
* The reset link expires after 1 hour and cannot be reused

### **Role-Based Access Control**

**US004 Administrator:** As an administrator, I want a dashboard that displays all events so that I can easily approve or deny incoming events as well as any modifications.

**Acceptance Criteria:**

* I can view all incoming events with their status (pending, approved, denied)  
* For modified events, I can see both old and new details to compare changes  
* I can add comments when requesting clarification or denying an event  
* I can approve an event, which automatically publishes it  
* I can deny an event that notifies the organization

### **Event Submission Form** 

**US005 Organization:** As a returning trusted partner, I want to modify event details so that viewers can see the most current information.

**Acceptance Criteria:**

* I can view a list of all events I have submitted  
* I can view the status of each event (pending, approved, denied)  
* I can only edit upcoming events (past events cannot be modified)  
* Edits require re-approval before being published

**US006 Organization**: As a returning trusted partner, if my event is rejected from being published, I want to be able to request a reason from the admin so that I can get it reapproved. 

**Acceptance Criteria:** 

* I can see that the status of my event has been changed to “denied.”   
* I can click on the details of the report that would explain why it was rejected   
* I can type out a comment that would be sent to the admin so that they can explain why it was rejected 

### **Approval Workflow**

**US007 Organization:** As a trusted partner, I want to track my approval status so that I am aware of where my submission is in the process.

**Acceptance Criteria:**

* I can view a list of all events I have submitted  
* I can view the current status of each event (pending, approved, denied)  
* I receive a notification when my event status changes  
* If denied, I can view the admin's comments explaining why

**Catalog Filtering** 

**US008 Viewer:** As a viewer, I want to see what STEM events are available so that I can decide which to attend.

**Acceptance Criteria:**

* I can only see events that have been approved and published  
* I can see updated event details if modifications have been approved  
* I can click on an event to see full details

### **Admin Dashboard**

**US009 Administrator:** As an administrator, I want the dashboard to display partner accounts with their emails and affiliated organizations so that I can contact them quickly if clarification is needed.

**Acceptance Criteria:**

* I can filter partners by organization name or contact name  
* I can send a message to a partner's account

**US010 Organization:** As a trusted partner, I want to understand the invitation email and activate my account so that I can start posting events.

**Acceptance Criteria:**

* I received a clear invitation email with instructions  
* I can follow the activation link  
* After clicking the link, I am prompted to set a password and optionally add an event

**US011 Super Administrator:** As a super administrator, I want to create and modify users and assign admin roles so that I can control access to the website.

**Acceptance Criteria:**

* I can generate an invitation link to send to new admins  
* I can delete admin accounts when they are no longer needed  
* I can view a list of all admins and registered partner accounts

**US012 Super Administrator:** As a super administrator, I want access to both the backend and frontend of the site so that I can update settings as needed.

**Acceptance Criteria:**

* I can access super admin options only if I have the super admin role  
* I can view the website's core elements from a super admin perspective  
* I can register and permanently delete users

## **4\. Features and Requirements**

### **Core Features**

1. **Event Submission Form:** Allows trusted partners   
2. to submit STEM event information through a standardized form.  
3. **Approval Workflow:** Organized process enabling efficient submission-to-approval workflow with quick moderation and publishing.  
4. **Admin Dashboard:** Interface for admins to review pending submissions, manage approval status, and provide feedback before publishing.  
5. **Trusted Partner Dashboard:** Interface for partners to view account info, submission status, and event history.  
6. **Event Catalog:** Public-facing page displaying all approved events with search and filter capabilities.  
7. **Catalog Filtering:** Allows filtering by date, audience, location, and cost to help users find relevant events.  
8. **Role-Based Access Control:** Ensures users can only access features relevant to their role (viewer, partner, admin, super admin).
9. **Interactive Events Map:** Displays Connecticut counties; users can select a county to view events in that area.
10. **Email Verification:** Sends a confirmation email upon partner registration; partners must verify their email address before accessing their dashboard or submitting events.
11. **Password Reset:** Self-service password reset via a time-limited email link, allowing partners to securely reset their password without requiring admin intervention.

### **Technical Requirements**

* WordPress plugin architecture  
* Embedded views inside WordPress pages  
* Separate admin interface  
* MySQL database  
* Secure authentication for admins and partners

### **Non-Functional Requirements**

* **Performance:** Embedded views must load in under 3 seconds  
* **Security:** Protect partner and admin credentials and data  
* **Accessibility:** All public-facing pages must meet WCAG 2.1 Level AA standards  
* **Usability:** Easy-to-navigate pages with minimal, clean design

## **5\. System Design**

### **Tech Stack**

* **Frontend:** HTML, CSS, JavaScript – builds embedded forms, catalog, and admin dashboard UI  
* **Backend:** Node.js and Express – handles authentication, workflow logic, and database queries  
* **Database:** MySQL – relational data model for organizations, users, roles, and events

### **User Interface Design**

#### **Embedded Submission Form (Partners and Public)**

* Accessible through submission link for trusted partners and public users  
* Streamlined submission for trusted partners (fewer required fields)  
* Longer submission process for unregistered public users  
* Supports optional event submission during registration

#### **Embedded Event Catalog (Public View)**

* Accessible to general public without authentication  
* Displays approved events only  
* Supports search and filter options

#### **Admin Dashboard (Moderation)**

* Accessible only to authenticated admins  
* Used to review pending submissions, approve/deny, and add feedback  
* Displays timestamps and status for tracking submissions

### **Role-Based Access Control**

| Role | Permissions |
| :---- | :---- |
| Super Administrator | Create/modify admin accounts, approve partner accounts, full access to moderation and management |
| Administrator | Review and moderate event submissions, approve/deny with feedback, cannot create admins |
| Trusted Partner | Submit events on behalf of organization, view submission status and history, request edits to approved events |
| Viewer | Browse, search, and filter approved events (no login required) |

### **Database Schema**

#### **Organizations**

| Field | Type | Description |
| :---- | :---- | :---- |
| org\_id | INT (PK) | Unique organization identifier |
| org\_name | VARCHAR(100) | Organization name |
| contact\_email | VARCHAR(255) | Primary contact email |
| contact\_phone | VARCHAR(15) | Contact phone number |
| status | ENUM | active, pending, disabled |

#### **Users**

| Field | Type | Description |
| :---- | :---- | :---- |
| user\_id | INT (PK) | Unique user identifier |
| email | VARCHAR(255) | User email (login) |
| password\_hash | VARCHAR(255) | Hashed password |
| role | ENUM | super\_admin, admin, partner |
| org\_id | INT (FK) | Linked organization (partners only) |

#### **Events**

| Field | Type | Description |
| :---- | :---- | :---- |
| event\_id | INT (PK) | Unique event identifier |
| org\_id | INT (FK) | Submitting organization |
| title | VARCHAR(150) | Event title |
| description | TEXT | Event description |
| start\_datetime | DATETIME | Event start date/time |
| end\_datetime | DATETIME | Event end date/time |
| address | VARCHAR(200) | Street address |
| city | VARCHAR(50) | City name |
| county | VARCHAR(50) | Connecticut county |
| audience | VARCHAR(100) | Target audience |
| cost | DECIMAL(6,2) | Event cost |
| event\_link | VARCHAR(500) | External event URL |
| contact\_email | VARCHAR(255) | Event contact email |
| status | ENUM | pending, approved, denied  |

### **![][image1]**

### **System Architecture**

#### **Components**

* WordPress pages host embedded views (submission form and public catalog)  
* Backend service handles authentication, business logic, and database operations  
* MySQL stores organizations, users, events, and workflow states  
* Admin dashboard is a protected interface for moderation

#### **Request Flow**

**Partner Registration:**

1. Organization submits registration details  
2. Details are stored and sent to admin for activation  
3. During registration, partner may optionally submit an event

**Event Submission:**

1. Partner submits event via form  
2. Submission is stored with "pending" status  
3. Partner dashboard displays submission status

**Moderation:**

1. Admin reviews pending submissions  
2. Admin approves or denies with optional feedback  
3. Approved events become visible in public catalog

**Public Browsing:**

1. Viewer accesses embedded catalog  
2. Only approved events are displayed  
3. Viewer can search and filter events

## **6\. Implementation Design**

### **Development Phases**

| Phase | Focus | Deliverables |
| :---- | :---- | :---- |
| Phase 1: Foundation | Setup & Authentication | WordPress plugin scaffold, database schema, user registration/login for users, partners, and admins |
| Phase 2: Admin Dashboard | Approval Workflow | Admin interface to view pending submissions, approve/deny functionality, status tracking |
| Phase 3: Submission System | Event Submission | Registration form with optional event submission, "Add another event" functionality, form validation |
| Phase 4: Public Catalog & Auth Flows | Event Display, Email Verification, Password Reset | Embedded event catalog, filtering system, interactive map integration, email verification on registration, self-service password reset via email |
| Phase 5: Polish & Testing | QA & Deployment | Bug fixes, cross-browser testing, performance optimization, deployment to subdomain |

### **Team Structure**

* **Alexander Rodriguez, Erica Suqui, Joe Youn:** Full-stack development with feature-based task assignment  
* **Client Communication:** Shared responsibility  
* **Testing/QA:** Completed by team members who finish their features early

### **Development Workflow**

* Feature-based task assignment via GitHub  
* Code reviewed before merging to main branch  
* Weekly client check-ins for feedback  
* Testing on local WordPress environment and subdomain staging site

### **Deployment Strategy**

* **Staging:** Subdomain environment for client review and testing  
* **Production:** John (STEM-ACT) will deploy from team's GitHub repository  
* **Version Control:** All code maintained in GitHub with documentation for handoff

## **7\. Risk Mitigation**

| Risk | Likelihood | Impact | Mitigation Strategy |
| :---- | ----- | ----- | :---- |
| Unfamiliar tech stack (WordPress/PHP) | High | Medium | Allocate extra time for learning; leverage team member with PHP experience; use WordPress documentation and tutorials |
| Scope creep | Medium | High | Document all agreed-upon features in SRS; require client sign-off before adding new features; maintain a "future enhancements" list |
| Plugin integration challenges | Medium | Medium | Test plugin on subdomain with same theme and plugins as production; follow WordPress coding standards; maintain communication with John about site configuration |
| Team availability conflicts | Medium | Medium | Feature-based assignments allow flexible scheduling; GitHub project board tracks progress |
| Unclear third-party dependencies | Medium | Low | Identify all external dependencies early in Phase 1; have fallback options ready |
| Timeline pressure | Medium | High | Prioritize core features over nice-to-haves; build MVP first, then iterate |

## **8\. Success Metrics**

### **Client Success Criteria**

| Metric | Target | How We'll Measure |
| :---- | :---- | :---- |
| Approval turnaround time | Within 24 hours of submission | Admin dashboard timestamps submission and approval times |
| Client satisfaction | Ms. Tokarski approves final prototype | Client sign-off at end of semester |
| Foundation for future development | Clean, documented, extensible codebase | Code review and documentation completeness |

### **Technical Metrics**

| Metric | Target |
| :---- | :---- |
| Page load time | Embedded views load in under 3 seconds |
| Form submission success rate | 99% of valid submissions save without error |
| Cross-browser compatibility | Functions correctly on Chrome, Firefox, Safari, Edge |
| Mobile responsiveness | All public-facing views usable on mobile devices |
| Accessibility compliance | Public-facing pages pass WCAG 2.1 AA automated checks |

### **User Metrics**

| Metric | Indicator of Success |
| :---- | :---- |
| Partner registration completion rate | Partners can complete registration without abandoning the form |
| Event submission volume | System handles expected submission volume without performance issues |
| Admin workflow efficiency | Admins process submissions faster than current manual method |

[image1]: <data:image/png;base64,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98ADD7j58+fbkhzDhg1za9ascW3atHHr16+3nq1Ro0ZZws9Nmza5yy67zMr79u3rXn/9dXfppZe6efPmuTFjxhSu2bp168Lnzz//3PXs2dPOveaaa9zOnTsrLNcTCji2jRo1srosso2Au+eeeyx54apVqwp12D755JPu6quvtqzx7Hfu3Lnk35c3svCpyD+Kg/iQT0VaFDtxgWUi4FhfjaV0WF9t48aNbt26da5///52DDHH1vfA+QWtr7/+erdw4UK3Y8cOy9zOGomsleivWdxrNmPGDNuSTXrixIkHFHCs04hw8+s0ci3/ahRr3Lix1SXZ6CmnnGLly5cvty37nOO/O49k4VORfxQH8SGfirQoduICy0TAFS/PsXXrVvfyyy+7Ll26WNnw4cNt6wUcvW5sjzrqKOuZ81ncH3vsMffPf/6zcM1bbrml8Jk1FNlOmDDB3X///Sbg2rZta0ILKxZwCMnt27fbuDe+wws4fy162qhD3ZYtW1rWeMp95niWA6rqmLmaIgufivyjOIgP+VSkRbETF1iNCDh60lgc95133nFPP/20HUM48RoUcUev25IlS6zXberUqe7LL790b7zxhrvkkksK12RhbD+BIRRw9O7t37/fzZkzx23evLmkB27atGlu7dq1bsqUKW769Okm4DZs2GCL9p5zzjlWx9el93DPnj2F17e9e/cu+ffljSx8KvKP4iA+5FORFsVOXGCZCLjqwr/WzAoW3vaCM8/UZp+KQ0de44De8bAsCYY5HHHEESXldZm8+lTkn+qKnUPdTqv6+9CtW7eSsroEVqsFHK9h69WrV1JeXXTo0KEwJi7P1GafikNHXuOgqjPOGcpAT3tYXpfJq09F/qmu2DnU7bSqvw9MigzL6hJYrRZwIhn5VEAWccDwiCZNmtjQCGaGM2mI8alMLFqwYIFNLGJoxEUXXWSzvotnnIfXYtgCQyD87PBTTz3Vhl3wOaxbV8nCpyJOkmKHYUq0WTomaK+UkXWB7VdffWUT+sLMENu2bbNsDUwuPOaYYyptp3v37nXdu3d3K1eudCNHjnS7du1yDRs2tGFMHK/s92H16tXWG8f3UXfFihWuWbNmljGCeosXL078HakrYBJwESKfCsgiDiZNmuR2795t41CZ3MOPPpOIgHGo/ED7uogztuWesC+++GK3bNky9+KLL9oP86F+so+B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>