import os
import requests
import re
import csv
import tempfile
import json
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client
import fitz  # PyMuPDF
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

CSV_FILE = "va_market_conduct_reports.csv"

# -----------------------------
# Load existing URLs
# -----------------------------

def fetch_existing_urls():
    print("Fetching existing report URLs from DB...")

    response = supabase.table("market_conduct_reports") \
        .select("report_url") \
        .execute()

    if not response.data:
        return set()

    return set(row["report_url"] for row in response.data)

# -----------------------------
# LOAD DOCUMENT LIST
# -----------------------------

def load_documents_from_csv(path):

    docs = []

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:

            docs.append({
                "company": row["company_name"].strip(),
                "company_type": row["company_type"].strip(),
                "date": row["order_date"].strip(),
                "url": row["pdf_url"].strip()
            })

    return docs

def build_extraction_prompt(executive_summary, settlement_order, metadata):
    return f"""
You are an expert in insurance regulatory analysis.

Your task is to extract structured data from a Virginia market conduct examination report.

You will be given:
1. Executive Summary section
2. Settlement Order section
3. Basic metadata (company name, type, date, url)

---

IMPORTANT RULES:

- ONLY use the provided text
- Output MUST be valid JSON (no explanations)
- Do NOT hallucinate or infer missing data
- If a value is not present, return null

FORMATTING RULES:

- Structured numeric fields:
  - Must be numbers ONLY (no commas, no "$", no text)
  - Example: 648000

- Narrative fields (summary):
  - SHOULD use normal human-readable formatting
  - Include "$" and commas when referencing money
  - Example: "$648,000"

- Arrays must always be arrays (not strings)
- Dates should be YYYY-MM-DD if available, otherwise null

---

### METADATA:
Company Name: {metadata["company"]}
Company Type: {metadata["company_type"]}
Report Date: {metadata["date"]}
Report URL: {metadata["url"]}

---

### EXECUTIVE SUMMARY:
{executive_summary}

---

### SETTLEMENT ORDER:
{settlement_order}

---

### OUTPUT SCHEMA:

{{
  "company_type": string,

  "report_year": integer | null,

  "violations_total": integer | null,

  "violations_breakdown": {{
    "<standardized_violation_type>": integer
  }} | null,

  "civil_penalty": number | null,
  "restitution_amount": number | null,
  "restitution_consumers": number | null,

  "statutes": string[],
  "violation_types": string[],

  "keywords": string[],

  "summary": string
}}

---

### VIOLATION STANDARDIZATION (CRITICAL)

You MUST map all violations into ONLY the following categories (for violations_breakdown keys):

claims_handling
unfair_claim_settlement
policy_forms_and_filing
rating_and_underwriting
policy_issuance_and_content
cancellations_and_terminations
notices_and_disclosures
agent_licensing_and_appointments
commissions_and_compensation
complaint_handling
general_business_practices
misrepresentation_and_advertising
regulatory_reporting_and_filing
records_access_and_retention
provider_contracts
mental_health_parity_mhpaea
consumer_financial_harm
information_security
other

---

### VIOLATION HUMAN-READABLE NAMES (for violation_types)

Use these English names exactly for the violation_types array, including only categories present in violations_breakdown:

claims_handling → Claims Handling
unfair_claim_settlement → Unfair Claim Settlement
policy_forms_and_filing → Policy Forms and Filing
rating_and_underwriting → Rating and Underwriting
policy_issuance_and_content → Policy Issuance and Content
cancellations_and_terminations → Cancellations and Terminations
notices_and_disclosures → Notices and Disclosures
agent_licensing_and_appointments → Agent Licensing and Appointments
commissions_and_compensation → Commissions and Compensation
complaint_handling → Complaint Handling
general_business_practices → General Business Practices
misrepresentation_and_advertising → Misrepresentation and Advertising
regulatory_reporting_and_filing → Regulatory Reporting and Filing
records_access_and_retention → Records Access and Retention
provider_contracts → Provider Contracts
mental_health_parity_mhpaea → Mental Health Parity / MHPAEA
consumer_financial_harm → Consumer Financial Harm
information_security → Information Security
other → Other

---

### MAPPING RULES

- claims, claim errors → claims_handling
- unfair claim settlement → unfair_claim_settlement
- forms, filings → policy_forms_and_filing
- rating, underwriting → rating_and_underwriting
- policy issuance/content → policy_issuance_and_content
- cancellations, terminations → cancellations_and_terminations
- notices, disclosures, EOB → notices_and_disclosures
- agent licensing/appointments → agent_licensing_and_appointments
- commissions → commissions_and_compensation
- complaints → complaint_handling
- general business practices → general_business_practices
- misrepresentation, advertising → misrepresentation_and_advertising
- rate filing → regulatory_reporting_and_filing
- records access/retention → records_access_and_retention
- provider/pharmacy contracts → provider_contracts
- MHPAEA, NQTL, autism coverage → mental_health_parity_mhpaea
- restitution, cost-sharing → consumer_financial_harm
- data security → information_security

If unclear → use "other"

---

### EXTRACTION GUIDELINES

Violations:
- Extract total violations if explicitly stated
- Map counts into standardized categories for violations_breakdown
- violations_breakdown keys MUST match standardized categories exactly
- violation_types must be the corresponding English names **only for categories present in violations_breakdown**

Statutes:
- Extract all citations like "38.2-XXXX"

Civil Penalty:
- Extract monetary penalties paid to the state

Restitution:
- Extract total restitution amount paid to consumers
- Extract number of affected consumers if available

Summary:
- Write a concise 2–3 sentence explanation of:
  - What the company did wrong
  - What the regulatory issue was
  - Any penalties or corrective actions
- Use normal currency formatting (e.g., "$648,000")

Keywords:
- Include 5–10 relevant regulatory or insurance terms

---

Return ONLY valid JSON.
"""

