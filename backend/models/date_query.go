package models

import "time"

type DateQuery struct {
	ID        uint   `gorm:"primaryKey"`
	Query     string `gorm:"uniqueIndex"`
	DateFrom  string
	DateTo    string
	Dates     string
	CreatedAt time.Time
}
