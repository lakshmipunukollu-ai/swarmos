--
-- PostgreSQL database dump
--

\restrict O311wyIQdKBC8oTy0gwvRD0gIe8bT24xnjuNc6V2r3w2tuXVYzBObxALjK9x8S9

-- Dumped from database version 14.22 (Homebrew)
-- Dumped by pg_dump version 14.22 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: projectstatus; Type: TYPE; Schema: public; Owner: swarmos
--

CREATE TYPE public.projectstatus AS ENUM (
    'queued',
    'building',
    'testing',
    'done',
    'error'
);


ALTER TYPE public.projectstatus OWNER TO swarmos;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: build_logs; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.build_logs (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    message text NOT NULL,
    level character varying,
    phase character varying,
    created_at timestamp without time zone
);


ALTER TABLE public.build_logs OWNER TO swarmos;

--
-- Name: build_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.build_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.build_logs_id_seq OWNER TO swarmos;

--
-- Name: build_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.build_logs_id_seq OWNED BY public.build_logs.id;


--
-- Name: interview_messages; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.interview_messages (
    id integer NOT NULL,
    session_id integer NOT NULL,
    role character varying NOT NULL,
    content text NOT NULL,
    evaluation text,
    created_at timestamp without time zone
);


ALTER TABLE public.interview_messages OWNER TO swarmos;

--
-- Name: interview_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.interview_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.interview_messages_id_seq OWNER TO swarmos;

--
-- Name: interview_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.interview_messages_id_seq OWNED BY public.interview_messages.id;


--
-- Name: interview_sessions; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.interview_sessions (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    interview_type character varying NOT NULL,
    difficulty character varying,
    status character varying,
    score integer,
    feedback text,
    created_at timestamp without time zone,
    completed_at timestamp without time zone,
    target_company text DEFAULT ''::text
);


ALTER TABLE public.interview_sessions OWNER TO swarmos;

--
-- Name: interview_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.interview_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.interview_sessions_id_seq OWNER TO swarmos;

--
-- Name: interview_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.interview_sessions_id_seq OWNED BY public.interview_sessions.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.projects (
    id character varying NOT NULL,
    name character varying NOT NULL,
    company character varying NOT NULL,
    stack character varying NOT NULL,
    port integer,
    status public.projectstatus,
    phase character varying,
    files_count integer,
    live_url character varying,
    github_url character varying,
    last_log text,
    build_summary text,
    estimated_minutes integer,
    elapsed_seconds integer,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone,
    brief text DEFAULT ''::text,
    hiring_notes text DEFAULT ''::text,
    featured integer DEFAULT 0
);


ALTER TABLE public.projects OWNER TO swarmos;

--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.quiz_attempts (
    id integer NOT NULL,
    question_id integer NOT NULL,
    project_id character varying NOT NULL,
    user_answer text,
    is_correct integer,
    needs_review integer,
    created_at timestamp without time zone
);


ALTER TABLE public.quiz_attempts OWNER TO swarmos;

--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.quiz_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quiz_attempts_id_seq OWNER TO swarmos;

--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.quiz_attempts_id_seq OWNED BY public.quiz_attempts.id;


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.quiz_questions (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    question_type character varying NOT NULL,
    level integer,
    question text NOT NULL,
    correct_answer text NOT NULL,
    explanation text,
    times_shown integer,
    times_correct integer,
    created_at timestamp without time zone,
    wrong_answers text DEFAULT '[]'::text
);


ALTER TABLE public.quiz_questions OWNER TO swarmos;

--
-- Name: quiz_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.quiz_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quiz_questions_id_seq OWNER TO swarmos;

--
-- Name: quiz_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.quiz_questions_id_seq OWNED BY public.quiz_questions.id;


--
-- Name: study_questions; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.study_questions (
    id integer NOT NULL,
    session_id integer NOT NULL,
    question text NOT NULL,
    correct_answer text NOT NULL,
    wrong_answers text,
    explanation text,
    question_type character varying,
    level integer,
    times_shown integer,
    times_correct integer,
    created_at timestamp without time zone
);


ALTER TABLE public.study_questions OWNER TO swarmos;

--
-- Name: study_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.study_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.study_questions_id_seq OWNER TO swarmos;

--
-- Name: study_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.study_questions_id_seq OWNED BY public.study_questions.id;


--
-- Name: study_sessions; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.study_sessions (
    id integer NOT NULL,
    title character varying NOT NULL,
    subject character varying,
    content_type character varying,
    raw_content text,
    created_at timestamp without time zone
);


ALTER TABLE public.study_sessions OWNER TO swarmos;

--
-- Name: study_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.study_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.study_sessions_id_seq OWNER TO swarmos;

--
-- Name: study_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.study_sessions_id_seq OWNED BY public.study_sessions.id;


--
-- Name: study_timers; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.study_timers (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    session_type character varying NOT NULL,
    duration_seconds integer,
    questions_answered integer,
    correct_answers integer,
    created_at timestamp without time zone
);


ALTER TABLE public.study_timers OWNER TO swarmos;

--
-- Name: study_timers_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.study_timers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.study_timers_id_seq OWNER TO swarmos;

--
-- Name: study_timers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.study_timers_id_seq OWNED BY public.study_timers.id;


--
-- Name: weak_spots; Type: TABLE; Schema: public; Owner: swarmos
--

CREATE TABLE public.weak_spots (
    id integer NOT NULL,
    project_id character varying NOT NULL,
    topic character varying NOT NULL,
    interview_type character varying NOT NULL,
    avg_score integer,
    occurrences integer,
    last_seen timestamp without time zone
);


ALTER TABLE public.weak_spots OWNER TO swarmos;

--
-- Name: weak_spots_id_seq; Type: SEQUENCE; Schema: public; Owner: swarmos
--

CREATE SEQUENCE public.weak_spots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.weak_spots_id_seq OWNER TO swarmos;

--
-- Name: weak_spots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: swarmos
--

ALTER SEQUENCE public.weak_spots_id_seq OWNED BY public.weak_spots.id;


--
-- Name: build_logs id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.build_logs ALTER COLUMN id SET DEFAULT nextval('public.build_logs_id_seq'::regclass);


--
-- Name: interview_messages id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.interview_messages ALTER COLUMN id SET DEFAULT nextval('public.interview_messages_id_seq'::regclass);


--
-- Name: interview_sessions id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.interview_sessions ALTER COLUMN id SET DEFAULT nextval('public.interview_sessions_id_seq'::regclass);


--
-- Name: quiz_attempts id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.quiz_attempts ALTER COLUMN id SET DEFAULT nextval('public.quiz_attempts_id_seq'::regclass);


--
-- Name: quiz_questions id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.quiz_questions ALTER COLUMN id SET DEFAULT nextval('public.quiz_questions_id_seq'::regclass);


--
-- Name: study_questions id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_questions ALTER COLUMN id SET DEFAULT nextval('public.study_questions_id_seq'::regclass);


--
-- Name: study_sessions id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_sessions ALTER COLUMN id SET DEFAULT nextval('public.study_sessions_id_seq'::regclass);


--
-- Name: study_timers id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_timers ALTER COLUMN id SET DEFAULT nextval('public.study_timers_id_seq'::regclass);


--
-- Name: weak_spots id; Type: DEFAULT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.weak_spots ALTER COLUMN id SET DEFAULT nextval('public.weak_spots_id_seq'::regclass);


--
-- Data for Name: build_logs; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.build_logs (id, project_id, message, level, phase, created_at) FROM stdin;
\.


