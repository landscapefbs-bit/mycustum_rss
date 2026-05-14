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

var llmMutex sync.Mutex

// OpenAI Format Structs
type OpenAIChatRequest struct {
	Model    string          `json:"model"`
	Messages []OpenAIMessage `json:"messages"`
}

type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Gemini Format Structs
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

type RecommendationResponse struct {
	ID     uint   `json:"id"`
	Reason string `json:"reason"`
}

// generateContentWithLLM abstracts the LLM call based on the environment variables
func generateContentWithLLM(prompt string) (string, error) {
	llmMutex.Lock()
	defer llmMutex.Unlock()

	provider := os.Getenv("LLM_PROVIDER")
	if provider == "" {
		if os.Getenv("GEMINI_API_KEY") != "" {
			provider = "gemini"
		} else {
			return "", fmt.Errorf("no LLM provider configured. Set LLM_PROVIDER or GEMINI_API_KEY")
		}
	}

	if provider == "lmstudio" {
		return callLMStudio(prompt)
	}

	return callGemini(prompt)
}

func callGemini(prompt string) (string, error) {
	time.Sleep(2 * time.Second) // rate limit mitigation for free tier

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

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
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		return geminiResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return "", fmt.Errorf("gemini API returned empty response")
}

func callLMStudio(prompt string) (string, error) {
	apiBase := os.Getenv("LMSTUDIO_API_BASE")
	if apiBase == "" {
		apiBase = "http://localhost:1234/v1"
	}
	// Ensure no trailing slash before appending path
	apiBase = strings.TrimSuffix(apiBase, "/")
	url := apiBase + "/chat/completions"

	modelName := os.Getenv("LMSTUDIO_MODEL")
	if modelName == "" {
		modelName = "local-model"
	}

	reqBody := OpenAIChatRequest{
		Model: modelName,
		Messages: []OpenAIMessage{
			{Role: "user", Content: prompt},
		},
	}

	jsonReq, _ := json.Marshal(reqBody)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonReq))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var openAIResp OpenAIChatResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", err
	}

	if len(openAIResp.Choices) > 0 {
		return openAIResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("lmstudio API returned empty response")
}

// Helper to clean JSON string from markdown code blocks
func cleanJSONResponse(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}

func SummarizeArticle(article *models.Article) {
	if article.Content == "" {
		return
	}

	prompt := fmt.Sprintf(`以下の記事を3行で要約し、関連するタグをカンマ区切りで出力してください。必ず指定されたJSON形式のみを出力してください。他のテキストは含めないでください。
{
  "summary": "要約テキスト...",
  "tags": "タグA, タグB"
}
本文:
%s`, article.Content)

	if len(prompt) > 15000 {
		prompt = prompt[:15000] // Truncate if too long
	}

	resultText, err := generateContentWithLLM(prompt)
	if err != nil {
		log.Println("Error calling LLM for summarization:", err)
		return
	}

	resultText = cleanJSONResponse(resultText)

	var summaryResp SummaryResponse
	if err := json.Unmarshal([]byte(resultText), &summaryResp); err == nil {
		article.Summary = summaryResp.Summary
		article.Tags = summaryResp.Tags
		config.DB.Save(article)
		log.Printf("Summarized article ID %d", article.ID)
	} else {
		log.Println("Failed to parse LLM JSON output:", err, "Raw text:", resultText)
	}
}

func ParseDateQueryWithLLM(query string) (models.DateQuery, error) {
	today := time.Now().Format("2006-01-02")
	prompt := fmt.Sprintf(`あなたは日付指定のパーサーです。今日の日付は %s です。
ユーザーの入力: "%s"
この入力を解釈し、該当する日付をYYYY-MM-DD形式で以下のJSONスキーマに従って出力してください。必ずJSONのみを出力し、他のテキストは含めないでください。
{
  "date_from": "開始日(ある場合)",
  "date_to": "終了日(ある場合)",
  "dates": "カンマ区切りの複数日(ある場合)"
}
期間の場合はdate_fromとdate_toを使用。飛び飛びの日の場合はdatesを使用。`, today, query)

	resultText, err := generateContentWithLLM(prompt)
	if err != nil {
		return models.DateQuery{}, err
	}

	resultText = cleanJSONResponse(resultText)

	var dq models.DateQuery
	if err := json.Unmarshal([]byte(resultText), &dq); err == nil {
		dq.Query = strings.TrimSpace(query)
		return dq, nil
	}

	return models.DateQuery{}, fmt.Errorf("failed to parse AI output: %v, raw text: %s", err, resultText)
}

func GetAIRecommendations(limit int) ([]models.Article, error) {
	var favorites []models.Article
	config.DB.Where("is_favorite = ?", true).Order("updated_at DESC").Limit(50).Find(&favorites)

	if len(favorites) == 0 {
		return nil, nil // No favorites
	}

	var unread []models.Article
	config.DB.Where("is_read = ?", false).Order("published_at DESC").Limit(100).Find(&unread)

	if len(unread) == 0 {
		return nil, nil
	}

	var promptBuilder strings.Builder
	promptBuilder.WriteString("あなたはユーザーの好みを分析し、最適な記事を推薦するAIアシスタントです。\n")
	promptBuilder.WriteString("以下はユーザーが最近「お気に入り」に登録した記事のリストです。これらからユーザーの興味・関心（プロファイル）を読み取ってください。\n\n")

	for i, f := range favorites {
		promptBuilder.WriteString(fmt.Sprintf("[お気に入り %d]\nタイトル: %s\nタグ: %s\n要約: %s\n\n", i+1, f.Title, f.Tags, f.Summary))
	}

	promptBuilder.WriteString("次に、現在未読の最新記事リストを提示します。\n\n")
	for _, u := range unread {
		promptBuilder.WriteString(fmt.Sprintf("[未読記事 ID: %d]\nタイトル: %s\nタグ: %s\n要約: %s\n\n", u.ID, u.Title, u.Tags, u.Summary))
	}

	promptBuilder.WriteString(fmt.Sprintf("上記の未読記事の中から、ユーザーの興味に最も合致するおすすめの記事を**厳選して最大 %d 件**選んでください。\n", limit))
	promptBuilder.WriteString("以下の厳密なJSONフォーマットの配列でのみ返してください。それ以外のテキストやMarkdownブロックは一切含めないでください。\n")
	promptBuilder.WriteString("[\n  {\n    \"id\": 123,\n    \"reason\": \"あなたが最近AI関連の記事をお気に入りに入れているため、この記事をおすすめします。\"\n  }\n]\n")

	prompt := promptBuilder.String()
	if len(prompt) > 50000 {
		prompt = prompt[:50000] // Truncate if too large
	}

	resultText, err := generateContentWithLLM(prompt)
	if err != nil {
		return nil, err
	}

	resultText = cleanJSONResponse(resultText)

	var recResponses []RecommendationResponse
	if err := json.Unmarshal([]byte(resultText), &recResponses); err == nil {
		var recommendedArticles []models.Article
		for _, rec := range recResponses {
			var article models.Article
			if err := config.DB.Preload("Feed").First(&article, rec.ID).Error; err == nil {
				article.RecommendReason = rec.Reason
				recommendedArticles = append(recommendedArticles, article)
			}
		}
		return recommendedArticles, nil
	} else {
		log.Println("Failed to parse recommendation JSON output:", err, "Raw text:", resultText)
		return nil, fmt.Errorf("failed to parse AI response")
	}
}