def process_report(doc, sections):

    prompt = build_extraction_prompt(
        sections["executive_summary"],
        sections["settlement_order"],
        doc
    )

    try:
        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": "You are a precise legal analyst summarizing Virginia insurance regulatory letters for an attorney and extracting structured data."},
                {"role": "user", "content": prompt}
            ],
            temperature=1
        )

        content = response.choices[0].message.content

        data = json.loads(content)
        print(data)
        return data

    except Exception as e:
        print("❌ LLM extraction failed:", e)
        return

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
        doc = fitz.open(temp_path)

        full_text = ""
        page_map = []  # list of (line, page_number)

        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")

            lines = text.split("\n")

            for line in lines:
                page_map.append((line, page_num))

            full_text += text + "\n"

        if full_text.strip():
            print("✓ Extracted using PyMuPDF")
            return full_text, page_map

        raise ValueError("PyMuPDF extraction failed.")

        # ---- Try pdfminer ----
        print("Trying pdfminer...")

        text = pdfminer_extract_text(temp_path)

        if text and text.strip():
            print("✓ Extracted using pdfminer")
            return text

        # ---- OCR fallback ----
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

#Section Extraction Helper
def is_real_section(lines, idx):
    """
    Determine if a header is a real section by checking what follows it.
    """

    # Look at next ~5 lines
    lookahead = lines[idx + 1: idx + 6]

    if not lookahead:
        return False

    meaningful_lines = 0

    for line in lookahead:
        clean = line.strip()

        # Skip empty lines
        if not clean:
            continue

        # If line looks like a sentence (longer, has lowercase, spaces)
        if len(clean) > 40 and re.search(r"[a-z]", clean):
            meaningful_lines += 1

    # If we found actual paragraph-like content → it's real
    return meaningful_lines >= 1

# -----------------------------
# SECTION FINDING
# -----------------------------