--
-- Data for Name: interview_messages; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.interview_messages (id, session_id, role, content, evaluation, created_at) FROM stdin;
1	1	interviewer	Hi there! I can see you've built an interesting agentic scheduler for Flight Schedule Pro. It looks like a pretty comprehensive system with multiple agents, authentication, and a full frontend. \n\nCan you start by walking me through your high-level architecture decisions - what led you to choose TypeScript with Express and PostgreSQL for the backend?		2026-03-18 00:03:13.949824
2	1	candidate	i dont know\n	{"score": 0, "strengths": [], "weaknesses": ["Complete lack of engagement with the question", "No demonstration of technical knowledge", "Failure to discuss their own project work", "No explanation of architecture decisions", "Unprofessional response for a technical interview"], "tip": "Even if you're uncertain about specific details, acknowledge the question and share any reasoning you can remember about your technology choices or ask for clarification about what aspects you should focus on."}	2026-03-18 00:03:38.660903
3	1	interviewer	No worries! Let's start simpler. Looking at your project, you built a flight scheduling system with some automated agents that make suggestions. \n\nWhat problem were you trying to solve with this system? Like, if I'm a flight school operator, what would this help me with day-to-day?		2026-03-18 00:03:38.660908
4	2	interviewer	Hi there! Thanks for taking the time to chat with me today about the engineering role at Replicated. I see you've built this really interesting K8s Bundle Analyzer project - it looks like you tackled some complex challenges around analyzing Kubernetes diagnostics and presenting insights to users. \n\nCan you start by telling me about a particularly challenging technical problem you faced while building this system and how you approached solving it?		2026-03-18 00:37:33.832314
5	2	candidate	hello how's it going	{"score": 5, "strengths": ["Friendly greeting tone"], "weaknesses": ["Completely ignored the technical question about challenging problems", "Failed to discuss any aspect of the K8s Bundle Analyzer project", "Showed no engagement with the project context provided", "Missed opportunity to demonstrate technical problem-solving skills", "Response lacks any substance or detail expected in a behavioral interview"], "tip": "Always directly address the interviewer's question - they asked about a challenging technical problem, so identify a specific technical challenge from your project and walk through your problem-solving approach", "ideal_answer": "One of the biggest challenges was implementing real-time progress tracking for the analysis pipeline using Server-Sent Events. The analysis involved multiple stages - extraction, signal detection, pattern matching, and LLM analysis - and users needed visibility into where their bundle was in the process. I solved this by designing an event-driven architecture where each pipeline stage emitted progress events to a message queue, which the SSE endpoint consumed and streamed to the frontend, giving users real-time feedback on their analysis status."}	2026-03-18 00:38:02.188763
6	2	interviewer	Hi! Going well, thanks. I'm excited to dive into your K8s Analyzer project - it's impressive that you built out both the real-time analysis pipeline and the full-stack interface.\n\nSo let me ask again - what was the most challenging technical problem you encountered while building this system? I'm particularly interested in how you approached the problem-solving process and what decisions you made along the way.		2026-03-18 00:38:02.188777
\.


