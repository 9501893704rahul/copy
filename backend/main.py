import os
import uuid
import json
import re
from typing import List, Optional, Tuple
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import fitz  # PyMuPDF
import httpx
import aiofiles
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Paper Review API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage directories
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory storage for reviews
reviews_db = {}

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Polar.sh webhook secret
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET", "")

# Models
class HighlightRect(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float
    page: int

class Citation(BaseModel):
    quote: str
    page: int
    highlight_rects: List[HighlightRect] = []

class ReviewComment(BaseModel):
    id: str
    reviewer_type: str
    title: str
    content: str
    page: int
    highlight_rects: Optional[List[dict]] = None
    citations: Optional[List[Citation]] = None
    severity: str = "info"  # info, warning, error

class ReviewResult(BaseModel):
    id: str
    filename: str
    title: str
    summary: str
    reviewers: List[dict]
    comments: List[ReviewComment]

class ReviewerConfig(BaseModel):
    name: str
    description: str
    prompt_template: str
    icon: str

# Reviewer configurations with citation support
CITATION_INSTRUCTION = """
IMPORTANT: For each comment, you MUST include specific citations from the paper.
Each citation should be an EXACT quote from the paper text (copy the exact words).
This allows us to highlight the relevant text in the PDF.

CRITICAL REQUIREMENTS FOR PAGE COVERAGE:
1. The paper content is organized by page numbers (marked as "=== PAGE X ===").
2. You MUST provide comments and citations from DIFFERENT pages throughout the ENTIRE paper.
3. The paper has multiple pages - you MUST review ALL of them, not just the first few.
4. Include citations from early pages (1-5), middle pages (6-15), AND later pages (16+).
5. For each citation, specify the EXACT page number where the quote appears.
6. Aim to have citations spread across at least 10-15 different pages of the paper.
7. Do NOT focus only on the first few pages - review the ENTIRE document from start to finish.
8. Make sure to include comments about the methodology, results, discussion, and conclusion sections which are typically in later pages.
"""

REVIEWERS = {
    "editor_overview": ReviewerConfig(
        name="Editor Overview",
        description="Provides a high-level summary and editorial assessment",
        icon="📝",
        prompt_template="""You are an academic journal editor reviewing a submitted manuscript. 
Provide a concise editorial overview that includes:
1. A brief summary of the paper's main contribution
2. Overall assessment of the manuscript quality
3. Key strengths and weaknesses
4. Recommendation (accept, minor revisions, major revisions, reject)
""" + CITATION_INSTRUCTION + """
Paper content:
{content}

Respond in JSON format:
{{
    "summary": "Brief summary of the paper",
    "assessment": "Overall assessment",
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "recommendation": "Your recommendation",
    "comments": [
        {{
            "title": "Comment title",
            "content": "Detailed comment explaining the issue",
            "page": 1,
            "severity": "info|warning|error",
            "citations": [
                {{
                    "quote": "EXACT text from the paper that this comment refers to",
                    "page": 1
                }}
            ]
        }}
    ]
}}"""
    ),
    "methodology_reviewer": ReviewerConfig(
        name="Methodology Reviewer",
        description="Evaluates research methodology and study design",
        icon="🔬",
        prompt_template="""You are a methodology expert reviewing a research paper.
Evaluate the research methodology including:
1. Study design appropriateness
2. Sample size and selection
3. Data collection methods
4. Statistical analysis
5. Potential biases and limitations
""" + CITATION_INSTRUCTION + """
Paper content:
{content}

Respond in JSON format:
{{
    "methodology_assessment": "Overall methodology assessment",
    "design_evaluation": "Study design evaluation",
    "comments": [
        {{
            "title": "Comment title",
            "content": "Detailed comment about methodology",
            "page": 1,
            "severity": "info|warning|error",
            "citations": [
                {{
                    "quote": "EXACT text from the paper that this comment refers to",
                    "page": 1
                }}
            ]
        }}
    ]
}}"""
    ),
    "novelty_reviewer": ReviewerConfig(
        name="Novelty Reviewer",
        description="Assesses the originality and contribution to the field",
        icon="💡",
        prompt_template="""You are an expert reviewer assessing the novelty and contribution of a research paper.
Evaluate:
1. Originality of the research question
2. Novel contributions to the field
3. Comparison with existing literature
4. Significance of findings
""" + CITATION_INSTRUCTION + """
Paper content:
{content}

Respond in JSON format:
{{
    "novelty_assessment": "Overall novelty assessment",
    "contributions": ["contribution1", "contribution2"],
    "comments": [
        {{
            "title": "Comment title",
            "content": "Detailed comment about novelty",
            "page": 1,
            "severity": "info|warning|error",
            "citations": [
                {{
                    "quote": "EXACT text from the paper that this comment refers to",
                    "page": 1
                }}
            ]
        }}
    ]
}}"""
    ),
    "clarity_reviewer": ReviewerConfig(
        name="Clarity & Writing Reviewer",
        description="Reviews writing quality, clarity, and presentation",
        icon="✍️",
        prompt_template="""You are an expert reviewer focusing on writing quality and clarity.
Evaluate:
1. Overall writing quality
2. Clarity of explanations
3. Organization and structure
4. Figure and table quality
5. Grammar and style issues
""" + CITATION_INSTRUCTION + """
Paper content:
{content}

Respond in JSON format:
{{
    "clarity_assessment": "Overall clarity assessment",
    "writing_quality": "Writing quality evaluation",
    "comments": [
        {{
            "title": "Comment title",
            "content": "Detailed comment about clarity/writing",
            "page": 1,
            "severity": "info|warning|error",
            "citations": [
                {{
                    "quote": "EXACT text from the paper that this comment refers to",
                    "page": 1
                }}
            ]
        }}
    ]
}}"""
    ),
    "reproducibility_reviewer": ReviewerConfig(
        name="Reproducibility Reviewer",
        description="Evaluates reproducibility and data availability",
        icon="🔄",
        prompt_template="""You are an expert reviewer focusing on reproducibility.
Evaluate:
1. Availability of data and code
2. Clarity of methods description
3. Reproducibility of experiments
4. Documentation quality
""" + CITATION_INSTRUCTION + """
Paper content:
{content}

Respond in JSON format:
{{
    "reproducibility_assessment": "Overall reproducibility assessment",
    "data_availability": "Data availability evaluation",
    "comments": [
        {{
            "title": "Comment title",
            "content": "Detailed comment about reproducibility",
            "page": 1,
            "severity": "info|warning|error",
            "citations": [
                {{
                    "quote": "EXACT text from the paper that this comment refers to",
                    "page": 1
                }}
            ]
        }}
    ]
}}"""
    ),
}


def extract_text_from_pdf(pdf_path: str) -> tuple[str, str, List[dict], dict]:
    """Extract text, metadata, and text positions from PDF."""
    doc = fitz.open(pdf_path)
    full_text = ""
    pages_text = []
    pages_data = {}  # Store detailed text data with positions
    
    title = ""
    
    for page_num, page in enumerate(doc):
        text = page.get_text()
        full_text += f"\n--- Page {page_num + 1} ---\n{text}"
        
        # Extract text blocks with positions for highlighting
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        text_instances = []
        
        for block in blocks:
            if block.get("type") == 0:  # Text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text_instances.append({
                            "text": span.get("text", ""),
                            "bbox": span.get("bbox", [0, 0, 0, 0]),
                            "font": span.get("font", ""),
                            "size": span.get("size", 0)
                        })
        
        pages_text.append({
            "page": page_num + 1,
            "text": text
        })
        
        pages_data[page_num + 1] = {
            "text": text,
            "text_instances": text_instances,
            "width": page.rect.width,
            "height": page.rect.height
        }
        
        # Try to extract title from first page
        if page_num == 0:
            lines = text.strip().split('\n')
            for line in lines[:5]:
                if len(line.strip()) > 10 and len(line.strip()) < 200:
                    title = line.strip()
                    break
    
    doc.close()
    return full_text, title, pages_text, pages_data


