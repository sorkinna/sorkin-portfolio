import requests
from bs4 import BeautifulSoup
import pandas as pd

URL = "https://www.scc.virginia.gov/regulated-industries/companies/for-insurance-companies/market-conduct-examination-reports/"

response = requests.get(URL)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

rows = []

# Find all table rows
table_rows = soup.find_all("tr")

for row in table_rows:
    cols = row.find_all("td")

    if len(cols) == 4:
        company_cell = cols[0]
        naic_code = cols[1].text.strip()
        company_type = cols[2].text.strip()
        order_date = cols[3].text.strip()

        company_name = company_cell.text.strip()

        link = company_cell.find("a")
        pdf_url = None
        if link:
            pdf_url = link["href"]

            # convert relative url to full url
            if pdf_url.startswith("/"):
                pdf_url = "https://www.scc.virginia.gov" + pdf_url

        rows.append({
            "company_name": company_name,
            "naic_code": naic_code,
            "company_type": company_type,
            "order_date": order_date,
            "pdf_url": pdf_url
        })

df = pd.DataFrame(rows)

df.to_csv("va_market_conduct_reports.csv", index=False)

print(f"Saved {len(df)} rows to va_market_conduct_reports.csv")