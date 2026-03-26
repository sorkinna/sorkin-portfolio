import csv
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Base URLs
LISTING_BASE = "https://www.scc.virginia.gov/regulated-industries/companies/administration-of-insurance-regulation-in-virginia/administrative-letters/"
BASE_DOMAIN = "https://www.scc.virginia.gov"
# Where to save CSV
OUTPUT_CSV = "administrative_letters.csv"

def get_page_html(page_num):
    url = LISTING_BASE + (str(page_num) + "/" if page_num > 1 else "")
    print(f"Fetching {url}")
    r = requests.get(url)
    r.raise_for_status()
    return r.text

def parse_identifiers(html):
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("table tr")
    letters = []

    for row in rows:
        cols = row.find_all("td")
        if len(cols) >= 2:
            link_tag = cols[0].find("a", href=True)
            year = cols[1].get_text(strip=True)

            if link_tag:
                ident = link_tag.get_text(strip=True)
                href = link_tag["href"]

                # Validate AL format (1 or 2 digit number allowed)
                if re.match(r"AL\s?\d{4}-\d{1,2}", ident):
                    full_url = urljoin(BASE_DOMAIN, href)
                    letters.append((ident, year, full_url))
    return letters

all_letters = []

# Pages 1 through 9
for i in range(1, 10):
    html = get_page_html(i)
    extracted = parse_identifiers(html)
    print(f"Found {len(extracted)} letters on page {i}")
    all_letters.extend(extracted)

# Deduplicate if same identifier appears
unique_letters = list(dict.fromkeys(all_letters))

# Write CSV
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["identifier", "year", "pdf_url"])

    for ident, year, pdf_url in unique_letters:
        # Turn "AL 2025-03" into "AL-2025-03.pdf"
        writer.writerow([ident, year, pdf_url])

print(f"CSV written to {OUTPUT_CSV} with {len(unique_letters)} letters.")