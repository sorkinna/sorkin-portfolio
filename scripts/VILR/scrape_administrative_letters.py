import os
import csv
import json
import requests
import tempfile
import re
import fitz  # PyMuPDF
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client
from pdfminer.high_level import extract_text as pdfminer_extract_text
import pytesseract
from pdf2image import convert_from_path

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# CONFIG
# -----------------------------
CSV_FILE = "final_copy.csv"  # Must have 'identifier' and 'url' columns
USE_OPENAI = True  # Set False to use mock for testing

# -----------------------------
# MOCK OPENAI RESPONSE
# -----------------------------
def mock_openai_response():
    return {
        "summary": "This administrative letter clarifies insurer obligations.",
        "practical_impact": "Insurers should update policies accordingly.",
        "statutes": ["§ 38.2-3412.1", "§ 38.2-3418.17"],
        "keywords": ["Autism", "coverage", "insurance", "requirements", "Virginia"],
        "topics": ["Homeowners Insurance", "Rate Filings & Pricing"]
    }

# -----------------------------
# PDF TEXT EXTRACTION
# -----------------------------
def extract_pdf_text(url):
    print("Downloading PDF...")
    response = requests.get(url)
    response.raise_for_status()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(response.content)
        temp_path = tmp.name

    try:
        # ---- Try PyMuPDF ----
        print("Trying PyMuPDF...")
        doc = fitz.open(temp_path)
        text = ""
        for page in doc:
            text += page.get_text("text")

        if text.strip():
            print("✓ Extracted using PyMuPDF")
            return text

        # ---- Try pdfminer ----
        print("Trying pdfminer...")
        text = pdfminer_extract_text(temp_path)
        if text and text.strip():
            print("✓ Extracted using pdfminer")
            return text

        # ---- OCR Fallback ----
        print("Trying OCR fallback...")
        images = convert_from_path(temp_path, dpi=300)

        ocr_text = ""
        for image in images:
            ocr_text += pytesseract.image_to_string(image)

        if ocr_text.strip():
            print("✓ Extracted using OCR")
            return ocr_text

        raise ValueError("All extraction methods failed.")

    finally:
        os.remove(temp_path)

# -----------------------------
# RE LINE EXTRACTION
# -----------------------------
def extract_re_subject(full_text):
    lines = [l.strip() for l in full_text.split("\n") if l.strip()]
    subject_lines = []

    for i, line in enumerate(lines):
        if re.match(r"R\s*E\s*:", line, re.IGNORECASE):
            cleaned = re.sub(r"R\s*E\s*:\s*", "", line, flags=re.IGNORECASE)
            subject_lines.append(cleaned.strip())

            # Capture up to 2 continuation lines
            for j in range(1, 3):
                if i + j < len(lines):
                    next_line = lines[i + j]
                    if re.match(r"(Dear|Administrative Letter|\w+\s+\d{1,2},\s+\d{4})", next_line):
                        break
                    if len(next_line) < 150:
                        subject_lines.append(next_line.strip())
                    else:
                        break
            break

    return " ".join(subject_lines) if subject_lines else ""

# -----------------------------
# PUBLICATION DATE EXTRACTION
# -----------------------------
def extract_publication_date(full_text):
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}",
        full_text
    )
    return match.group(0) if match else ""

# -----------------------------
# FETCH CANONICAL TOPICS
# -----------------------------
def fetch_canonical_topics():
    response = supabase.table("topics").select("name").execute()
    return [row["name"] for row in response.data] if response.data else []

def parse_openai_json(content):
    """
    Clean OpenAI output so it can be safely parsed as JSON.
    Strips Markdown code blocks if present.
    """
    content = content.strip()

    # Remove ```json or ``` at the start/end
    if content.startswith("```json"):
        content = content[len("```json"):].strip()
    if content.startswith("```"):
        content = content[3:].strip()
    if content.endswith("```"):
        content = content[:-3].strip()

    # Now parse as JSON
    import json
    return json.loads(content)