--
-- Data for Name: interview_sessions; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.interview_sessions (id, project_id, interview_type, difficulty, status, score, feedback, created_at, completed_at, target_company) FROM stdin;
1	fsp-agentic-scheduler	technical	coaching	active	\N		2026-03-18 00:03:10.695866	\N	
2	replicated-k8s-analyzer	behavioral	balanced	active	\N		2026-03-18 00:37:30.092096	\N	Replicated
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.projects (id, name, company, stack, port, status, phase, files_count, live_url, github_url, last_log, build_summary, estimated_minutes, elapsed_seconds, started_at, completed_at, created_at, brief, hiring_notes, featured) FROM stdin;
zeropath-security-scanner	Security Scanner	ZeroPath	Python + React	3006	done	done	124	https://zeropath-security-scanner-production.up.railway.app	https://github.com/lakshmipunukollu-ai/zeropath-security-scanner		# Build Summary - ZeroPath Security Scanner\n\n## Project Overview\nLLM-powered security vulnerability scanner for Python codebases with a React frontend and FastAPI backend.\n\n## Completed Phases\n\n### Phase 1: Architecture (merged to main)\n- System architecture design with data models, API contracts, and scanner engine pipeline\n- Technology decisions: SQLAlchemy 1.4, psycopg2-binary, JWT auth, Claude for scanning\n\n### Phase 2: Backend (merged to main)\n- FastAPI application with lifespan pattern\n- User authentication with JWT (python-jose + bcrypt)\n- Scan submission with background threading\n- Scanner engine: repo cloning, file indexing, code chunking, LLM analysis\n- Deduplication engine with semantic fingerprinting\n- Finding triage (open/false_positive/resolved)\n- Repository history and delta analysis endpoints\n- Database seed script with demo data\n\n### Phase 3: Frontend (merged to main)\n- React + TypeScript SPA with react-router-dom\n- Authentication pages (login/register) with JWT token management\n- Scan submission page with real-time progress polling\n- Findings list with severity/status/confidence filters and sorting\n- Finding detail view with code snippets, attack scenarios, remediation\n- Triage buttons for each finding\n- Repository history timeline\n- Delta view (new/fixed/persisting findings between scans)\n- Professional dark theme with responsive layout\n\n### Phase 4: Tests (merged to main)\n- 44 backend tests, all passing with 0 failures\n- Auth tests: registration, login, duplicates, token validation\n- Scan tests: creation, status, findings retrieval, filtering\n- Finding tests: triage transitions, validation, authorization\n- Repo tests: history, delta analysis\n- Scanner tests: file indexing, chunking\n- Deduplication tests: fingerprinting, delta classification\n\n### Phase 5: Finalization\n- Makefile with dev, test, seed, build targets\n- README.md with setup instructions\n- BUILD_SUMMARY.md (this file)\n- .agent_status.json\n\n## Port Configuration\n- API: 3006\n- Frontend: 5006\n- Database: zeropath_scanner\n\n## Key Files\n- `backend/app/main.py` - FastAPI application entry point\n- `backend/app/scanner/engine.py` - LLM-powered scanner pipeline\n- `backend/app/scanner/deduplication.py` - Semantic fingerprinting\n- `frontend/src/App.tsx` - React router and app structure\n- `frontend/src/hooks/useApi.ts` - API client\n- `frontend/src/components/FindingCard.tsx` - Finding detail and triage UI\n	150	365828	2026-03-14 00:54:27.653261	2026-03-14 01:00:48.253848	2026-03-14 00:54:27.637244			0
devtracker	DevTracker	Pathfinder	Node.js + Express + React + PostgreSQL + SendGrid	0	queued	queued	0					240	0	\N	\N	2026-03-17 21:44:24.016546			0
companycam-content-detection	Content Detection	CompanyCam	Python + YOLO + React	3008	done	done	136	https://companycam-content-detection-production.up.railway.app	https://github.com/lakshmipunukollu-ai/companycam-content-detection		# Build Summary - CompanyCam Content Detection\n\n## Project Overview\n\nCompanyCam Content Detection is a full-stack web application for intelligent construction photo analysis. It uses a two-stage pipeline combining computer vision (YOLOv8) and LLM analysis (Claude Vision) to detect materials, damage, and equipment in job site photos. Contractors can review, correct, and track detection accuracy over time.\n\n## Architecture\n\n### Backend (FastAPI + PostgreSQL)\n- **Framework**: FastAPI with lifespan pattern for startup/shutdown\n- **ORM**: SQLAlchemy 1.4 using `session.query()` style\n- **Database**: PostgreSQL with psycopg2-binary driver\n- **Auth**: JWT tokens via python-jose, bcrypt password hashing via passlib\n- **Detection Pipeline**: Two-stage architecture:\n  - Stage 1: YOLOv8 object detection (with mock fallback)\n  - Stage 2: Claude Vision API for semantic classification and damage assessment\n- **Port**: 3008\n\n### Frontend (React + TypeScript + Vite)\n- **Framework**: React 18 with TypeScript\n- **Build Tool**: Vite 8\n- **Routing**: react-router-dom v7\n- **HTTP Client**: Axios with JWT interceptors\n- **Port**: 5008 (dev server proxies API calls to backend)\n\n### Database Schema (7 tables)\n- `users` - Authentication and roles (contractor, admin, reviewer)\n- `projects` - Job site groupings\n- `photos` - Uploaded images with type and status tracking\n- `detections` - Bounding box detections from CV pipeline\n- `classifications` - Semantic classifications from LLM\n- `damage_assessments` - Damage type, severity, repair urgency\n- `corrections` - User feedback on detection accuracy\n\n## Features Implemented\n\n### Authentication\n- User registration with role selection\n- JWT-based login with 24-hour token expiry\n- Protected routes on both frontend and backend\n- Auth context with localStorage persistence\n\n### Project Management\n- Full CRUD for projects (name, description, address, status)\n- Project listing with status badges\n- Owner-scoped access control\n\n### Photo Upload & Analysis\n- Drag-and-drop file upload (mobile-friendly)\n- Photo type selection (roof, delivery, materials, general)\n- Auto-analyze option triggers pipeline on upload\n- Status tracking: pending -> analyzing -> completed/failed\n- Photo grid view with thumbnails\n\n### Annotation Viewer\n- Canvas-based rendering of photos with bounding box overlays\n- Color-coded detection boxes with labels and confidence scores\n- Click-to-select detection highlighting\n- Responsive scaling to container width\n\n### Correction Feedback Loop\n- Select any detection to submit corrections\n- Correction types: label fix, delete (false positive), bbox adjustment\n- Notes field for contractor explanations\n- Original vs corrected values stored for ML training signal\n\n### Project Reports\n- Aggregate material summary (counts by type with units)\n- Damage summary (counts by type and severity)\n- Detection accuracy stats (total detections, corrections, accuracy rate)\n- Visual accuracy bar chart\n\n## API Endpoints (18 total)\n\n| Category | Endpoints |\n|----------|-----------|\n| Health | GET /health |\n| Auth | POST /auth/register, POST /auth/login, GET /auth/me |\n| Projects | POST/GET/GET/PUT/DELETE /projects |\n| Photos | POST /photos/upload, POST /photos/analyze, GET/GET/DELETE /photos |\n| Corrections | POST/GET /photos/{id}/corrections |\n| Reports | GET /reports/{projectId} |\n\n## Test Suite\n\n**60 tests, 0 failures** across 8 test files:\n\n| File | Tests | Coverage |\n|------|-------|----------|\n| test_health.py | 2 | Health endpoint |\n| test_jwt.py | 5 | Password hashing, token create/decode |\n| test_auth.py | 9 | Register, login, me, error cases |\n| test_projects.py | 11 | CRUD, auth, not found |\n| test_photos.py | 12 | Upload, list, get, results, delete |\n| test_corrections.py | 7 | Create, list, error cases |\n| test_reports.py | 7 | Report generation, accuracy, empty |\n| test_models.py | 7 | All SQLAlchemy models |\n\nTests use PostgreSQL with savepoint-based transaction isolation for clean test state.\n\n## Makefile Commands\n\n| Command | Description |\n|---------|-------------|\n| `make dev` | Start backend on port 3008 |\n| `make test` | Run 60 tests |\n| `make seed` | Seed database with sample data |\n| `make build` | Install deps and build frontend |\n| `make frontend-dev` | Start frontend dev server on port 5008 |\n| `make install` | Install backend Python dependencies |\n\n## Environment Variables\n\n| Variable | Purpose |\n|----------|---------|\n| DATABASE_URL | PostgreSQL connection string |\n| JWT_SECRET | Secret key for JWT signing |\n| ANTHROPIC_API_KEY | Claude Vision API key |\n| PORT | Backend server port (3008) |\n| VITE_API_URL | Frontend API base URL |\n| UPLOAD_DIR | Photo upload directory |\n\n## Key Design Decisions\n\n1. **Mock detector fallback**: When YOLO model is unavailable, a mock detector generates realistic construction-related bounding boxes, allowing the full pipeline to work without model files.\n2. **Savepoint-based test isolation**: Tests use PostgreSQL savepoints instead of SQLite, ensuring test behavior matches production and supporting PostgreSQL-specific features (UUID, JSONB).\n3. **Canvas-based annotation rendering**: Uses HTML5 Canvas for bounding box rendering instead of SVG or CSS overlays, providing better performance with many detections and enabling click-to-select functionality.\n4. **Synchronous analysis**: Analysis runs synchronously for simplicity. Can be extended with background job queue for production scale.\n5. **Vite proxy**: Frontend dev server proxies /api and /uploads requests to the backend, avoiding CORS issues during development.\n	130	0	\N	2026-03-14 00:54:27.655936	2026-03-14 00:54:27.637248			0
fsp-agentic-scheduler	FSP Scheduler	Flight Schedule Pro	TypeScript + React	3001	done	done	224	https://fsp-agentic-scheduler-production.up.railway.app	https://github.com/lakshmipunukollu-ai/fsp-agentic-scheduler		# Build Summary - FSP Agentic Scheduler\n\n## Project Status: COMPLETE\n\n## What Was Built\n\n### Backend (TypeScript + Express + PostgreSQL)\n- Full REST API with 16 endpoints\n- JWT authentication with role-based access control (admin, scheduler, viewer)\n- Multi-tenant database with operator_id isolation on all tables\n- 5 database tables: operators, users, suggestions, audit_log, schedule_events\n- 4 agent modules: WaitlistAgent, RescheduleAgent, DiscoveryFlightAgent, NextLessonAgent\n- Configurable scoring engine with weighted signals\n- Schedule watcher for event processing\n- FSP webhook receiver\n- Simulated FSP API client with realistic mock data\n- Seed data with demo operator, users, and sample suggestions\n\n### Frontend (React + TypeScript + Vite)\n- Login page with JWT authentication\n- Dashboard with live statistics (pending, approved today, declined today, avg response time)\n- Approval Queue with filtering by status/type, individual and bulk approve/decline, expandable rationale viewer showing candidate scores and constraints\n- Activity Feed with paginated immutable audit log\n- Policy Config with priority weight sliders, general settings, and feature flag toggles\n- Sidebar navigation with user info\n\n### Tests (Jest + Supertest)\n- 9 test suites, 54 tests, 0 failures\n- Coverage: health endpoint, auth routes, suggestions CRUD, dashboard stats, webhooks, middleware, scoring engine, agent logic, FSP client\n\n## Key Technical Decisions\n1. Single-process architecture (API + agents in same Express app) for demo simplicity\n2. Simulated FSP API since actual API access unavailable\n3. Database uses `DATABASE_URL` connection string from `.env`\n4. Frontend proxies API calls through Vite dev server to port 3001\n5. All secrets loaded from `.env` file, never hardcoded\n\n## Ports\n- API: 3001\n- Frontend: 5001\n- Database: fsp_scheduler on localhost:5432\n\n## Bug Fixed During Development\n- NextLessonAgent.getNextLesson produced double-dash in lesson names (regex fix)\n\n## Branches Merged\n1. `architecture/fsp-agentic-scheduler` -> main (pre-existing)\n2. `backend/fsp-agentic-scheduler` -> main (PR #2)\n3. `frontend/fsp-agentic-scheduler` -> main (PR #3)\n4. `tests/fsp-agentic-scheduler` -> main (PR #4)\n	180	0	\N	2026-03-14 00:54:27.641639	2026-03-14 00:54:27.637233		{"strengths": ["Multi-tenant architecture with operator_id on every table shows understanding of B2B SaaS fundamentals - most junior devs build single-tenant and retrofit later", "Explainability-first AI design with detailed rationale and scoring breakdown demonstrates understanding that production AI systems need human oversight and auditability", "Conservative 'suggest don't automate' approach shows mature product thinking - avoiding the common trap of over-automating critical business processes", "Proper separation of concerns with specialized agents (WaitlistAgent, RescheduleAgent, etc.) rather than one monolithic scheduler - shows system design skills", "Event-driven architecture with schedule_events table for async processing shows understanding of how to handle external integrations reliably", "Comprehensive audit logging with user_id tracking demonstrates security and compliance awareness from day one", "Modular agent architecture designed for future microservice separation while keeping demo simple - shows pragmatic engineering tradeoffs"], "talking_points": ["Lead with: The multi-tenant architecture decision - walk through how operator_id isolation works and why you chose this over schema-per-tenant or database-per-tenant approaches", "Mention: The explainable AI scoring system - show how the ScoringEngine.ts provides weighted scores with rationale that dispatchers can understand and audit", "If asked about scale: Explain the single-process architecture choice for demo simplicity but how the modular agent design allows easy separation into microservices when needed"], "gaps_to_fill": [{"what": "Add rate limiting middleware using express-rate-limit", "why": "Shows production API security awareness", "effort": "1 hour"}, {"what": "Add database connection pooling configuration", "why": "Demonstrates understanding of production database performance", "effort": "30 minutes"}, {"what": "Add input validation using Joi or Zod on API endpoints", "why": "Shows data validation best practices", "effort": "2 hours"}], "red_flags": ["HS256 JWT with 24-hour expiration - be ready to explain why you chose this over RS256 for a multi-tenant system and discuss refresh token strategy", "Single-process architecture - emphasize this was a conscious demo decision and explain the migration path to separate services", "No mention of FSP API authentication/rate limits - be prepared to discuss how you'd handle external API constraints in production"]}	0
upstream-ecommerce	E-commerce	Upstream Literacy	Django + React + Stripe	3009	done	done	124	https://upstream-ecommerce-production.up.railway.app	https://github.com/lakshmipunukollu-ai/upstream-ecommerce		# Build Summary - Upstream Literacy E-Commerce\n\n## Project Overview\nFull-stack e-commerce platform for educational literacy materials targeting K-8 school districts.\n\n## Architecture\n- **Backend**: Django 5 + Django REST Framework on port 3009\n- **Frontend**: React 18 + TypeScript + Vite on port 5009\n- **Database**: SQLite (dev), PostgreSQL-ready (production)\n- **Auth**: JWT via djangorestframework-simplejwt\n- **Payments**: Stripe integration (Payment Intents)\n- **AI**: Anthropic Claude API for curriculum recommendations\n\n## Backend Apps\n| App | Models | Endpoints | Description |\n|-----|--------|-----------|-------------|\n| accounts | User, DistrictProfile | 5 | JWT auth, user profiles, district demographics |\n| products | Category, Product | 6 | CRUD catalog with search, filtering by category/grade |\n| cart | Cart, CartItem | 5 | Session-based guest + authenticated user carts |\n| orders | Order, OrderItem | 5 | Checkout flow, Stripe webhooks, order history |\n| inventory | (uses Product) | 3 | Stock levels, low-stock alerts, admin stock updates |\n| recommendations | (uses multiple) | 1 | AI-powered curriculum suggestions with fallback |\n\n## Frontend Pages\n- Home (featured products)\n- Product List (with search/filter)\n- Product Detail (with add-to-cart)\n- Shopping Cart (quantity management)\n- Checkout (shipping address form)\n- Order Confirmation\n- Order History\n- Login / Register\n- Profile (personal + district info)\n- Inventory Management (admin)\n- AI Recommendations\n\n## Test Coverage\n- **56 total tests** across all backend apps\n- All tests pass (`make test` exits 0)\n- 1 test skipped (SQLite JSON contains limitation)\n- Coverage: models, views, serializers, permissions, seed command, health check\n\n## Seed Data\n- 6 categories (Phonics, Reading Comprehension, Writing, Vocabulary, ELL/Bilingual, Intervention)\n- 10 products with realistic literacy curriculum descriptions\n- 2 users (admin + teacher with district profile)\n\n## Key Decisions\n1. SQLite for development, PostgreSQL-ready via dj-database-url\n2. UUID primary keys on all models for security\n3. Session-based guest carts for unauthenticated users\n4. Soft-delete for products (is_active flag)\n5. Fallback recommendations when AI API unavailable\n6. Inline styles for frontend (no external CSS framework dependency)\n	150	0	\N	2026-03-14 00:54:27.657332	2026-03-14 00:54:27.63725			0
st6-weekly-commit	Weekly Commit	ST6	Java 21 + React	8081	done	done	195	https://st6-weekly-commit-production.up.railway.app	https://github.com/lakshmipunukollu-ai/st6-weekly-commit		# Build Summary - ST6 Weekly Commit Module\n\n## Project Status: COMPLETE\n\n## What Was Built\n\n### Backend (Spring Boot 3.2, Java 21)\n- JWT authentication with BCrypt password hashing\n- Role-based access control (MEMBER, MANAGER, ADMIN)\n- Commit CRUD with state machine (DRAFT -> LOCKED -> RECONCILING -> RECONCILED -> CARRIED_FORWARD)\n- State transition validation and logging\n- RCDO hierarchy (Rally Cries, Defining Objectives, Outcomes)\n- Commit entries with priority ordering\n- Reconciliation (planned vs actual comparison)\n- Carry-forward of incomplete items to next week\n- Manager team dashboard with aggregated views\n- Data seeder with sample users and RCDO data\n- Health endpoint at GET /health\n\n### Frontend (React 19, TypeScript, Vite)\n- Login and registration pages\n- Weekly commit management with create, edit, lock, reconcile flows\n- State machine visualization showing current state\n- RCDO hierarchy linker with cascading dropdowns\n- Commit entry management (add, edit, delete, reorder)\n- Reconciliation view (planned vs actual with completion status)\n- Manager dashboard with team commit roll-up\n- JWT token management via Axios interceptors\n- Vite dev server with API proxy to backend\n\n### Tests (32 total)\n- 19 backend tests (JUnit 5, Spring Boot Test, H2)\n- 13 frontend tests (Vitest, React Testing Library, jsdom)\n- `make test` exits 0\n\n### Infrastructure\n- Docker Compose with PostgreSQL, backend, and frontend services\n- Makefile with dev, test, seed, build, clean targets\n- Environment-based configuration via .env\n\n## Port Configuration\n- API: 8081\n- Frontend: 5005\n- Database: st6_weekly_commit on PostgreSQL 5432\n\n## PRs Merged\n1. PR #1: Architecture (pre-existing)\n2. PR #2: Backend - Spring Boot with JWT auth and state machine\n3. PR #3: Frontend - React micro-frontend\n4. PR #4: Tests - 32 comprehensive tests\n	210	0	\N	2026-03-14 00:54:27.652	2026-03-14 00:54:27.637243			0
medbridge-health-coach	Health Coach	Medbridge	Python + LangGraph	3007	done	done	96	https://medbridge-health-coach-production-3808.up.railway.app	https://github.com/lakshmipunukollu-ai/medbridge-health-coach		# Build Summary - Medbridge AI Health Coach\n\n## Project Status: COMPLETE\n\n## What Was Built\n\n### Backend (FastAPI + LangGraph)\n- FastAPI application with lifespan pattern (not deprecated @app.on_event)\n- LangGraph-based deterministic state machine with 5 phases: PENDING, ONBOARDING, ACTIVE, RE_ENGAGING, DORMANT\n- Non-negotiable safety guard: keyword-based mental health crisis detection and clinical content redirect\n- SQLAlchemy 1.4 ORM with session.query() style (not 2.0 select())\n- PostgreSQL via psycopg2-binary with postgresql:// prefix\n- Full CRUD for patients, coaching sessions, and webhook endpoints\n- Agent tools: set_goal, set_reminder, get_program_summary, get_adherence_summary, alert_clinician\n\n### Frontend (React)\n- Clinical dashboard with patient search and phase statistics\n- New Patient creation form with consent verification\n- Patient detail page with engagement summary, phase timeline, and safety alerts\n- Real-time chat session interface with safety flag indicators\n- API client connecting to backend on port 3007\n- CORS middleware configured for frontend-backend communication\n\n### Tests (pytest)\n- 82 tests, 0 failures\n- Coverage: health check, patient CRUD, sessions, webhooks, safety guard, state machine routing\n- Parametrized tests for all mental health and clinical trigger keywords\n- Integration tests for full phase transition workflows\n\n## Technical Decisions\n- SQLAlchemy 1.4 style (session.query) as required\n- psycopg2-binary with postgresql:// prefix\n- FastAPI lifespan pattern\n- Safety guard uses keyword matching (not LLM) for reliability and zero latency\n- Phase transitions are deterministic application logic, never LLM decisions\n- SQLite used for test isolation\n\n## Port Configuration\n- API: 3007\n- Frontend: 3000\n- Database: medbridge_coach\n\n## Makefile Targets\n- `make dev` - Start backend API on port 3007\n- `make dev-frontend` - Start React frontend on port 3000\n- `make test` - Run 82 tests\n- `make seed` - Seed sample patient data\n- `make build` - Install all dependencies\n- `make clean` - Remove caches and build artifacts\n	140	0	\N	2026-03-14 00:54:27.654675	2026-03-14 00:54:27.637245			0
zapier-triggers-api	Triggers API	Zapier	Python + FastAPI + Redis	3004	done	done	76	https://zapier-triggers-api-production.up.railway.app	https://github.com/lakshmipunukollu-ai/zapier-triggers-api		# Build Summary — Zapier Triggers API\n\n## Project Overview\n\nEvent ingestion and reliable delivery platform for Zapier. Supports push (webhook) and pull (inbox polling) delivery with at-least-once guarantees.\n\n## What Was Built\n\n### Backend (FastAPI + SQLAlchemy + Redis + PostgreSQL)\n\n- **Event ingestion** with SHA256 idempotency keys and 60s dedup window\n- **Inbox polling** with SQS-style 30s visibility timeout locking\n- **Event acknowledgment** and deletion with Redis lock cleanup\n- **Subscription management** with webhook URL support and wildcard matching\n- **Delivery worker** (background async) with exponential backoff retry (7 attempts)\n- **Dead letter queue** for events that exhaust all retry attempts\n- **JWT authentication** with role-based access control\n- **Health check** monitoring database and Redis connectivity\n- **Metrics endpoint** with event counts by status and average delivery time\n\n### Frontend (React + Vite)\n\n- **Metrics panel** with auto-refresh showing event counts and delivery latency\n- **Event explorer** with source/type filters, creation form, ack, delete, and status detail\n- **Subscription manager** with CRUD operations\n- **Health status indicator** showing API, database, and Redis connectivity\n- API proxy from port 5004 to backend on port 3004\n\n### Tests\n\n- **45 tests** all passing\n- Covers: event CRUD, inbox polling, filters, idempotency, ack/delete, subscriptions CRUD, matching logic, metrics, JWT auth, health check\n- Uses SQLite in-memory + mocked Redis for fast isolated testing\n\n## Technology Stack\n\n| Component | Technology |\n|-----------|-----------|\n| API | FastAPI (Python 3.11) |\n| ORM | SQLAlchemy 1.4 (session.query style) |\n| Database | PostgreSQL |\n| Queue/Cache | Redis |\n| Auth | JWT (python-jose + passlib) |\n| Frontend | React 18 + Vite |\n| Testing | pytest + FastAPI TestClient |\n\n## Port Configuration\n\n- API: 3004\n- Frontend: 5004\n- Database: zapier_triggers\n- Redis: redis://localhost:6380\n\n## Key Commands\n\n```bash\nmake dev    # Start API server\nmake test   # Run tests (45 passing)\nmake seed   # Seed sample data\nmake build  # Install deps + build frontend\n```\n	90	0	\N	2026-03-14 00:54:27.64823	2026-03-14 00:54:27.637242			0
servicecore-timetracking	Time Tracking	ServiceCore	Angular + Node	3003	done	done	102	https://servicecore-timetracking-production.up.railway.app	https://github.com/lakshmipunukollu-ai/servicecore-timetracking		# Build Summary - ServiceCore Time Tracking\n\n## Project Overview\nEmployee time tracking and payroll dashboard for field service businesses. Built with Angular 17 frontend and Node.js/Express backend with PostgreSQL database.\n\n## What Was Built\n\n### Backend (Node.js + Express)\n- JWT authentication with bcrypt password hashing and role-based access control\n- Clock in/out API with GPS coordinate capture\n- Time entry CRUD with ownership and status validation\n- Timesheet submission and manager approval workflow (draft -> submitted -> approved/rejected)\n- Payroll report generation with overtime calculations (40h regular, 1.5x overtime)\n- AI anomaly detection using Claude API with rule-based fallback\n- Project management endpoints\n\n### Frontend (Angular 17)\n- **LoginComponent** - Authentication form with demo account quick-fill buttons\n- **ClockWidgetComponent** - Real-time elapsed timer, GPS capture, project selector, break minutes input\n- **TimesheetViewComponent** - Weekly grid with date navigation, hours calculation, submit actions, status badges\n- **ManagerQueueComponent** - Pending approval list with approve/reject workflow and rejection reason input\n- **PayrollReportComponent** - Date range selection, per-employee breakdown with overtime calculation\n- **AnomalyAlertsComponent** - Severity-colored anomaly display with AI analysis trigger\n- **DashboardComponent** - Sidebar navigation with role-based menu items\n\n### Services\n- AuthService, TimeEntryService, TimesheetService, ReportService, AnomalyService, ProjectService\n- JWT auth interceptor for automatic token attachment\n\n### Tests\n- 56 backend API tests covering all routes\n- Mocked PostgreSQL pool for isolated testing\n- Tests for auth, clock, time entries, timesheets, projects, reports, anomalies\n- Verifies role-based access control and overtime calculations\n\n## Port Configuration\n- API: 3003\n- Frontend: 5003 (dev server)\n- Database: servicecore_timetracking\n\n## Commands\n- `make install` - Install all dependencies\n- `make dev` - Start API server\n- `make test` - Run test suite (56 tests, 0 failures)\n- `make seed` - Migrate and seed demo data\n- `make build` - Build frontend for production\n\n## AI Integration\n- Claude API for intelligent timesheet anomaly detection\n- Rule-based fallback when API is unavailable\n- Detects: unusual hours, missing breaks, off-hours work, data entry errors\n- Results stored in anomaly_flags table for review\n	120	0	\N	2026-03-14 00:54:27.647045	2026-03-14 00:54:27.637241			0
replicated-k8s-analyzer	K8s Analyzer	Replicated	Python + Next.js	3002	done	done	5470	https://replicated-k8s-analyzer-production.up.railway.app	https://github.com/lakshmipunukollu-ai/replicated-k8s-analyzer		# Build Summary - Replicated K8s Bundle Analyzer\n\n## Project Status: COMPLETE\n\n## What Was Built\n\n### Backend (FastAPI/Python)\n- Complete REST API with 7 endpoints (health, upload, list, detail, analyze, SSE status, report)\n- SQLAlchemy 1.4 models for bundles, findings, and analysis events\n- Analysis pipeline: extraction, signal detection, pattern matching, LLM analysis, report building\n- SSE streaming for real-time analysis progress\n- Database seed script with sample K8s bundle data\n- Port: 3002\n\n### Frontend (Next.js 14/React/TypeScript)\n- Upload page with drag-and-drop file upload\n- Diagnostics dashboard showing all bundles with status indicators\n- Bundle detail page with real-time SSE analysis progress\n- Finding cards with severity badges, evidence, and recommendations\n- Full report view with severity/category breakdown charts\n- Port: 5002\n\n### Tests\n- 35 comprehensive tests (all passing)\n- Covers: API endpoints, database models, signal extraction, pattern matching, report building, LLM fallback\n\n### Infrastructure\n- Makefile with dev, test, seed, build targets\n- PostgreSQL database (replicated_analyzer)\n- Environment-based configuration\n\n## Branches Merged\n1. `architecture/replicated-k8s-analyzer` -> main (PR #1)\n2. `backend/replicated-k8s-analyzer` -> main (PR #2)\n3. `frontend/replicated-k8s-analyzer` -> main (PR #3)\n4. `tests/replicated-k8s-analyzer` -> main (PR #4)\n\n## Key Technical Decisions\n- SQLAlchemy 1.4 with session.query() style (not 2.0 select)\n- psycopg2-binary for PostgreSQL\n- FastAPI lifespan pattern (not @app.on_event)\n- SQLite for testing, PostgreSQL for production\n- Synthetic LLM findings when API key unavailable\n	150	0	\N	2026-03-14 00:54:27.645235	2026-03-14 00:54:27.63724		{"strengths": ["Real-time streaming architecture with SSE shows understanding of user experience - most juniors would build a polling solution or make users wait for a full analysis to complete", "Hybrid analysis approach (pattern matching + LLM fallback) demonstrates cost-conscious engineering - using expensive LLM calls only when rule-based systems fail, rather than throwing AI at everything", "Proper async pipeline with SQLAlchemy session management and error boundaries shows production database thinking beyond basic CRUD operations", "File extraction with security considerations (tar.gz handling) and structured indexing by file type shows awareness of potential zip bomb attacks and processing efficiency", "Database schema includes analysis_events table for audit trail and debugging - most candidates skip observability in portfolio projects", "Authentication with JWT and route guards implemented properly with context providers, not just basic auth middleware"], "talking_points": ["Lead with: 'I built a streaming analysis pipeline that processes 100MB+ support bundles in real-time. The key was breaking analysis into 5 async stages with SSE progress updates, so users see results as they're found rather than waiting 2-3 minutes for completion.'", "Mention: 'I implemented a cost-optimized hybrid analysis - pattern matching catches 80% of common K8s issues instantly, then Claude LLM analyzes only the unknown patterns. This keeps API costs low while handling edge cases humans would miss.'", "If asked about scale: 'The pipeline is designed for horizontal scaling - each analysis stage is stateless and communicates through the database, so you could run multiple workers processing different bundles or even different stages of the same bundle.'"], "gaps_to_fill": [{"what": "Add API rate limiting with Redis", "why": "Shows production API design awareness and prevents abuse of expensive LLM endpoints", "effort": "3 hours"}, {"what": "Add basic metrics/observability with Prometheus endpoints", "why": "Demonstrates understanding that portfolio projects should show monitoring thinking, not just feature development", "effort": "2 hours"}, {"what": "Add bundle analysis caching by file hash", "why": "Shows optimization thinking - identical support bundles shouldn't require re-analysis, and hiring managers notice efficiency improvements", "effort": "4 hours"}], "red_flags": ["SQLAlchemy 1.4 session.query style is deprecated - be ready to explain this was chosen for familiarity and that you understand 2.0's async/await patterns are preferred for new projects", "No input validation on file uploads beyond basic type checking - be prepared to discuss how you'd add file size limits, content validation, and virus scanning for production", "Claude API key likely hardcoded or in env vars without rotation - discuss how you'd implement proper secrets management with AWS Secrets Manager or similar", "No database migrations shown - explain how you'd handle schema changes in production with Alembic migration files", "Authentication is JWT but no refresh token mechanism - be ready to discuss token expiration strategies and security implications"]}	0
\.


