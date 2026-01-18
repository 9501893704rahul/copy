# AI Paper Review

An AI-powered academic paper review system that uses multiple LLM-based reviewers to analyze research papers and provide detailed feedback.

## Features

- **PDF Upload**: Upload research papers in PDF format
- **Multiple AI Reviewers**: 
  - 📝 Editor Overview - High-level summary and editorial assessment
  - 🔬 Methodology Reviewer - Evaluates research methodology and study design
  - 💡 Novelty Reviewer - Assesses originality and contribution to the field
  - ✍️ Clarity & Writing Reviewer - Reviews writing quality and presentation
  - 🔄 Reproducibility Reviewer - Evaluates reproducibility and data availability
- **Interactive PDF Viewer**: View the paper with zoom and page navigation
- **Comment Navigation**: Click on comments to navigate to the relevant page

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite
- **PDF Processing**: PyMuPDF
- **PDF Viewing**: react-pdf
- **LLM API**: OpenRouter (DeepSeek Chat)

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenRouter API key (get one at https://openrouter.ai/)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Create .env file with your API key
echo "OPENROUTER_API_KEY=your_api_key_here" > .env

# Run the server
python main.py
```

The backend will run on http://localhost:12000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:12001

## Usage

1. Open the frontend in your browser
2. Upload a PDF research paper
3. Wait for the AI reviewers to analyze the paper
4. Browse through different reviewer perspectives
5. Click on comments to navigate to the relevant page in the PDF

## API Endpoints

- `POST /api/upload` - Upload a PDF file
- `GET /api/reviews/{review_id}` - Get review details
- `GET /api/reviews/{review_id}/pdf` - Get the PDF file
- `POST /api/reviews/{review_id}/analyze` - Run AI analysis
- `GET /api/reviewers` - Get available reviewer types

## Configuration

Set the following environment variables:

- `OPENROUTER_API_KEY` - Your OpenRouter API key for LLM access

## License

MIT
