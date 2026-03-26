import os
import json
import requests
import fitz  # PyMuPDF
import re
import csv
import tempfile
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
# CONFIG — EDIT THIS FOR TEST
# -----------------------------
TEST_DOCUMENT = {
    "url": "https://pxl-sccvirginiagov.terminalfour.net/prod01/channel_3/media/sccvirginiagov-home/regulated-industries/insurance/insurance-companies/administration-of-insurance-regulation-in-virginia/administrative-letters/AL-2025-06.pdf"
}

def load_documents_from_csv(path):
    docs = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            docs.append({
                "identifier": row["identifier"].strip(),
                "url": row["url"].strip()
            })
    return docs

def extract_first_sentence(full_text):
    # Remove excessive whitespace
    clean_text = re.sub(r"\s+", " ", full_text)

    # Split into sentences (simple heuristic)
    sentences = re.split(r"(?<=[.!?])\s+", clean_text)

    for sentence in sentences:
        # Skip header-ish lines
        if (
            "Administrative Letter" in sentence
            or sentence.startswith("RE:")
            or re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)", sentence)
        ):
            continue

        if len(sentence) > 40:  # avoid junk fragments
            return sentence.strip()

    return None

def mock_openai_response():
    return {
        "summary": "This administrative letter clarifies the requirements for insurers regarding treatment coverage for Autism Spectrum Disorder under Virginia law.",
        "practical_impact": "Insurers must update their policies to comply with these coverage requirements, and failure to do so may trigger regulatory action.",
        "statutes": ["§ 38.2-3412.1", "§ 38.2-3418.17"],
        "keywords": ["Autism", "coverage", "insurance", "requirements", "Virginia"],
        "topics": ["Homeowners Insurance", "Rate Filings & Pricing"]  # use your canonical topics here
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
# EXTRACT IDENTIFIER
# -----------------------------
def extract_identifier(full_text):
    match = re.search(r"\bAdministrative Letter\s?\d{4}-\d{1,2}\b", full_text)
    if match:
        return match.group(0)
    else:
        raise ValueError("Identifier not found in PDF.")


# -----------------------------
# EXTRACT RE LINE AS TITLE
# -----------------------------
def extract_re_subject(full_text):
    """
    Extracts the RE subject line from a Virginia administrative letter.
    More tolerant of PDF spacing issues like:
    R E :
    RE :
    RE:
    """

    # Normalize weird spacing (helps a lot)
    text = re.sub(r"\r", "\n", full_text)

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    subject_lines = []

    for i, line in enumerate(lines):

        # Flexible RE detection
        if re.match(r"R\s*E\s*:", line, re.IGNORECASE):

            # Remove the RE prefix cleanly
            cleaned = re.sub(r"R\s*E\s*:\s*", "", line, flags=re.IGNORECASE)
            subject_lines.append(cleaned.strip())

            # Capture continuation lines (max 2)
            for j in range(1, 3):
                if i + j < len(lines):
                    next_line = lines[i + j]

                    # Stop if it looks like body start
                    if re.match(r"(Dear|Administrative Letter|\w+\s+\d{1,2},\s+\d{4})", next_line):
                        break

                    if len(next_line) < 150:
                        subject_lines.append(next_line.strip())
                    else:
                        break

            break

    if not subject_lines:
        raise ValueError("RE line not found.")

    return " ".join(subject_lines)


# -----------------------------
# EXTRACT PUBLICATION DATE
# -----------------------------
def extract_publication_date(full_text):
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}",
        full_text
    )
    if match:
        return match.group(0)
    else:
        raise ValueError("Publication date not found.")


# -----------------------------
# FETCH CANONICAL TOPICS VIA SUPABASE API
# -----------------------------
def fetch_canonical_topics():
    print("Fetching canonical topics via Supabase API...")
    response = supabase.table("topics").select("name").execute()
    
    topics = [row["name"] for row in response.data]  # get list of topic names
    if not topics:
        raise ValueError("No topics found in Supabase.")
    return topics


# -----------------------------
# CALL OPENAI
# -----------------------------
def call_openai(full_text, canonical_topics):
    print("Calling OpenAI...")
    topic_list = "\n".join(f"- {t}" for t in canonical_topics)

    prompt = f"""
Below is the full text of a Virginia Bureau of Insurance administrative letter.

Your tasks:

1. Provide a professional 2–3 sentence summary.
2. Provide a 1–2 sentence "Practical Impact" statement.
3. Identify Virginia statutory citations (e.g., § 38.2-1904).
4. Extract 5–10 important keywords.
5. Select applicable topics ONLY from the allowed list below.

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
{full_text[:12000]}
"""
    print(prompt)
    ai_data = mock_openai_response()
    return(ai_data)
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # <- cheaper / more likely free under trial quota
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "You are a precise legal analyst summarizing Virginia insurance regulatory letters for an attorney."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    content = response.choices[0].message.content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        print("⚠️ Failed to parse JSON. Raw output below:\n")
        print(content)
        raise


# -----------------------------
# MAIN DRY RUN
# -----------------------------
'''
def main():
    print("---- STARTING TEST INGEST ----\n")

    canonical_topics = fetch_canonical_topics()
    print(f"Loaded {len(canonical_topics)} canonical topics.\n")

    full_text = extract_pdf_text(TEST_DOCUMENT["url"])

    identifier = extract_identifier(full_text)
    title = extract_re_subject(full_text)
    publication_date = extract_publication_date(full_text)

    print(f"Extracted Identifier: {identifier}")
    print(f"Extracted Title: {title}")
    print(f"Extracted Publication Date: {publication_date}\n")

    ai_data = call_openai(full_text, canonical_topics)

    # Validate topics
    invalid_topics = set(ai_data["topics"]) - set(canonical_topics)
    if invalid_topics:
        print("⚠️ AI returned invalid topics:", invalid_topics)
        raise ValueError("AI topic validation failed.")

    simulated_insert = {
        "identifier": identifier,
        "title": title,
        "document_type": "administrative_letter",
        "publication_date": publication_date,
        "source_url": TEST_DOCUMENT["url"],
        "summary": ai_data["summary"],
        "practical_impact": ai_data["practical_impact"],
        "full_text_preview": full_text[:500] + "...",
        "metadata": {
            "statutes": ai_data["statutes"],
            "keywords": ai_data["keywords"]
        },
        "topics": ai_data["topics"]
    }

    print("\n---- SIMULATED DATABASE WRITE ----\n")
    print(json.dumps(simulated_insert, indent=2))
    print("\n---- TEST COMPLETE (NO DATA WRITTEN) ----")
'''
def main():
    print("---- STARTING BULK TEST INGEST ----\n")

    documents = load_documents_from_csv("final_copy.csv")
    print(f"Loaded {len(documents)} documents from CSV.\n")

    for i, doc in enumerate(documents, start=1):
        print(f"\n===== Processing {i}/{len(documents)} =====")
        print(f"Identifier (CSV): {doc['identifier']}")
        print(f"URL: {doc['url']}")

        try:
            full_text = extract_pdf_text(doc["url"])

            publication_date = extract_publication_date(full_text)
            title = extract_re_subject(full_text)
            first_sentence = extract_first_sentence(full_text)

            print("✓ Publication Date:", publication_date)
            print("✓ Title:", title)
            print("✓ First Sentence:", first_sentence)

        except Exception as e:
            print("❌ Failed:", str(e))
            continue

    print("\n---- BULK TEST COMPLETE ----")

if __name__ == "__main__":
    main()