# -----------------------------
# CALL OPENAI
# -----------------------------
def call_openai(clean_text, canonical_topics):    
    topic_list = "\n".join(f"- {t}" for t in canonical_topics)
    prompt = f"""
Below is the full text of a Virginia Bureau of Insurance administrative letter.

Your tasks:

1. Provide a professional 2–3 sentence summary.
2. Provide a 1–2 sentence "Practical Impact" statement explaining what insurers or regulated entities must do or how they are affected.
3. Identify any Virginia statutory citations (e.g., § 38.2-1904).
4. Extract 5–10 important keywords or phrases.
5. Select applicable topics ONLY from the allowed list below.
   - You may select multiple.
   - You MUST choose only from this list.
   - Do NOT create new topics.

Allowed Topics:
{topic_list}

Return strictly valid JSON in this format:
{{
  "summary": "...",
  "practical_impact": "...",
  "statutes": ["..."],
  "keywords": ["..."],
  "topics": ["..."]
}}

Administrative Letter Text:
{clean_text}
"""
    if not USE_OPENAI:
        #print(prompt[1000:5000])
        return mock_openai_response()
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        temperature=0,
        messages=[
            {"role": "system", "content": "You are a precise legal analyst summarizing Virginia insurance regulatory letters for an attorney."},
            {"role": "user", "content": prompt}
        ]
    )
    content = response.choices[0].message.content
    ai_data = parse_openai_json(content)
    print("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&")
    print(content)
    print("###################################")
    print(response)
    return ai_data

# -----------------------------
# MAIN BULK INGEST
# -----------------------------
def main():
    print("Loading canonical topics...")
    canonical_topics = fetch_canonical_topics()
    print(f"Loaded {len(canonical_topics)} topics.\n")

    # Read CSV
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        documents = list(reader)

    for i, doc in enumerate(documents, start=1):
        identifier = doc["identifier"]
        url = doc["url"]
        print(f"\n===== Processing {i}/{len(documents)}: {identifier} =====")

        # Idempotency check
        existing = supabase.table("documents").select("id").eq("identifier", identifier).execute()
        if existing.data:
            print(f"✓ Already in database, skipping: {identifier}")
            continue

        try:
            full_text = extract_pdf_text(url)
            title = extract_re_subject(full_text)
            publication_date = extract_publication_date(full_text)
            if identifier == "AL 2012-04":
              print("found broken one")
              publication_date = "April 2, 2012"
            clean_text = full_text.strip()
            clean_text = re.sub(r"\n{2,}", "\n", clean_text)
            clean_text = re.sub(r"[ \t]{2,}", " ", clean_text)
            ai_data = call_openai(clean_text, canonical_topics)

            # Validate topics
            invalid_topics = set(ai_data["topics"]) - set(canonical_topics)
            ai_data["topics"] = [t for t in ai_data["topics"] if t in canonical_topics]

            # Insert into Supabase
            doc_row = {
                "identifier": identifier,
                "title": title,
                "document_type": "administrative_letter",
                "publication_date": publication_date,
                "source_url": url,
                "summary": ai_data.get("summary", ""),
                "practical_impact": ai_data.get("practical_impact", ""),
                "full_text": clean_text,
                "metadata": {
                    "statutes": ai_data.get("statutes", []),
                    "keywords": ai_data.get("keywords", [])
                }
            }

            result = supabase.table("documents").insert(doc_row).execute()
            doc_id = result.data[0]["id"]
            for topic_name in ai_data.get("topics", []):
                # Look up topic id
                topic_result = supabase.table("topics").select("id").eq("name", topic_name).execute()
                if topic_result.data:
                    topic_id = topic_result.data[0]["id"]
                    supabase.table("document_topics").insert({
                        "document_id": doc_id,
                        "topic_id": topic_id
                    }).execute()
            print(f"✓ Inserted {identifier}")

        except Exception as e:
            print(f"❌ Failed {identifier}: {e}")

if __name__ == "__main__":
    main()