--
-- Data for Name: quiz_attempts; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.quiz_attempts (id, question_id, project_id, user_answer, is_correct, needs_review, created_at) FROM stdin;
1	2	replicated-k8s-analyzer	We designed a three-table schema: bundles (main entity), findings (one-to-many with bundles), and analysis_events (one-to-many with bundles for tracking progress). This structure separates concerns - bundles store metadata and status, findings store actual analysis results with severity/category/evidence, and analysis_events enable real-time SSE progress tracking. The one-to-many relationships allow multiple findings per bundle and granular event logging.	1	0	2026-03-14 01:05:13.170035
2	1	replicated-k8s-analyzer	The select() style in 2.0 doesn't support the complex queries we needed for analyzing K8s bundle data	0	1	2026-03-14 01:05:14.353948
3	3	replicated-k8s-analyzer	SSE was the right choice because we needed unidirectional communication (server-to-client only) for progress updates. Unlike WebSockets, SSE is simpler to implement, automatically handles reconnection, and works better with HTTP infrastructure like load balancers and proxies. Compared to polling, SSE provides real-time updates without the overhead of constant HTTP requests, which is important during the analysis pipeline that can take time to process large K8s bundles.	1	0	2026-03-14 01:05:20.375916
4	4	replicated-k8s-analyzer	We designed a multi-stage pipeline to separate concerns and enable incremental processing: extraction parses the K8s bundle structure, signal detection finds specific indicators (resource limits, error patterns), pattern matching applies rule-based analysis for known issues, and LLM analysis provides intelligent insights on complex problems. This separation allows each stage to be tested independently, makes the system more maintainable, and enables us to fall back to synthetic findings if the LLM is unavailable.	1	0	2026-03-14 01:05:24.792325
5	5	replicated-k8s-analyzer	The ports were chosen randomly and don't have any architectural significance	0	1	2026-03-14 01:05:33.867917
\.


