# AI Customer Support Assistant

A web app where a small business uploads its own documents (FAQs, prices, refund and delivery policies) and gets a customer chat link. The assistant answers only from those documents. When the answer is not there, it says so politely and logs the question for the owner.

**Stack:** HTML, CSS, vanilla JavaScript · Node.js · Express · PostgreSQL (pg) · JWT · bcrypt · Multer · pdf-parse · mammoth

## Features

- Owner registration and login (bcrypt password hashing, JWT sessions)
- Knowledge base: upload, replace and delete PDF, DOCX and TXT files, with extraction, cleaning, chunking and processing status
- Customer chat at `/chat/<your-business-slug>`, no account needed, with conversation sessions
- Source document shown with each answer
- Unanswered-question log with resolve and ignore actions
- Conversation history with per-message timestamps
- Overview dashboard built from live database counts
- Strict per-business data isolation (business ID comes only from the verified token)

## Setup

### 1. Prerequisites
- Node.js 18 or newer
- PostgreSQL 13 or newer

### 2. Create the database

```bash
createdb support_assistant
```
Or in `psql`: `CREATE DATABASE support_assistant;`

The tables are created automatically on first start from `database/schema.sql`.

### 3. Configure

```bash
cp .env.example .env
```
Edit `.env`:
- `DATABASE_URL`: your PostgreSQL connection string
- `JWT_SECRET`: a long random string (the example file shows how to generate one)
- `OPENAI_API_KEY`: optional. Leave it empty to run without any AI service.

### 4. Install and run

```bash
cd backend
npm install
npm start
```

Open **http://localhost:3000**

1. Click **Create an account** and enter your name, business name, email and password.
2. Go to **Knowledge base** and upload `sample-docs/business-faq.txt`.
3. Copy the link from **Overview** and open it in a new tab (or a private window).
4. Ask questions such as "What is the refund policy?", "How much is espresso?" or "Do you sell tea?" (the last one should be logged as unanswered).

## Answer modes

| Mode | When | How it answers |
|---|---|---|
| Keyword mode (default) | No `OPENAI_API_KEY` | Ranks document sections by keyword overlap and returns the best matching passage verbatim. Fully offline. |
| AI mode | `OPENAI_API_KEY` set | Embeds documents and questions (`text-embedding-3-small`), retrieves the top matches by cosine similarity, and asks the chat model to answer only from that context. Replies with `[[NO_ANSWER]]` when the context is insufficient. |

Both modes use a relevance threshold. Below it, the assistant returns the fixed "couldn't find this information" message and logs the question.

## Project structure

```
AI-Customer-Support/
├── backend/
│   ├── server.js        Express app: auth, documents, RAG, chat, dashboard
│   └── package.json
├── frontend/
│   ├── index.html       Owner console (login, overview, knowledge base, questions, conversations)
│   ├── chat.html        Public customer chat
│   ├── app.js           Owner console logic
│   └── style.css        Shared styles
├── database/
│   └── schema.sql       PostgreSQL tables and indexes
├── sample-docs/
│   └── business-faq.txt Sample document for testing
├── .env.example
└── README.md
```

## API overview

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create owner and business |
| POST | `/api/auth/login` | Public | Get a token |
| GET | `/api/auth/me` | Owner | Current business |
| GET | `/api/documents` | Owner | List documents |
| POST | `/api/documents/upload` | Owner | Upload and process |
| PUT | `/api/documents/:id` | Owner | Replace file and reprocess |
| DELETE | `/api/documents/:id` | Owner | Delete document and its chunks |
| POST | `/api/chat/message` | Public | Customer question |
| GET | `/api/questions?status=open` | Owner | Unanswered questions |
| PUT | `/api/questions/:id` | Owner | Set status |
| GET | `/api/conversations` | Owner | Conversation list |
| GET | `/api/conversations/:id` | Owner | Messages in a conversation |
| GET | `/api/dashboard/stats` | Owner | Live counts |
| GET | `/api/dashboard/activity` | Owner | Recent customer questions |

## Security notes

- Passwords are hashed with bcrypt (12 rounds).
- Tokens expire after 8 hours.
- Every owner query filters by the business ID from the token. Request input never selects the tenant.
- All SQL uses parameterised queries.
- Uploads are limited to 10 MB and checked by extension and file signature. Files are processed in memory and never stored on disk.
- Customer messages are capped at 1000 characters.

## Known limitations (for a production launch)

- No rate limiting on the public chat endpoint yet. Add `express-rate-limit` before going live.
- Owner tokens are kept in `localStorage`. Use httpOnly cookies in production.
- Original files are not kept, so "Replace" requires uploading the new file again.
- Scanned PDFs (images without text) are rejected. OCR is not included.
- pgvector is not used. Embeddings are stored as JSON and compared in Node, which is fine for small to medium knowledge bases.
- Each owner has one business. No team members or roles yet.
- The landing page, Analytics charts, and Account Settings page from the original brief are not included in this version.
