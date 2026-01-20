# AI Paper Review

An AI-powered research paper review system that provides comprehensive feedback from multiple specialized AI reviewers. Features modern UI, Supabase authentication, and Polar.sh membership integration.

## ✨ Features

- 📄 **PDF Upload & Analysis** - Upload research papers and get instant AI-powered reviews
- 🤖 **5 Specialized AI Reviewers**:
  - 📝 Editor Overview - High-level editorial assessment
  - 🔬 Methodology Reviewer - Research design evaluation
  - 💡 Novelty Reviewer - Originality assessment
  - ✍️ Clarity & Writing Reviewer - Writing quality review
  - 🔄 Reproducibility Reviewer - Reproducibility check
- 🔐 **User Authentication** - Supabase Auth with Google/GitHub OAuth
- 💳 **Membership Plans** - Polar.sh integration for subscriptions (Free/Pro/Team)
- 📍 **PDF Highlighting** - Click-to-navigate citations in the PDF
- 🎨 **Modern UI** - Clean, responsive design with smooth animations

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite
- **PDF Processing**: PyMuPDF
- **PDF Viewing**: react-pdf
- **LLM API**: OpenRouter (DeepSeek Chat)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Payments**: Polar.sh

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- OpenRouter API key (get one at https://openrouter.ai/)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# Run the server
uvicorn main:app --host 0.0.0.0 --port 12000
```

### Frontend Setup

```bash
cd frontend
npm install

# Optional: Create .env for Supabase/Polar.sh
cp .env.example .env
# Edit .env with your Supabase and Polar.sh credentials

# Run the dev server
npm run dev
```

## 🔧 Environment Variables

### Backend (.env)

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional: For user auth and subscriptions
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret
```

### Frontend (.env)

```env
# Optional: For user auth
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: For membership
VITE_POLAR_PRO_CHECKOUT_URL=https://polar.sh/checkout/your-pro-product-id
VITE_POLAR_TEAM_CHECKOUT_URL=https://polar.sh/checkout/your-team-product-id
```

## 🔐 Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema in `supabase_schema.sql` in the SQL Editor
3. Enable Google/GitHub OAuth in Authentication > Providers
4. Copy your project URL and anon key to the environment files
5. Copy the service role key to the backend environment

## 💳 Polar.sh Setup

1. Create a Polar.sh account at https://polar.sh
2. Create products for Pro ($19/mo) and Team ($49/mo) plans
3. Set up webhooks pointing to `https://your-domain/api/webhooks/polar`
4. Copy the checkout URLs to the frontend environment
5. Copy the webhook secret to the backend environment

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a PDF file |
| POST | `/api/reviews/{id}/analyze` | Analyze the uploaded paper |
| GET | `/api/reviews/{id}` | Get review results |
| GET | `/api/reviews/{id}/pdf` | Get the PDF file |
| GET | `/api/reviewers` | List available reviewers |
| POST | `/api/webhooks/polar` | Polar.sh webhook endpoint |
| GET | `/api/user/subscription` | Get user subscription status |

## 📖 Usage

1. Open the frontend in your browser
2. (Optional) Sign in with Google or GitHub
3. Upload a PDF research paper
4. Wait for the AI reviewers to analyze the paper (~1-2 minutes)
5. Browse through different reviewer perspectives
6. Click on citations to navigate to the relevant text in the PDF

## 🎯 Membership Plans

| Plan | Price | Features |
|------|-------|----------|
| Free | $0/mo | 3 reviews/month, basic reviewers |
| Pro | $19/mo | Unlimited reviews, all reviewers, priority processing |
| Team | $49/mo | Everything in Pro + 10 team members, API access |

## License

MIT