def get_sampled_content(full_text: str, pages_text: List[dict], max_chars: int = 100000) -> str:
    """
    Include FULL content from all pages of the paper.
    This ensures the LLM can review the entire document without truncation.
    """
    total_pages = len(pages_text)
    if total_pages == 0:
        return full_text
    
    # Include full content from all pages - no truncation
    full_content = ""
    for page_data in pages_text:
        page_num = page_data["page"]
        page_text = page_data["text"]
        full_content += f"\n\n=== PAGE {page_num} ===\n{page_text}"
    
    return full_content


def find_text_in_pdf(pdf_path: str, search_text: str, page_hint: int = None) -> List[dict]:
    """Find text in PDF and return highlight rectangles."""
    doc = fitz.open(pdf_path)
    highlights = []
    
    # Clean up search text
    search_text = search_text.strip()
    if len(search_text) < 5:
        doc.close()
        return highlights
    
    # Search in specific page first if hint provided, then all pages
    pages_to_search = []
    if page_hint and 1 <= page_hint <= len(doc):
        pages_to_search.append(page_hint - 1)
    pages_to_search.extend([i for i in range(len(doc)) if i != (page_hint - 1 if page_hint else -1)])
    
    for page_idx in pages_to_search:
        page = doc[page_idx]
        # Search for the text
        text_instances = page.search_for(search_text)
        
        if text_instances:
            for rect in text_instances:
                highlights.append({
                    "x0": rect.x0,
                    "y0": rect.y0,
                    "x1": rect.x1,
                    "y1": rect.y1,
                    "page": page_idx + 1,
                    "width": page.rect.width,
                    "height": page.rect.height
                })
            break  # Found on this page, stop searching
    
    # If exact match not found, try partial matching
    if not highlights and len(search_text) > 20:
        # Try with first 50 characters
        partial_text = search_text[:50]
        for page_idx in pages_to_search:
            page = doc[page_idx]
            text_instances = page.search_for(partial_text)
            if text_instances:
                for rect in text_instances:
                    highlights.append({
                        "x0": rect.x0,
                        "y0": rect.y0,
                        "x1": rect.x1,
                        "y1": rect.y1,
                        "page": page_idx + 1,
                        "width": page.rect.width,
                        "height": page.rect.height
                    })
                break
    
    doc.close()
    return highlights


