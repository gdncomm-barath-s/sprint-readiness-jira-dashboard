# Jira Sprint Dashboard

A custom Vue.js dashboard for Jira Cloud that allows you to dynamically select sprints and view issues organized by status and assignee.

## Features

- **Dynamic Sprint Selection**: Choose any board and sprint to view
- **Board View**: Kanban-style view with issues grouped by status (To Do, In Progress, Done)
- **Assignee View**: See issues grouped by team member with workload visualization
- **Sprint Progress**: Track completion percentage and story points
- **Modern UI**: Clean, responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Jira Cloud account with API access

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Jira Credentials

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your Jira credentials:

```env
JIRA_DOMAIN=yourcompany.atlassian.net
JIRA_EMAIL=your.email@example.com
JIRA_API_TOKEN=your_api_token_here
```

#### How to Get Your API Token

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Jira Dashboard")
4. Copy the token and paste it in your `.env` file

### 3. Run the Application

You'll need two terminal windows:

**Terminal 1 - Start the API Server:**
```bash
cd server
npm start
```

**Terminal 2 - Start the Vue Frontend:**
```bash
cd client
npm run dev
```

### 4. Open the Dashboard

Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
jira-dashboard/
├── client/                    # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── SprintSelector.vue   # Board & sprint dropdowns
│   │   │   ├── IssueBoard.vue       # Kanban board view
│   │   │   ├── StatusColumn.vue     # Status column component
│   │   │   ├── IssueCard.vue        # Issue card component
│   │   │   └── AssigneeView.vue     # Assignee grouped view
│   │   ├── composables/
│   │   │   └── useJira.ts           # Jira API composable
│   │   ├── types/
│   │   │   └── jira.ts              # TypeScript types
│   │   ├── App.vue
│   │   └── main.ts
│   └── package.json
├── server/                    # Express proxy server
│   ├── index.js               # API endpoints
│   └── package.json
├── .env.example               # Environment template
└── README.md
```

## API Endpoints

The Express server proxies requests to Jira Cloud API:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Check API configuration status |
| `GET /api/boards` | List all Scrum boards |
| `GET /api/boards/:id/sprints` | Get sprints for a board |
| `GET /api/sprints/:id/issues` | Get issues in a sprint |
| `GET /api/issues/:key` | Get single issue details |

## Tech Stack

- **Frontend**: Vue 3, Vite, TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Backend**: Express.js
- **API**: Jira Cloud REST API v3

## Troubleshooting

### "Configuration Required" Warning

Make sure your `.env` file exists and contains valid credentials:
- Check that `JIRA_DOMAIN` doesn't include `https://`
- Verify your API token is correct and hasn't expired

### CORS Errors

The Express proxy server handles CORS. Make sure:
- The server is running on port 3000
- The Vite dev server is proxying `/api` requests correctly

### No Boards Showing

- Ensure your Jira account has access to Scrum boards
- The API only fetches boards of type "scrum"

## License

MIT

## Git Workflow

- Default/stable branch: `master`
- Current working branch for setup changes: `codex/initial-setup`
- Open PRs from feature branches into `master`; avoid committing directly to `master`
