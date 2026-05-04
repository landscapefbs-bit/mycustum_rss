package services

import (
	"log"
	"io"
	"net/http"
	"regexp"
	"strings"
	"myrss-backend/config"
	"myrss-backend/models"
	"time"

	md "github.com/JohannesKaufmann/html-to-markdown"
	"github.com/go-shiori/go-readability"
	"github.com/mmcdole/gofeed"
)

func FetchFeed(feed *models.Feed) error {
	var parsedFeed *gofeed.Feed
	var err error

	if strings.Contains(feed.URL, "news.yahoo.co.jp") {
		resp, errGet := http.Get(feed.URL)
		if errGet == nil {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			bodyStr := string(body)

			reComments := regexp.MustCompile(`<comments>(.*?)/comments</comments>`)
			reItem := regexp.MustCompile(`(?s)<item>(.*?)</item>`)
			
			bodyStr = reItem.ReplaceAllStringFunc(bodyStr, func(itemStr string) string {
				match := reComments.FindStringSubmatch(itemStr)
				if len(match) > 1 {
					newLink := match[1]
					reLink := regexp.MustCompile(`<link>.*?</link>`)
					itemStr = reLink.ReplaceAllString(itemStr, "<link>"+newLink+"</link>")
				}
				return itemStr
			})

			fp := gofeed.NewParser()
			parsedFeed, err = fp.ParseString(bodyStr)
		} else {
			err = errGet
		}
	} else {
		fp := gofeed.NewParser()
		parsedFeed, err = fp.ParseURL(feed.URL)
	}

	if err != nil {
		return err
	}

	// Update feed info if empty
	if feed.Title == "" {
		feed.Title = parsedFeed.Title
		feed.Description = parsedFeed.Description
		config.DB.Save(feed)
	}

	for _, item := range parsedFeed.Items {
		var existing models.Article
		// Check if article exists
		if err := config.DB.Where("url = ?", item.Link).First(&existing).Error; err == nil {
			continue // Already exists
		}

		// Extract full content
		content := ""
		article, err := readability.FromURL(item.Link, 30*time.Second)
		if err == nil {
			converter := md.NewConverter("", true, nil)
			markdown, convErr := converter.ConvertString(article.Content)
			if convErr == nil {
				content = markdown
			} else {
				content = article.TextContent // Fallback
			}
		}

		pubDate := time.Now()
		if item.PublishedParsed != nil {
			pubDate = *item.PublishedParsed
		}

		newArticle := models.Article{
			FeedID:      feed.ID,
			Title:       item.Title,
			URL:         item.Link,
			Content:     content,
			PublishedAt: pubDate,
		}

		config.DB.Create(&newArticle)
		
		// Trigger AI summarization asynchronously
		go SummarizeArticle(&newArticle)
	}

	feed.LastFetchedAt = time.Now()
	config.DB.Save(feed)
	log.Printf("Successfully fetched feed: %s\n", feed.Title)
	return nil
}