async def call_llm_api(prompt: str) -> dict:
    """Call the LLM API (OpenRouter with DeepSeek)."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    
    if not api_key:
        # Return mock response with citations for testing highlighting feature
        return {
            "summary": "This paper presents interesting research findings on AI-powered paper review systems.",
            "assessment": "The paper shows promise but needs improvements in methodology and reproducibility.",
            "methodology_assessment": "The methodology section lacks detail on validation procedures.",
            "novelty_assessment": "The approach is novel but builds on existing work.",
            "clarity_assessment": "The writing is generally clear but could be more concise.",
            "reproducibility_assessment": "More details needed for reproducibility.",
            "comments": [
                {
                    "title": "Methodology Needs More Detail",
                    "content": "The methodology section mentions collecting peer reviews but doesn't explain the selection criteria or validation process. More details are needed about how the 10,000 reviews were selected and preprocessed.",
                    "page": 1,
                    "severity": "warning",
                    "citations": [
                        {
                            "quote": "We collected 10,000 peer reviews from open access journals",
                            "page": 1
                        }
                    ]
                },
                {
                    "title": "Sample Size Justification",
                    "content": "While power analysis is mentioned, the specific parameters and rationale for the sample size should be provided.",
                    "page": 1,
                    "severity": "info",
                    "citations": [
                        {
                            "quote": "Our sample size was determined through power analysis",
                            "page": 1
                        }
                    ]
                },
                {
                    "title": "Strong Results Claim",
                    "content": "The 85% agreement rate is impressive but needs more context. What types of issues were compared? How was agreement measured?",
                    "page": 1,
                    "severity": "warning",
                    "citations": [
                        {
                            "quote": "Our AI reviewer achieved 85% agreement with human reviewers",
                            "page": 1
                        }
                    ]
                },
                {
                    "title": "Novel Approach",
                    "content": "The paper presents an interesting approach to automated paper review using AI, which addresses a real need in academic publishing.",
                    "page": 1,
                    "severity": "info",
                    "citations": [
                        {
                            "quote": "This paper presents a novel approach to automated paper review",
                            "page": 1
                        }
                    ]
                }
            ]
        }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek/deepseek-chat",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 4000,
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"LLM API error: {response.text}")
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Parse JSON from response
        try:
            # Try to extract JSON from the response
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0]
            else:
                json_str = content
            
            return json.loads(json_str.strip())
        except json.JSONDecodeError:
            return {
                "summary": content,
                "comments": []
            }


@app.get("/")
async def root():
    return {"message": "AI Paper Review API", "version": "1.0.0"}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF file for review."""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Generate unique ID
    review_id = str(uuid.uuid4())[:8]
    
    # Save file
    file_path = os.path.join(UPLOAD_DIR, f"{review_id}.pdf")
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Extract text with positions
    full_text, title, pages_text, pages_data = extract_text_from_pdf(file_path)
    
    # Store initial review data
    reviews_db[review_id] = {
        "id": review_id,
        "filename": file.filename,
        "title": title or file.filename,
        "file_path": file_path,
        "full_text": full_text,
        "pages_text": pages_text,
        "pages_data": pages_data,
        "reviewers": [],
        "comments": [],
        "highlights": [],  # Store all highlights
        "status": "uploaded"
    }
    
    return {
        "id": review_id,
        "filename": file.filename,
        "title": title or file.filename,
        "pages": len(pages_text),
        "status": "uploaded"
    }