--
-- Data for Name: quiz_questions; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.quiz_questions (id, project_id, question_type, level, question, correct_answer, explanation, times_shown, times_correct, created_at, wrong_answers) FROM stdin;
2	replicated-k8s-analyzer	architecture	1	Explain the database schema design for the K8s Analyzer. Why did you structure the relationships between bundles, findings, and analysis_events the way you did?	We designed a three-table schema: bundles (main entity), findings (one-to-many with bundles), and analysis_events (one-to-many with bundles for tracking progress). This structure separates concerns - bundles store metadata and status, findings store actual analysis results with severity/category/evidence, and analysis_events enable real-time SSE progress tracking. The one-to-many relationships allow multiple findings per bundle and granular event logging.	This tests understanding of relational database design principles and how the schema supports the application's core features (analysis tracking, finding storage, real-time updates). The interviewer wants to see thoughtful separation of concerns and understanding of how database design enables functionality.	1	1	2026-03-14 01:04:46.286088	[]
1	replicated-k8s-analyzer	architecture	1	Why did you choose SQLAlchemy 1.4 with session.query() style instead of SQLAlchemy 2.0 with the select() style for the K8s Analyzer project?	We chose SQLAlchemy 1.4 with session.query() style for familiarity and stability. The 1.4 version provides a mature, well-documented API that's been battle-tested in production environments. Since this is an analyzer tool that needs to be reliable and maintainable, we prioritized using patterns that the team knows well rather than adopting the newer 2.0 syntax which, while more modern, could introduce learning curve overhead.	**Why your answer was wrong:** SQLAlchemy 2.0's `select()` style is actually *more* powerful for complex queries, not less. It supports everything 1.4 does and more.\n\n**Why the correct answer is right:** This decision was about **pragmatism over novelty**. Think of it like choosing a reliable Toyota over a flashy sports car for a cross-country road trip. SQLAlchemy 1.4 is the "Toyota" here - proven, familiar, and gets the job done without surprises.\n\nThe key insight: **Good engineering decisions balance technical capabilities with team reality.** When building critical infrastructure tools, you often choose:\n- ✅ Mature, well-known patterns the team understands\n- ✅ Extensive documentation and community support\n- ✅ Battle-tested stability\n\nOver:\n- ❌ Latest features that add learning overhead\n- ❌ Newer syntax that might slow development\n\nThe interviewer wants to see you make thoughtful, context-aware technology choices rather than always chasing the newest shiny thing.	1	0	2026-03-14 01:04:46.281272	[]
3	replicated-k8s-analyzer	architecture	1	Why did you implement Server-Sent Events (SSE) for the analysis progress updates instead of using WebSockets or simple polling?	SSE was the right choice because we needed unidirectional communication (server-to-client only) for progress updates. Unlike WebSockets, SSE is simpler to implement, automatically handles reconnection, and works better with HTTP infrastructure like load balancers and proxies. Compared to polling, SSE provides real-time updates without the overhead of constant HTTP requests, which is important during the analysis pipeline that can take time to process large K8s bundles.	This tests the engineer's understanding of real-time communication patterns and their ability to choose the right tool for the job. The interviewer wants to see they understand the trade-offs between SSE, WebSockets, and polling, and can justify their choice based on the specific use case.	1	1	2026-03-14 01:04:46.28667	[]
4	replicated-k8s-analyzer	architecture	1	Walk me through your analysis pipeline architecture. Why did you separate extraction, signal detection, pattern matching, and LLM analysis into distinct steps?	We designed a multi-stage pipeline to separate concerns and enable incremental processing: extraction parses the K8s bundle structure, signal detection finds specific indicators (resource limits, error patterns), pattern matching applies rule-based analysis for known issues, and LLM analysis provides intelligent insights on complex problems. This separation allows each stage to be tested independently, makes the system more maintainable, and enables us to fall back to synthetic findings if the LLM is unavailable.	This tests understanding of pipeline architecture and separation of concerns. The interviewer wants to see that the engineer understands how breaking down complex processes into stages improves maintainability, testability, and reliability - especially important for an analysis tool that needs to be robust.	1	1	2026-03-14 01:04:46.287053	[]
5	replicated-k8s-analyzer	architecture	1	Why did you choose to run the backend on port 3002 and frontend on port 5002? How does this development setup work with the API communication?	We used separate ports (3002 for FastAPI backend, 5002 for Next.js frontend) for development isolation and clear service boundaries. This allows independent development and deployment of each service. The frontend makes API calls to localhost:3002 during development, with CORS configured on the FastAPI side to allow requests from the frontend port. This setup mimics a production environment where services would be deployed separately, making the development experience more realistic.	**Why your answer missed the mark:**\nSaying the ports were "random" suggests you don't understand the architectural reasoning behind development setups. In professional environments, every technical decision should have purpose.\n\n**The correct approach:**\nThink of it like having separate apartments for roommates - each service gets its own "address" (port) so they can operate independently without interfering with each other.\n\n**Why separate ports matter:**\n- **Independence**: Frontend and backend can restart, update, or crash without affecting each other\n- **Real-world simulation**: Mimics production where services run on different servers\n- **Clear boundaries**: Makes it obvious which service handles what functionality\n- **CORS practice**: Forces you to properly configure cross-origin requests, a critical production skill\n\n**Key takeaway:** In software architecture, separation of concerns isn't just theory - it's implemented through practical choices like port allocation. Always think about the "why" behind technical decisions!	1	0	2026-03-14 01:04:46.289956	[]
6	replicated-k8s-analyzer	architecture	1	Your K8s Analyzer uses SQLAlchemy 1.4 with the session.query() pattern instead of SQLAlchemy 2.0's select() style. Why did you make this choice, and what are the trade-offs?	I chose SQLAlchemy 1.4 with session.query() for faster development velocity and better compatibility with existing tooling. While SQLAlchemy 2.0's select() style offers better type safety and performance optimizations, the 1.4 query style provided more straightforward relationship handling for the complex joins between bundles, findings, and analysis events. Given the project timeline and the need to handle nested relationships efficiently, the mature 1.4 API allowed me to focus on the core analysis logic rather than migration complexities.	This tests understanding of SQLAlchemy evolution and pragmatic technology choices. The interviewer wants to see that you understand both versions' trade-offs and made a conscious decision based on project constraints, not just used what you knew. It also reveals whether you understand the relationship complexity in your own schema design.	0	0	2026-03-14 01:05:49.323706	[]
7	replicated-k8s-analyzer	architecture	1	You implemented Server-Sent Events (SSE) for real-time analysis progress instead of WebSockets. Walk me through why SSE was the right choice for this specific use case and how it integrates with your FastAPI backend.	SSE was optimal because the K8s analysis pipeline is unidirectional communication - the server streams progress updates to the client without needing client responses. SSE handles reconnection automatically, works through firewalls/proxies better than WebSockets, and integrates seamlessly with FastAPI's StreamingResponse. My implementation yields JSON progress events during the analysis pipeline phases (extraction, signal detection, pattern matching, LLM analysis) while maintaining the database transaction integrity. The client receives real-time updates without the overhead of bidirectional WebSocket connections.	This question tests architectural decision-making for real-time features. The interviewer wants to see you understand the specific use case requirements (unidirectional, reconnection handling, firewall compatibility) and can justify technology choices beyond 'simpler to implement.' It also probes whether you understand how SSE integrates with your specific FastAPI implementation.	0	0	2026-03-14 01:05:49.324506	[]
8	replicated-k8s-analyzer	architecture	1	Your database design has separate tables for bundles, findings, and analysis_events. Explain the relationship structure and why you didn't embed findings directly in the bundles table as JSON.	I designed a normalized structure: bundles (1) -> findings (many) -> analysis_events (many), with proper foreign key relationships. This allows efficient querying by severity, category, or resource type across all bundles. Embedding findings as JSON would prevent SQL filtering/aggregation, make the report generation queries complex, and lose referential integrity. The separate analysis_events table tracks the analysis pipeline progress and can be joined for status reporting. This structure supports the dashboard's filtering needs and the report generation logic that aggregates findings by severity and category.	This tests database design thinking specific to the application's needs. The interviewer wants to see you understand the query patterns your application actually uses (filtering, aggregation, reporting) and made schema decisions to support them. It's not just about normalization theory, but practical considerations for your specific feature requirements like dashboard filtering and report generation.	0	0	2026-03-14 01:05:49.325605	[]
9	replicated-k8s-analyzer	architecture	1	Why did you choose SQLAlchemy 1.4 with session.query() style instead of the newer SQLAlchemy 2.0 select() syntax for the K8s Analyzer database layer?	I chose SQLAlchemy 1.4 with session.query() because it provides a more familiar ORM-style syntax that's easier to read and maintain for this project's complexity level. The session.query() pattern offers intuitive method chaining for filtering and joining, which works well for our bundle analysis queries. Since this is an internal tool without extreme performance requirements, the slight performance benefits of 2.0's select() didn't justify the steeper learning curve.	This tests whether the engineer made a conscious technical decision rather than defaulting to an older version. The interviewer wants to see that they understand the trade-offs between ORM convenience vs performance, and that they can justify using 'older' technology when it makes sense for the project context.	0	0	2026-03-14 01:05:54.533124	[]
10	replicated-k8s-analyzer	architecture	1	Your K8s Analyzer uses Server-Sent Events (SSE) for real-time analysis progress updates. Why did you choose SSE over WebSockets or simple polling for this specific use case?	I chose SSE because the K8s bundle analysis is a one-way data stream from server to client - the frontend only needs to receive progress updates, not send data back during analysis. SSE is simpler to implement than WebSockets since it works over standard HTTP, handles reconnection automatically, and doesn't require the bidirectional complexity of WebSockets. Compared to polling, SSE provides real-time updates without the inefficiency of repeated HTTP requests.	This question tests whether the engineer understands the specific requirements of their use case (unidirectional data flow) and chose the appropriate technology. It reveals if they understand the trade-offs between different real-time communication patterns rather than just picking a trendy solution.	0	0	2026-03-14 01:05:54.533714	[]
11	replicated-k8s-analyzer	architecture	1	The K8s Analyzer implements a multi-stage analysis pipeline with extraction, signal detection, pattern matching, and LLM analysis. Why did you structure it as a sequential pipeline rather than parallel processing?	I used a sequential pipeline because each stage depends on the output of the previous stage - pattern matching needs the signals from detection, and LLM analysis needs the patterns to provide context. The stages are also computationally different: extraction is I/O heavy, pattern matching is CPU intensive, and LLM analysis has API rate limits. Sequential processing allows better error handling and progress tracking through SSE, and for typical K8s bundle sizes, the performance trade-off is acceptable compared to the complexity of coordinating parallel stages.	This tests the engineer's understanding of data dependencies and system design trade-offs. The interviewer wants to see that they considered parallelization but made a conscious decision based on the specific requirements and constraints of K8s bundle analysis.	0	0	2026-03-14 01:05:54.534109	[]
\.


