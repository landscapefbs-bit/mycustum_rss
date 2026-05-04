package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"myrss-backend/config"
	"myrss-backend/models"
)

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

type SummaryResponse struct {
	Summary string `json:"summary"`
	Tags    string `json:"tags"`
}

var geminiMutex sync.Mutex

func SummarizeArticle(article *models.Article) {
	geminiMutex.Lock()
	defer geminiMutex.Unlock()

	// Ensure max 15 requests per minute for Gemini Free Tier
	time.Sleep(4 * time.Second)

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("No GEMINI_API_KEY set, skipping AI summary")
		return
	}

	if article.Content == "" {
		return
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey

	prompt := fmt.Sprintf(`以下の記事を3行で要約し、関連するタグをカンマ区切りで出力してください。必ず指定されたJSON形式で出力してください。
{
  "summary": "要約テキスト...",
  "tags": "タグA, タグB"
}
本文:
%s`, article.Content)

	if len(prompt) > 15000 {
		prompt = prompt[:15000] // Truncate if too long
	}

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"responseMimeType": "application/json",
		},
	}

	jsonReq, _ := json.Marshal(reqBody)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonReq))
	if err != nil {
		log.Println("Error calling Gemini API:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		log.Println("Error parsing Gemini API response:", err)
		return
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		resultText := geminiResp.Candidates[0].Content.Parts[0].Text
		
		// Clean up potential markdown formatting around the JSON
		resultText = strings.TrimSpace(resultText)
		resultText = strings.TrimPrefix(resultText, "```json")
		resultText = strings.TrimSuffix(resultText, "```")
		resultText = strings.TrimSpace(resultText)

		var summaryResp SummaryResponse
		if err := json.Unmarshal([]byte(resultText), &summaryResp); err == nil {
			article.Summary = summaryResp.Summary
			article.Tags = summaryResp.Tags
			config.DB.Save(article)
			log.Printf("Summarized article ID %d", article.ID)
		} else {
			log.Println("Failed to parse Gemini JSON output:", err, "Raw text:", resultText)
		}
	} else {
		log.Println("Gemini API returned empty response. Possibly rate limited.")
	}
}

func ParseDateQueryWithGemini(query string) (models.DateQuery, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return models.DateQuery{}, fmt.Errorf("GEMINI_API_KEY not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey

	today := time.Now().Format("2006-01-02")
	prompt := fmt.Sprintf(`あなたは日付指定のパーサーです。今日の日付は %s です。
ユーザーの入力: "%s"
この入力を解釈し、該当する日付をYYYY-MM-DD形式で以下のJSONスキーマに従って出力してください。
{
  "date_from": "開始日(ある場合)",
  "date_to": "終了日(ある場合)",
  "dates": "カンマ区切りの複数日(ある場合)"
}
期間の場合はdate_fromとdate_toを使用。飛び飛びの日の場合はdatesを使用。
JSONのみを出力してください。`, today, query)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"responseMimeType": "application/json",
		},
	}

	jsonReq, _ := json.Marshal(reqBody)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonReq))
	if err != nil {
		return models.DateQuery{}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return models.DateQuery{}, err
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		resultText := geminiResp.Candidates[0].Content.Parts[0].Text
		var dq models.DateQuery
		if err := json.Unmarshal([]byte(resultText), &dq); err == nil {
			dq.Query = strings.TrimSpace(query)
			return dq, nil
		}
		return models.DateQuery{}, fmt.Errorf("failed to parse AI output: %v", err)
	}

	return models.DateQuery{}, fmt.Errorf("no response from AI")
}