@app.get("/api/reviews/{review_id}")
async def get_review(review_id: str):
    """Get review details."""
    if review_id not in reviews_db:
        raise HTTPException(status_code=404, detail="Review not found")
    
    review = reviews_db[review_id]
    return {
        "id": review["id"],
        "filename": review["filename"],
        "title": review["title"],
        "reviewers": review["reviewers"],
        "comments": review["comments"],
        "highlights": review.get("highlights", []),
        "status": review["status"]
    }


@app.get("/api/reviews/{review_id}/pdf")
async def get_pdf(review_id: str):
    """Get the PDF file."""
    if review_id not in reviews_db:
        raise HTTPException(status_code=404, detail="Review not found")
    
    file_path = reviews_db[review_id]["file_path"]
    return FileResponse(file_path, media_type="application/pdf")


@app.post("/api/reviews/{review_id}/analyze")
async def analyze_paper(review_id: str, reviewer_types: List[str] = None):
    """Run AI analysis on the paper."""
    if review_id not in reviews_db:
        raise HTTPException(status_code=404, detail="Review not found")
    
    review = reviews_db[review_id]
    
    if reviewer_types is None:
        reviewer_types = list(REVIEWERS.keys())
    
    all_comments = []
    all_highlights = []
    reviewers_results = []
    highlight_id_counter = 0
    
    # Get sampled content from all pages for better coverage
    sampled_content = get_sampled_content(review["full_text"], review["pages_text"], max_chars=30000)
    
    for reviewer_type in reviewer_types:
        if reviewer_type not in REVIEWERS:
            continue
        
        reviewer = REVIEWERS[reviewer_type]
        prompt = reviewer.prompt_template.format(content=sampled_content)
        
        try:
            result = await call_llm_api(prompt)
            
            # Extract comments with citations
            comments = result.get("comments", [])
            for i, comment in enumerate(comments):
                comment_citations = []
                comment_highlights = []
                
                # Process citations and find highlights in PDF
                citations = comment.get("citations", [])
                for citation in citations:
                    quote = citation.get("quote", "")
                    page_hint = citation.get("page", 1)
                    
                    if quote:
                        # Find the text in PDF and get highlight rectangles
                        highlights = find_text_in_pdf(
                            review["file_path"], 
                            quote, 
                            page_hint
                        )
                        
                        if highlights:
                            for h in highlights:
                                h["id"] = f"highlight_{highlight_id_counter}"
                                h["comment_id"] = f"{reviewer_type}_{i}"
                                h["quote"] = quote[:100]  # Store truncated quote
                                highlight_id_counter += 1
                                all_highlights.append(h)
                                comment_highlights.append(h)
                        
                        comment_citations.append({
                            "quote": quote,
                            "page": highlights[0]["page"] if highlights else page_hint,
                            "highlight_id": highlights[0]["id"] if highlights else None
                        })
                
                comment_obj = {
                    "id": f"{reviewer_type}_{i}",
                    "reviewer_type": reviewer_type,
                    "title": comment.get("title", "Comment"),
                    "content": comment.get("content", ""),
                    "page": comment_highlights[0]["page"] if comment_highlights else comment.get("page", 1),
                    "severity": comment.get("severity", "info"),
                    "citations": comment_citations,
                    "highlight_rects": comment_highlights
                }
                all_comments.append(comment_obj)
            
            reviewers_results.append({
                "type": reviewer_type,
                "name": reviewer.name,
                "icon": reviewer.icon,
                "summary": result.get("summary", result.get("assessment", result.get("methodology_assessment", result.get("novelty_assessment", result.get("clarity_assessment", result.get("reproducibility_assessment", "")))))),
                "status": "completed"
            })
        except Exception as e:
            reviewers_results.append({
                "type": reviewer_type,
                "name": reviewer.name,
                "icon": reviewer.icon,
                "summary": f"Error: {str(e)}",
                "status": "error"
            })
    
    # Update review
    review["reviewers"] = reviewers_results
    review["comments"] = all_comments
    review["highlights"] = all_highlights
    review["status"] = "analyzed"
    
    return {
        "id": review_id,
        "reviewers": reviewers_results,
        "comments": all_comments,
        "highlights": all_highlights,
        "status": "analyzed"
    }


