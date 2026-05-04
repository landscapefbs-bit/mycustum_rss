package main

import (
	"log"
	"time"
	"myrss-backend/config"
	"myrss-backend/models"
	"myrss-backend/routes"
	"myrss-backend/services"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if exists
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	// Connect to Database
	config.ConnectDB()

	// Migrate Schema
	err = config.DB.AutoMigrate(&models.Feed{}, &models.Article{}, &models.DateQuery{})
	if err != nil {
		log.Fatal("Failed to migrate database schema:", err)
	}

	r := gin.Default()

	// Simple CORS middleware for local development
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Start auto-fetch daemon
	startAutoFetchDaemon()

	// Setup API Routes
	routes.SetupRoutes(r)

	// Start server
	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func startAutoFetchDaemon() {
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			var feeds []models.Feed
			config.DB.Where("fetch_interval > 0").Find(&feeds)
			now := time.Now()
			for _, f := range feeds {
				nextFetchTime := f.LastFetchedAt.Add(time.Duration(f.FetchInterval) * time.Minute)
				if now.After(nextFetchTime) || f.LastFetchedAt.IsZero() {
					log.Printf("Auto fetching feed: %s", f.Title)
					services.FetchFeed(&f)
				}
			}

			// Clean up old articles based on RetentionDays
			var allFeeds []models.Feed
			config.DB.Where("retention_days > 0").Find(&allFeeds)
			for _, f := range allFeeds {
				cutoff := now.AddDate(0, 0, -f.RetentionDays)
				res := config.DB.Where("feed_id = ? AND published_at < ? AND is_favorite = ? AND is_saved = ?", f.ID, cutoff, false, false).Delete(&models.Article{})
				if res.RowsAffected > 0 {
					log.Printf("Deleted %d old articles from feed %s", res.RowsAffected, f.Title)
				}
			}
		}
	}()
}
