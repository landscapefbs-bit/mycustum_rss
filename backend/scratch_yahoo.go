package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	resp, _ := http.Get("https://news.yahoo.co.jp/rss/topics/it.xml")
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println(string(body[:1000]))
}
