-- Mock events seed data for STEM-ACT (Connecticut)
-- Mix of approved, pending, and denied events from both partners (org_id) and public (no org_id)

BEGIN;

INSERT INTO events (
  org_id, submitter_name, submitter_email, submitter_phone,
  title, description,
  start_datetime, end_datetime,
  address, city, county,
  audience, cost, hyperlink, event_contact,
  status, reviewed_at
) VALUES

-- APPROVED partner events
(NULL, NULL, NULL, NULL,
 'Robotics Workshop for Teens',
 'Hands-on robotics workshop where students build and program their own robots using LEGO Mindstorms. No experience necessary — all materials provided. Students will learn basic engineering principles and block-based coding.',
 '2026-04-05 09:00:00-05', '2026-04-05 12:00:00-05',
 '75 Elm Street', 'New Haven', 'New Haven',
 'Grades 6–12', 'Free', 'https://stemact.org', 'workshops@stemact.org',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Girls in STEM Day',
 'A full-day event celebrating and encouraging young women in science, technology, engineering, and math. Features panel discussions with local STEM professionals, hands-on lab activities, and networking opportunities.',
 '2026-04-12 08:30:00-05', '2026-04-12 16:00:00-05',
 '271 Whitney Avenue', 'New Haven', 'New Haven',
 'Girls ages 12–18', 'Free', NULL, 'girlsinstem@yale.edu',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'CT Science Fair Regional Qualifier',
 'Students from across Fairfield County present their independent research projects and compete for spots in the state science fair. Open to the public to attend and view presentations.',
 '2026-03-28 10:00:00-05', '2026-03-28 15:00:00-05',
 '100 Greyrock Place', 'Stamford', 'Fairfield',
 'Grades 7–12', 'Free admission', NULL, 'sciencefair@ctstem.org',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Intro to Python Programming',
 'A beginner-friendly two-session workshop introducing Python programming. Participants will write their first scripts, learn variables, loops, and functions, and build a small project by the end of session two.',
 '2026-04-19 10:00:00-05', '2026-04-19 13:00:00-05',
 '61 Woodland Street', 'Hartford', 'Hartford',
 'Adults & college students', '$10', 'https://eventbrite.com', 'code@hartfordtech.org',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Engineering Open House at UConn',
 'UConn''s School of Engineering opens its labs and research centers to prospective students and the public. Tour the facilities, meet faculty, and see cutting-edge research in action.',
 '2026-04-25 11:00:00-05', '2026-04-25 15:00:00-05',
 '261 Glenbrook Road', 'Storrs', 'Tolland',
 'Prospective students & families', 'Free', 'https://engr.uconn.edu', 'admissions@uconn.edu',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Nature & Technology: Citizen Science Hike',
 'Join conservation scientists on a guided hike through Litchfield Hills while collecting environmental data using mobile apps. Learn how technology supports ecological research.',
 '2026-05-03 09:00:00-05', '2026-05-03 12:00:00-05',
 '30 Headquarters Road', 'Litchfield', 'Litchfield',
 'Families, all ages', 'Free', NULL, 'nature@ctconservancy.org',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Math Olympiad Prep Camp',
 'Intensive weekend camp to help middle school students prepare for the AMC 8 and state math olympiad competitions. Topics include number theory, combinatorics, and geometry.',
 '2026-05-17 09:00:00-05', '2026-05-18 16:00:00-05',
 '45 Broad Street', 'Middletown', 'Middlesex',
 'Grades 5–8', '$25 per student', NULL, 'math@wesleyan.edu',
 'approved', now()),

(NULL, NULL, NULL, NULL,
 'Space Exploration Night at Mystic Seaport',
 'An evening of stargazing, telescope demonstrations, and talks by NASA ambassadors. Learn about current missions and the future of space exploration. Light refreshments provided.',
 '2026-05-10 19:00:00-05', '2026-05-10 22:00:00-05',
 '75 Greenmanville Avenue', 'Mystic', 'New London',
 'All ages', '$5 suggested donation', 'https://mysticseaport.org', NULL,
 'approved', now()),

-- PENDING events (awaiting admin review)
(NULL, 'Sandra Kim', 'sandra@windhamschools.org', '8604441234',
 'Hour of Code — Intro to Scratch',
 'Students at Windham High will guide younger students through their first coding experience using Scratch. Community members are invited to participate and learn alongside the kids.',
 '2026-04-08 14:00:00-05', '2026-04-08 16:00:00-05',
 '355 High Street', 'Willimantic', 'Windham',
 'Elementary & middle school', 'Free', NULL, 'sandra@windhamschools.org',
 'pending', NULL),

(NULL, 'Tom Brewer', 'tbrewer@fairfieldu.edu', '2034321000',
 'Biomedical Engineering Symposium',
 'Local biomedical engineering professionals and Fairfield University faculty present current research in prosthetics, medical imaging, and wearable health technology. Q&A session follows.',
 '2026-04-22 13:00:00-05', '2026-04-22 17:00:00-05',
 '1073 North Benson Road', 'Fairfield', 'Fairfield',
 'College students & professionals', 'Free', 'https://fairfield.edu', 'engineering@fairfield.edu',
 'pending', NULL),

(NULL, 'Maria Ortega', 'mortega@newhavenlibrary.org', '2035551678',
 'Coding Club for Kids — Summer Kickoff',
 'Launch of our summer coding club at the New Haven Free Public Library. Kids will explore Scratch, HTML basics, and game design over six weekly sessions.',
 '2026-06-07 10:00:00-05', '2026-06-07 11:30:00-05',
 '133 Elm Street', 'New Haven', 'New Haven',
 'Ages 8–13', 'Free', NULL, 'mortega@newhavenlibrary.org',
 'pending', NULL),

-- DENIED event
(NULL, 'Kevin Park', 'kpark@example.com', '8601239876',
 'Advanced Drone Racing Workshop',
 'Learn to fly FPV racing drones in a competitive setting. Participants must bring their own drone.',
 '2026-03-15 10:00:00-05', '2026-03-15 13:00:00-05',
 '500 Main Street', 'Hartford', 'Hartford',
 'Adults 18+', '$50', NULL, 'kpark@example.com',
 'denied', now());

COMMIT;
