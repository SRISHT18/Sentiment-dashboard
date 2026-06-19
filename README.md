# Sentiment Analysis Dashboard

Analyze customer feedback as **Positive**, **Negative**, or **Neutral** using DistilBERT + FastAPI + React.

## Project Structure

```
sentiment-dashboard/
├── backend/
│   ├── main.py          # FastAPI app + DistilBERT inference
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx      # Full dashboard UI
        └── index.css
```

## Pipeline

```
Upload CSV  →  Clean Text  →  Run DistilBERT  →  Count  →  Dashboard  →  Export CSV
```

---

## Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
python main.py
# → http://localhost:8000
# → Docs at http://localhost:8000/docs
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Check server + model status |
| POST | `/analyze` | Analyze JSON list of texts |
| POST | `/upload-csv` | Upload and analyze a CSV file |
| POST | `/export-csv` | Get results as downloadable CSV |

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env file and set backend URL
cp .env.example .env

# Start dev server
npm run dev
# → http://localhost:3000

# Build for production
npm run build
```

---

## CSV Format

Your CSV should have a column named one of:
`feedback`, `text`, `review`, `comment`, `message`, `content`

Example:
```csv
id,feedback
1,"The product exceeded my expectations!"
2,"Delivery was slow and support ignored me."
3,"It works fine, nothing special."
```

---

## Model

Uses `distilbert-base-uncased-finetuned-sst-2-english` from HuggingFace.
- Fast (~50ms/entry on CPU)
- Predictions under 65% confidence are mapped to **Neutral**
- Runs fully offline after first download (~250 MB)

To swap in a different model, change the `model=` argument in `main.py`:
```python
sentiment_model = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",  # example
)
```
