package models

import (
	"time"
	"gorm.io/gorm"
)

type Article struct {
	ID          uint           `gorm:"primaryKey"`
	FeedID      uint
	Feed        Feed
	Title       string
	URL         string         `gorm:"uniqueIndex"`
	Content     string         // Full extracted content
	Summary     string         // AI Summary
	Tags        string         // Comma separated tags
	PublishedAt time.Time
	IsRead      bool           `gorm:"default:false"`
	IsFavorite  bool           `gorm:"default:false"`
	IsSaved     bool           `gorm:"default:false"`
	IsArchived      bool           `gorm:"default:false"`
	RecommendReason string         `gorm:"-" json:"RecommendReason,omitempty"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       gorm.DeletedAt `gorm:"index"`
}