--
-- Data for Name: study_questions; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.study_questions (id, session_id, question, correct_answer, wrong_answers, explanation, question_type, level, times_shown, times_correct, created_at) FROM stdin;
1	1	What is the quadratic formula?	x = (-b ± √(b²-4ac)) / 2a	["x = (-b \\u00b1 \\u221a(b\\u00b2+4ac)) / 2a", "x = (b \\u00b1 \\u221a(b\\u00b2-4ac)) / 2a", "x = (-b \\u00b1 \\u221a(b\\u00b2-4ac)) / a"]	This tests basic recall of the quadratic formula. The correct formula has -b in the numerator, b²-4ac under the square root, and 2a in the denominator.	multiple_choice	1	0	0	2026-03-17 23:29:17.379148
2	1	The quadratic formula can be used to solve equations in which standard form?	ax² + bx + c = 0	["ax + bx\\u00b2 + c = 0", "ax\\u00b2 + bx + c = 1", "a\\u00b2x + bx + c = 0"]	This tests recall of the standard form that the quadratic formula applies to. The equation must equal zero and have x² as the highest power term.	multiple_choice	1	0	0	2026-03-17 23:29:17.38208
3	1	What is the discriminant in the quadratic formula?	b² - 4ac	["b\\u00b2 + 4ac", "-b \\u00b1 \\u221a(b\\u00b2-4ac)", "2a"]	This tests recall of what the discriminant is - the expression under the square root sign that determines the nature of the solutions.	multiple_choice	1	0	0	2026-03-17 23:29:17.382969
4	1	If the discriminant b²-4ac is positive, how many real solutions does the quadratic equation have?	Two real solutions	["One real solution", "No real solutions", "Three real solutions"]	This tests understanding of how the discriminant relates to the number of solutions. A positive discriminant means the square root yields a real number, and the ± gives two different solutions.	multiple_choice	2	0	0	2026-03-17 23:29:17.383749
5	1	If the discriminant b²-4ac equals zero, how many real solutions does the quadratic equation have?	One real solution	["Two real solutions", "No real solutions", "Infinitely many solutions"]	This tests understanding that when the discriminant is zero, the ± part becomes ±0, resulting in only one solution (a repeated root).	multiple_choice	2	0	0	2026-03-17 23:29:17.384484
6	1	If the discriminant b²-4ac is negative, what can you conclude about the solutions?	There are no real solutions	["There are two real solutions", "There is one real solution", "There are two negative solutions"]	This tests understanding that a negative discriminant means taking the square root of a negative number, which has no real solutions (only complex solutions).	multiple_choice	2	0	0	2026-03-17 23:29:17.385181
7	1	For the equation x² - 6x + 9 = 0, what are the values of a, b, and c?	a = 1, b = -6, c = 9	["a = 1, b = 6, c = 9", "a = 0, b = -6, c = 9", "a = 1, b = -6, c = -9"]	This tests the ability to identify coefficients from a quadratic equation in standard form. Note that b = -6, not 6, because the equation has -6x.	multiple_choice	2	0	0	2026-03-17 23:29:17.385895
8	1	What is the discriminant for the equation 2x² + 5x - 3 = 0?	49	["25", "1", "-49"]	This tests application of the discriminant formula. With a=2, b=5, c=-3: b²-4ac = 5²-4(2)(-3) = 25-(-24) = 25+24 = 49.	multiple_choice	3	0	0	2026-03-17 23:29:17.386653
9	1	Using the quadratic formula, what are the solutions to x² - 4x + 3 = 0?	x = 3 and x = 1	["x = -3 and x = -1", "x = 2 and x = 6", "x = 4 and x = 3"]	This tests full application of the quadratic formula. With a=1, b=-4, c=3: x = (4 ± √(16-12))/2 = (4 ± √4)/2 = (4 ± 2)/2, giving x = 3 or x = 1.	multiple_choice	3	0	0	2026-03-17 23:29:17.387275
10	1	For which equation would the quadratic formula yield exactly one solution?	x² - 10x + 25 = 0	["x\\u00b2 + 5x + 6 = 0", "x\\u00b2 - 2x + 5 = 0", "x\\u00b2 - 3x - 4 = 0"]	This tests understanding by requiring calculation of discriminants. For x² - 10x + 25 = 0: discriminant = (-10)² - 4(1)(25) = 100 - 100 = 0, which gives exactly one solution.	multiple_choice	3	0	0	2026-03-17 23:29:17.38788
11	2	If 3x + 7 = 22, what is the value of x?	5	["3", "7", "15"]	Subtract 7 from both sides: 3x = 15, then divide by 3: x = 5. This tests basic linear equation solving.	multiple_choice	1	1	1	2026-03-18 00:15:28.687779
12	2	What is the slope of the line passing through points (2, 5) and (6, 13)?	2	["1/2", "4", "8"]	Use slope formula: m = (y₂ - y₁)/(x₂ - x₁) = (13 - 5)/(6 - 2) = 8/4 = 2. This tests understanding of slope calculation.	multiple_choice	2	1	0	2026-03-18 00:15:28.689534
13	2	If f(x) = 2x² - 3x + 1, what is f(4)?	21	["25", "17", "29"]	Substitute x = 4: f(4) = 2(4)² - 3(4) + 1 = 2(16) - 12 + 1 = 32 - 12 + 1 = 21. This tests function evaluation.	multiple_choice	2	1	1	2026-03-18 00:15:28.690065
14	2	A rectangular garden has length 3 times its width. If the perimeter is 48 feet, what is the width?	6 feet	["8 feet", "12 feet", "18 feet"]	Let w = width, then length = 3w. Perimeter: 2w + 2(3w) = 48, so 8w = 48, therefore w = 6. This tests application of algebra to geometry.	multiple_choice	3	1	1	2026-03-18 00:15:28.690678
15	2	What is the value of √(16 × 25)?	20	["41", "400", "10"]	√(16 × 25) = √16 × √25 = 4 × 5 = 20. This tests understanding of square root properties.	multiple_choice	1	1	0	2026-03-18 00:15:28.69118
16	2	In a right triangle, if one leg is 9 and the hypotenuse is 15, what is the length of the other leg?	12	["6", "18", "24"]	Using Pythagorean theorem: a² + 9² = 15², so a² + 81 = 225, therefore a² = 144 and a = 12. This tests application of the Pythagorean theorem.	multiple_choice	3	1	1	2026-03-18 00:15:28.691595
17	2	Which expression is equivalent to (x + 3)(x - 5)?	x² - 2x - 15	["x\\u00b2 + 2x - 15", "x\\u00b2 - 2x + 15", "x\\u00b2 - 8x - 15"]	Using FOIL: (x + 3)(x - 5) = x² - 5x + 3x - 15 = x² - 2x - 15. This tests understanding of polynomial multiplication.	multiple_choice	2	1	0	2026-03-18 00:15:28.692019
18	2	If 2x - 3y = 12 and x = 6, what is the value of y?	0	["2", "-2", "4"]	Substitute x = 6: 2(6) - 3y = 12, so 12 - 3y = 12, therefore -3y = 0 and y = 0. This tests substitution in linear equations.	multiple_choice	2	1	0	2026-03-18 00:15:28.692491
19	2	A store offers a 25% discount on an item originally priced at $80. What is the sale price?	$60	["$55", "$65", "$20"]	25% of $80 = 0.25 × $80 = $20 discount. Sale price = $80 - $20 = $60. This tests application of percentage calculations.	multiple_choice	3	1	0	2026-03-18 00:15:28.692847
20	2	What is the y-intercept of the line y = -3x + 7?	7	["-3", "3", "-7"]	In slope-intercept form y = mx + b, the y-intercept is b. Here b = 7. This tests recall of linear equation components.	multiple_choice	1	1	0	2026-03-18 00:15:28.693188
\.