def find_section(full_text, page_map, candidates, search_from_bottom=False):

    total_lines = len(page_map)

    indices = range(total_lines)
    if search_from_bottom:
        indices = reversed(indices)

    for idx in indices:
        line, page_num = page_map[idx]

        # 🔥 Skip TOC pages
        if page_num <= 4:
            continue

        clean = line.strip()
        upper = clean.upper()

        for candidate in candidates:
            if candidate in upper:

                # Context validation
                if not is_real_section([l for l, _ in page_map], idx):
                    continue

                if len(clean) > 50:
                    continue

                return idx, candidate

    return None, None

def extract_report_sections(full_text, page_map):

    lines = full_text.split("\n")

    executive_candidates = [
        "EXECUTIVE SUMMARY",
        "EXAMINATION SUMMARY",
        "SUMMARY OF EXAMINATION",
        "SCOPE OF EXAMINATIONS",
        "SCOPE OF THE EXAMINATION",
        "SCOPE OF EXAMINATION"
    ]

    settlement_candidates = [
        "SETTLEMENT ORDER",
        "CONSENT ORDER",
        "FINAL ORDER"
    ]

    exec_line, exec_header = find_section(full_text, page_map, executive_candidates, search_from_bottom=False)
    order_line, order_header = find_section(full_text, page_map, settlement_candidates, search_from_bottom=True)

    executive_summary = None
    settlement_order = None

    # -----------------------------
    # EXECUTIVE SUMMARY
    # -----------------------------
    if exec_line is not None:

        summary_lines = []

        for line in lines[exec_line + 1:]:

            clean = line.strip()

            if (
                "company profile" in clean.lower() or "company history" in clean.lower() or "statistical summary" in clean.lower()
            ):
                break
            
            if "company" in clean.lower() and len(clean.lower()) < 25:
                break

            summary_lines.append(line)

            if len("\n".join(summary_lines)) > 12000:
                break

        executive_summary = "\n".join(summary_lines).strip()

    # -----------------------------
    # SETTLEMENT ORDER
    # -----------------------------
    if order_line is not None:

        settlement_lines = lines[order_line:]

        settlement_order = "\n".join(settlement_lines[:400])

    return {
        "executive_summary": executive_summary,
        "settlement_order": settlement_order,
        "exec_header": exec_header,
        "order_header": order_header
    }


def extract_settlement_order_with_ocr(url):

    print("⚠️ Attempting OCR fallback for settlement order...")

    settlement_candidates = [
        "SETTLEMENT ORDER",
        "CONSENT ORDER",
        "FINAL ORDER"
    ]

    response = requests.get(url)
    response.raise_for_status()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(response.content)
        temp_path = tmp.name

    try:
        # Convert ONLY last few pages (huge performance win)
        doc = fitz.open(temp_path)
        total_pages = len(doc)

        first_page = max(1, total_pages - 4)
        last_page = total_pages

        images = convert_from_path(
            temp_path,
            dpi=300,
            first_page=first_page,
            last_page=last_page
        )

        ocr_text = ""

        for img in images:
            ocr_text += pytesseract.image_to_string(img) + "\n"

        lines = ocr_text.split("\n")

        # Search from bottom
        for i in range(len(lines) - 1, -1, -1):

            line = lines[i].strip().upper()

            for candidate in settlement_candidates:

                if candidate in line:

                    print(f"✓ Found via OCR: {candidate}")

                    # Grab ~400 lines after (same as your normal logic)
                    extracted = "\n".join(lines[i:i+400])

                    return extracted

        print("❌ OCR fallback failed to find settlement order")

        return None

    finally:
        os.remove(temp_path)

# -----------------------------
# STATUTE EXTRACTION
# -----------------------------

def extract_statutes(text):

    if not text:
        return []

    matches = re.findall(r"38\.2-\d+(\.\d+)?", text)

    return list(set(matches))


# -----------------------------
# CIVIL PENALTY EXTRACTION
# -----------------------------

def extract_civil_penalty(text):

    if not text:
        return None

    match = re.search(r"\$[\d,]+", text)

    if match:

        value = match.group(0).replace("$", "").replace(",", "")

        return int(value)

    return None


