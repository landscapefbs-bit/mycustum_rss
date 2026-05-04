package routes

import (
	"myrss-backend/config"
	"myrss-backend/models"
	"myrss-backend/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// Feeds
	api.GET("/feeds", getFeeds)
	api.POST("/feeds", addFeed)
	api.POST("/feeds/:id/fetch", fetchFeed)

	// Articles
	api.GET("/articles", getArticles)
	api.GET("/articles/:id", getArticle)
	api.PUT("/articles/:id/read", markRead)
	api.PUT("/articles/:id/favorite", toggleFavorite)
	api.PUT("/articles/:id/saved", toggleSaved)
	api.GET("/parse-date", parseDate)
	api.POST("/feeds/:id/refresh", refreshFeed)
	api.PUT("/feeds/:id", updateFeed)
	api.PUT("/feeds/order", updateFeedOrder)
	api.DELETE("/feeds/:id", deleteFeed)
}

type FeedResponse struct {
	models.Feed
	UnreadCount int `json:"UnreadCount"`
}

func getFeeds(c *gin.Context) {
	var feeds []models.Feed
	config.DB.Order("sort_order ASC").Find(&feeds)

	var response []FeedResponse
	for _, f := range feeds {
		var count int64
		config.DB.Model(&models.Article{}).Where("feed_id = ? AND is_read = ?", f.ID, false).Count(&count)
		response = append(response, FeedResponse{
			Feed:        f,
			UnreadCount: int(count),
		})
	}

	c.JSON(http.StatusOK, response)
}

func addFeed(c *gin.Context) {
	var req struct {
		URL string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	feed := models.Feed{URL: req.URL}
	if err := config.DB.Create(&feed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add feed. It might already exist."})
		return
	}

	// Trigger async fetch
	go services.FetchFeed(&feed)

	c.JSON(http.StatusCreated, feed)
}

func fetchFeed(c *gin.Context) {
	id := c.Param("id")
	var feed models.Feed
	if err := config.DB.First(&feed, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Feed not found"})
		return
	}

	go services.FetchFeed(&feed)
	c.JSON(http.StatusOK, gin.H{"message": "Fetch triggered"})
}

func getArticles(c *gin.Context) {
	var articles []models.Article
	query := config.DB.Order("published_at DESC").Preload("Feed")

	// Filter by feed_id
	if feedID := c.Query("feed_id"); feedID != "" {
		if feedID == "-1" {
			// Favorite
			query = query.Where("is_favorite = ?", true)
		} else if feedID == "-2" {
			// Read Later (Saved)
			query = query.Where("is_saved = ?", true)
		} else {
			query = query.Where("feed_id = ?", feedID)
		}
	}

	// Filter by keyword (content only)
	if keyword := c.Query("keyword"); keyword != "" {
		likeQuery := "%" + keyword + "%"
		query = query.Where("content ILIKE ?", likeQuery)
	}

	// Filter by tags
	if tags := c.Query("tags"); tags != "" {
		likeQuery := "%" + tags + "%"
		query = query.Where("tags ILIKE ?", likeQuery)
	}

	// Filter by exact discontinuous dates
	if datesStr := c.Query("dates"); datesStr != "" {
		// "2026-05-01,2026-05-04" -> ["2026-05-01", "2026-05-04"]
		// In PostgreSQL, we can cast to date for comparison
		dates := strings.Split(datesStr, ",")
		query = query.Where("DATE(published_at) IN ?", dates)
	}

	// Filter by date range
	if dateFrom := c.Query("date_from"); dateFrom != "" {
		query = query.Where("published_at >= ?", dateFrom+" 00:00:00")
	}
	if dateTo := c.Query("date_to"); dateTo != "" {
		query = query.Where("published_at <= ?", dateTo+" 23:59:59")
	}

	// Exclude archived by default unless specifically asked
	if archived := c.Query("archived"); archived == "true" {
		query = query.Where("is_archived = ?", true)
	} else {
		query = query.Where("is_archived = ?", false)
	}

	query.Find(&articles)
	c.JSON(http.StatusOK, articles)
}

func getArticle(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := config.DB.Preload("Feed").First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	c.JSON(http.StatusOK, article)
}

func markRead(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := config.DB.First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	article.IsRead = true
	config.DB.Save(&article)
	c.JSON(http.StatusOK, article)
}

func toggleFavorite(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := config.DB.First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	article.IsFavorite = !article.IsFavorite
	config.DB.Save(&article)
	c.JSON(http.StatusOK, article)
}

func toggleSaved(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := config.DB.First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	article.IsSaved = !article.IsSaved
	config.DB.Save(&article)
	c.JSON(http.StatusOK, article)
}

func markArchive(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := config.DB.First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	article.IsArchived = true
	config.DB.Save(&article)
	c.JSON(http.StatusOK, article)
}

func parseDate(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query is required"})
		return
	}

	var dq models.DateQuery
	if err := config.DB.Where("query = ?", q).First(&dq).Error; err == nil {
		c.JSON(http.StatusOK, dq)
		return
	}

	parsed, err := services.ParseDateQueryWithGemini(q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	config.DB.Create(&parsed)
	c.JSON(http.StatusOK, parsed)
}

func refreshFeed(c *gin.Context) {
	id := c.Param("id")
	var feed models.Feed
	if err := config.DB.First(&feed, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Feed not found"})
		return
	}
	err := services.FetchFeed(&feed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, feed)
}

func updateFeed(c *gin.Context) {
	id := c.Param("id")
	var feed models.Feed
	if err := config.DB.First(&feed, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Feed not found"})
		return
	}

	var req struct {
		FetchInterval *int `json:"fetch_interval"`
		RetentionDays *int `json:"retention_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.FetchInterval != nil {
		feed.FetchInterval = *req.FetchInterval
	}
	if req.RetentionDays != nil {
		feed.RetentionDays = *req.RetentionDays
	}
	
	config.DB.Save(&feed)
	c.JSON(http.StatusOK, feed)
}

func updateFeedOrder(c *gin.Context) {
	var req struct {
		Order []uint `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for i, id := range req.Order {
		config.DB.Model(&models.Feed{}).Where("id = ?", id).Update("sort_order", i)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order updated"})
}

func deleteFeed(c *gin.Context) {
	id := c.Param("id")
	config.DB.Where("id = ?", id).Delete(&models.Feed{})
	config.DB.Where("feed_id = ?", id).Delete(&models.Article{})
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
