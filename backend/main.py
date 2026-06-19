from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import io
import csv
import re
from transformers import pipeline
import uvicorn

app = FastAPI(title="Sentiment Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
print("Loading sentiment model...")
sentiment_model = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english",
    truncation=True,
    max_length=512,
)
print("Model loaded.")


# ---------- helpers ----------

def clean_text(text: str) -> str:
    text = str(text).strip()
    text = re.sub(r"http\S+|www\.\S+", "", text)       # remove URLs
    text = re.sub(r"<[^>]+>", "", text)                # strip HTML tags
    text = re.sub(r"[^\x00-\x7F]+", " ", text)         # remove non-ASCII
    text = re.sub(r"\s+", " ", text).strip()
    return text


def map_label(label: str) -> str:
    return {"POSITIVE": "Positive", "NEGATIVE": "Negative"}.get(label.upper(), "Neutral")


def run_sentiment(texts: List[str]) -> List[dict]:
    cleaned = [clean_text(t) for t in texts]
    results = sentiment_model(cleaned, batch_size=16)
    output = []
    for original, clean, res in zip(texts, cleaned, results):
        label = map_label(res["label"])
        # push low-confidence predictions to Neutral
        if res["score"] < 0.65:
            label = "Neutral"
        output.append({
            "original_text": original,
            "cleaned_text": clean,
            "sentiment": label,
            "confidence": round(res["score"], 4),
        })
    return output


# ---------- request / response models ----------

class TextItem(BaseModel):
    text: str


class AnalyzeRequest(BaseModel):
    texts: List[str]


class SentimentResult(BaseModel):
    id: int
    original_text: str
    cleaned_text: str
    sentiment: str
    confidence: float


class AnalyzeResponse(BaseModel):
    total: int
    positive: int
    negative: int
    neutral: int
    positive_pct: float
    negative_pct: float
    neutral_pct: float
    results: List[SentimentResult]


# ---------- endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok", "model": "distilbert-base-uncased-finetuned-sst-2-english"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_texts(req: AnalyzeRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="No texts provided.")
    if len(req.texts) > 1000:
        raise HTTPException(status_code=400, detail="Max 1000 entries per request.")

    raw = run_sentiment(req.texts)

    results = [SentimentResult(id=i + 1, **r) for i, r in enumerate(raw)]
    total = len(results)
    pos = sum(1 for r in results if r.sentiment == "Positive")
    neg = sum(1 for r in results if r.sentiment == "Negative")
    neu = total - pos - neg

    return AnalyzeResponse(
        total=total,
        positive=pos,
        negative=neg,
        neutral=neu,
        positive_pct=round(pos / total * 100, 1) if total else 0,
        negative_pct=round(neg / total * 100, 1) if total else 0,
        neutral_pct=round(neu / total * 100, 1) if total else 0,
        results=results,
    )


@app.post("/upload-csv", response_model=AnalyzeResponse)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    # auto-detect text column
    col = None
    for candidate in ["feedback", "text", "review", "comment", "message", "content"]:
        matches = [c for c in df.columns if candidate in c.lower()]
        if matches:
            col = matches[0]
            break
    if col is None:
        col = df.columns[0]

    texts = df[col].dropna().astype(str).tolist()
    if not texts:
        raise HTTPException(status_code=400, detail="No text data found in CSV.")

    req = AnalyzeRequest(texts=texts)
    return analyze_texts(req)


@app.post("/export-csv")
def export_csv(req: AnalyzeRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="No texts provided.")

    raw = run_sentiment(req.texts)
    total = len(raw)
    pos = sum(1 for r in raw if r["sentiment"] == "Positive")
    neg = sum(1 for r in raw if r["sentiment"] == "Negative")
    neu = total - pos - neg

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Original Text", "Cleaned Text", "Sentiment", "Confidence"])
    for i, r in enumerate(raw, 1):
        writer.writerow([i, r["original_text"], r["cleaned_text"], r["sentiment"], f"{r['confidence']*100:.1f}%"])

    writer.writerow([])
    writer.writerow(["Summary"])
    writer.writerow(["Total", total])
    writer.writerow(["Positive", f"{pos} ({round(pos/total*100,1)}%)"])
    writer.writerow(["Negative", f"{neg} ({round(neg/total*100,1)}%)"])
    writer.writerow(["Neutral", f"{neu} ({round(neu/total*100,1)}%)"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sentiment_report.csv"},
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