# -----------------------------
# MAIN TEST RUN
# -----------------------------

def main():

    summary_count = 0
    settlement_count = 0
    summary_list = []
    settlement_list = []

    print("\n---- STARTING MARKET CONDUCT TEST ----\n")

    documents = load_documents_from_csv(CSV_FILE)

    print(f"Loaded {len(documents)} reports.\n")

    for i, doc in enumerate(documents, start=1):
        existing_urls = fetch_existing_urls()

        print(f"\n===== Processing {i}/{len(documents)} =====")
        print("Company:", doc["company"])
        print("Date:", doc["date"])
        print("URL:", doc["url"])
        cleaned_company = re.sub(r" ?\(\d{4}\)$", "", doc["company"]).replace('"', '').replace("'", '')

        if doc["url"] in existing_urls:
          print("⏭️ Skipping (already ingested):", doc["url"])
          try:
            existing = supabase.table("market_conduct_reports") \
                .select("company_names") \
                .eq("report_url", doc["url"]) \
                .single() \
                .execute()

            current_companies = existing.data.get("company_names", [])
            if cleaned_company not in current_companies:
                current_companies.append(cleaned_company)
                supabase.table("market_conduct_reports").update(
                    {"company_names": current_companies}
                ).eq("report_url", doc["url"]).execute()

            print("✅ Added company to existing record:", cleaned_company)

          except Exception as e:
            print("❌ Failed to update existing record:", e)
          continue

        try:

            full_text, page_map = extract_pdf_text(doc["url"])

            sections = extract_report_sections(full_text, page_map)

            executive_summary = sections["executive_summary"]
            settlement_order = sections["settlement_order"]

            print("\n--- Section Detection ---")

            print("Executive Header Found:", sections["exec_header"])
            print("Settlement Header Found:", sections["order_header"])

            if executive_summary:
                print("✓ Executive Summary Length:", len(executive_summary))
            else:
                print("❌ Executive Summary NOT FOUND")
                summary_count+=1

            if settlement_order:
                print("✓ Settlement Order Length:", len(settlement_order))
            else:
                print("❌ Settlement Order NOT FOUND")
                settlement_order_ocr = extract_settlement_order_with_ocr(doc["url"])
                if settlement_order_ocr:
                  sections["settlement_order"] = settlement_order_ocr
                else:
                  settlement_count+=1

            print("\n--- Parsed Data ---")

            prompt_data = process_report(doc, sections)

            if not prompt_data:
                print("❌ Skipping due to LLM failure")
                continue

            report_row = {
                "company_names": [cleaned_company],
                "company_type": prompt_data.get("company_type"),

                "report_year": prompt_data.get("report_year"),

                # Leave premium fields null for now
                "premium_written_va": None,
                "premium_year": None,
                "current_premium_written_va": None,
                "current_premium_year": None,

                "violations_total": prompt_data.get("violations_total"),
                "violations_breakdown": prompt_data.get("violations_breakdown"),

                "civil_penalty": prompt_data.get("civil_penalty"),
                "restitution_amount": prompt_data.get("restitution_amount"),
                "restitution_consumers": prompt_data.get("restitution_consumers"),

                "statutes": prompt_data.get("statutes"),
                "violation_types": prompt_data.get("violation_types"),
                "keywords": prompt_data.get("keywords"),

                "summary": prompt_data.get("summary"),

                "report_url": doc["url"],

                "executive_summary_text": sections["executive_summary"],
                "settlement_order_text": sections["settlement_order"]
            }

            try:
                result = supabase.table("market_conduct_reports").insert(report_row).execute()
                print("✅ Inserted:", doc["url"])

            except Exception as e:
                print("❌ DB Insert Failed:", e)

        except Exception as e:

            print("❌ Failed:", str(e))

            continue
    print("\n---- TEST COMPLETE ----\n")


if __name__ == "__main__":
    main()