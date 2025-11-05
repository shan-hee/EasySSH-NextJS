package rest

import (
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// AvatarHandler 头像处理器
type AvatarHandler struct{}

// NewAvatarHandler 创建头像处理器
func NewAvatarHandler() *AvatarHandler {
	return &AvatarHandler{}
}

// GenerateAvatarRequest 生成头像请求
type GenerateAvatarRequest struct {
	Seed string `json:"seed"` // 种子值，用于生成一致的头像
}

// GenerateAvatarResponse 生成头像响应
type GenerateAvatarResponse struct {
	Avatar string `json:"avatar"` // base64编码的SVG头像数据URL
}

// GenerateAvatar 生成头像
// POST /api/v1/avatar/generate
func (h *AvatarHandler) GenerateAvatar(c *gin.Context) {
	var req GenerateAvatarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 如果没有提供种子，生成随机种子
	seed := req.Seed
	if seed == "" {
		seed = generateRandomSeed()
	}

	// 生成DiceBear头像
	avatar, err := h.generateDiceBearAvatar(seed)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "generation_failed", err.Error())
		return
	}

	// 返回生成的头像
	RespondSuccess(c, GenerateAvatarResponse{
		Avatar: avatar,
	})
}

// generateDiceBearAvatar 生成DiceBear头像
func (h *AvatarHandler) generateDiceBearAvatar(seed string) (string, error) {
	// DiceBear API URL - 使用notionists-neutral风格
	dicebearUrl := fmt.Sprintf("https://api.dicebear.com/7.x/notionists-neutral/svg?seed=%s", seed)

	// 发起HTTP请求获取SVG
	resp, err := http.Get(dicebearUrl)
	if err != nil {
		return "", fmt.Errorf("failed to fetch avatar from DiceBear API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("DiceBear API returned status %d", resp.StatusCode)
	}

	// 读取SVG内容
	svgBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read SVG content: %w", err)
	}

	svgText := string(svgBytes)

	// 简单的base64编码（Go的base64编码）
	// 注意：这里我们直接返回SVG内容，让前端处理base64编码
	// 因为Go的base64编码与JavaScript的btoa可能不完全一致
	return fmt.Sprintf("data:image/svg+xml,%s", urlEncodedSVG(svgText)), nil
}

// generateRandomSeed 生成随机种子
func generateRandomSeed() string {
	// 简单的随机种子生成
	// 在实际应用中，可以使用crypto/rand
	return fmt.Sprintf("%d", md5.Sum([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))
}

// urlEncodedSVG 对SVG内容进行URL编码
func urlEncodedSVG(svg string) string {
	// 简单的URL编码，处理特殊字符
	svg = strings.ReplaceAll(svg, "<", "%3C")
	svg = strings.ReplaceAll(svg, ">", "%3E")
	svg = strings.ReplaceAll(svg, "#", "%23")
	svg = strings.ReplaceAll(svg, " ", "%20")
	svg = strings.ReplaceAll(svg, "\"", "%22")
	svg = strings.ReplaceAll(svg, "'", "%27")
	svg = strings.ReplaceAll(svg, "\n", "")
	svg = strings.ReplaceAll(svg, "\r", "")
	svg = strings.ReplaceAll(svg, "\t", "")
	return svg
}