--
-- Data for Name: study_sessions; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.study_sessions (id, title, subject, content_type, raw_content, created_at) FROM stdin;
1	SAT Math Practice	SAT Math	text	The quadratic formula is x = (-b ± √(b²-4ac)) / 2a. It solves any equation in the form ax² + bx + c = 0. The discriminant b²-4ac tells you how many solutions exist: positive means two real solutions, zero means one, negative means no real solutions.	2026-03-17 23:28:56.101733
2	SAT Math questions 	MATH	text	I want 30 questions with answers if i get it wrong. 	2026-03-18 00:15:11.669456
\.


--
-- Data for Name: study_timers; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.study_timers (id, project_id, session_type, duration_seconds, questions_answered, correct_answers, created_at) FROM stdin;
\.


--
-- Data for Name: weak_spots; Type: TABLE DATA; Schema: public; Owner: swarmos
--

COPY public.weak_spots (id, project_id, topic, interview_type, avg_score, occurrences, last_seen) FROM stdin;
\.


--
-- Name: build_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.build_logs_id_seq', 1, false);


--
-- Name: interview_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.interview_messages_id_seq', 6, true);


--
-- Name: interview_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.interview_sessions_id_seq', 2, true);


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.quiz_attempts_id_seq', 5, true);


--
-- Name: quiz_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.quiz_questions_id_seq', 11, true);


