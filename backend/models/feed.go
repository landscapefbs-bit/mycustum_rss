package models

import (
	"time"
	"gorm.io/gorm"
)

type Feed struct {
	ID            uint           `gorm:"primaryKey"`
	Title         string
	URL           string         `gorm:"uniqueIndex"`
	Description   string
	SortOrder     int            `gorm:"default:0"`
	FetchInterval int            `gorm:"default:60"` // 0 means manual
	RetentionDays int            `gorm:"default:0"`  // 0 means infinite
	LastFetchedAt time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
}