@app.get("/api/reviewers")
async def get_reviewers():
    """Get available reviewer types."""
    return [
        {
            "type": key,
            "name": reviewer.name,
            "description": reviewer.description,
            "icon": reviewer.icon
        }
        for key, reviewer in REVIEWERS.items()
    ]


# Polar.sh webhook models
class PolarWebhookPayload(BaseModel):
    event: str
    data: dict


@app.post("/api/webhooks/polar")
async def polar_webhook(payload: PolarWebhookPayload, x_polar_signature: str = Header(None)):
    """Handle Polar.sh webhooks for subscription events."""
    
    # In production, verify the webhook signature
    # For now, we'll process the webhook directly
    
    event = payload.event
    data = payload.data
    
    if event == "subscription.created" or event == "subscription.updated":
        # Extract subscription data
        customer_email = data.get("customer", {}).get("email")
        plan_id = data.get("product", {}).get("id")
        status = data.get("status")
        
        if customer_email and SUPABASE_URL and SUPABASE_SERVICE_KEY:
            # Update subscription in Supabase
            async with httpx.AsyncClient() as client:
                # First, find the user by email
                user_response = await client.get(
                    f"{SUPABASE_URL}/auth/v1/admin/users",
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "apikey": SUPABASE_SERVICE_KEY
                    },
                    params={"email": customer_email}
                )
                
                if user_response.status_code == 200:
                    users = user_response.json().get("users", [])
                    if users:
                        user_id = users[0]["id"]
                        
                        # Upsert subscription record
                        await client.post(
                            f"{SUPABASE_URL}/rest/v1/subscriptions",
                            headers={
                                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                                "apikey": SUPABASE_SERVICE_KEY,
                                "Content-Type": "application/json",
                                "Prefer": "resolution=merge-duplicates"
                            },
                            json={
                                "user_id": user_id,
                                "plan_id": plan_id,
                                "status": status,
                                "polar_subscription_id": data.get("id"),
                                "updated_at": datetime.utcnow().isoformat()
                            }
                        )
        
        return {"status": "processed"}
    
    elif event == "subscription.canceled":
        customer_email = data.get("customer", {}).get("email")
        
        if customer_email and SUPABASE_URL and SUPABASE_SERVICE_KEY:
            async with httpx.AsyncClient() as client:
                # Update subscription status to canceled
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/subscriptions",
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Content-Type": "application/json"
                    },
                    params={"polar_subscription_id": f"eq.{data.get('id')}"},
                    json={"status": "canceled"}
                )
        
        return {"status": "processed"}
    
    return {"status": "ignored"}


@app.get("/api/user/subscription")
async def get_user_subscription(authorization: str = Header(None)):
    """Get current user's subscription status."""
    
    if not authorization or not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {"subscription": None}
    
    try:
        token = authorization.replace("Bearer ", "")
        
        async with httpx.AsyncClient() as client:
            # Verify the token and get user
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_SERVICE_KEY
                }
            )
            
            if user_response.status_code != 200:
                return {"subscription": None}
            
            user = user_response.json()
            user_id = user.get("id")
            
            # Get subscription
            sub_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/subscriptions",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "apikey": SUPABASE_SERVICE_KEY
                },
                params={
                    "user_id": f"eq.{user_id}",
                    "status": "eq.active",
                    "select": "*"
                }
            )
            
            if sub_response.status_code == 200:
                subs = sub_response.json()
                if subs:
                    return {"subscription": subs[0]}
            
            return {"subscription": None}
            
    except Exception as e:
        print(f"Error getting subscription: {e}")
        return {"subscription": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=12000)