--
-- Name: study_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.study_questions_id_seq', 20, true);


--
-- Name: study_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.study_sessions_id_seq', 2, true);


--
-- Name: study_timers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.study_timers_id_seq', 1, false);


--
-- Name: weak_spots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: swarmos
--

SELECT pg_catalog.setval('public.weak_spots_id_seq', 1, false);


--
-- Name: build_logs build_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.build_logs
    ADD CONSTRAINT build_logs_pkey PRIMARY KEY (id);


--
-- Name: interview_messages interview_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.interview_messages
    ADD CONSTRAINT interview_messages_pkey PRIMARY KEY (id);


--
-- Name: interview_sessions interview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.interview_sessions
    ADD CONSTRAINT interview_sessions_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: study_questions study_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_questions
    ADD CONSTRAINT study_questions_pkey PRIMARY KEY (id);


--
-- Name: study_sessions study_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_sessions
    ADD CONSTRAINT study_sessions_pkey PRIMARY KEY (id);


--
-- Name: study_timers study_timers_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.study_timers
    ADD CONSTRAINT study_timers_pkey PRIMARY KEY (id);


--
-- Name: weak_spots weak_spots_pkey; Type: CONSTRAINT; Schema: public; Owner: swarmos
--

ALTER TABLE ONLY public.weak_spots
    ADD CONSTRAINT weak_spots_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict O311wyIQdKBC8oTy0gwvRD0gIe8bT24xnjuNc6V2r3w2tuXVYzBObxALjK9x8S9

