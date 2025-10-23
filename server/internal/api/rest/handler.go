package rest

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SuccessResponse 成功响应结构
type SuccessResponse struct {
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

// PaginatedResponse 分页响应结构
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

// RespondError 返回错误响应
func RespondError(c *gin.Context, statusCode int, errCode string, message string) {
	c.JSON(statusCode, ErrorResponse{
		Error:   errCode,
		Message: message,
	})
}

// RespondSuccess 返回成功响应
func RespondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, SuccessResponse{
		Data: data,
	})
}

// RespondSuccessWithMessage 返回带消息的成功响应
func RespondSuccessWithMessage(c *gin.Context, data interface{}, message string) {
	c.JSON(http.StatusOK, SuccessResponse{
		Data:    data,
		Message: message,
	})
}

// RespondCreated 返回创建成功响应
func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, SuccessResponse{
		Data: data,
	})
}

// RespondNoContent 返回无内容响应
func RespondNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// RespondPaginated 返回分页响应
func RespondPaginated(c *gin.Context, data interface{}, total int64, page, pageSize int) {
	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, PaginatedResponse{
		Data:       data,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	})
}

// GetPaginationParams 获取分页参数
func GetPaginationParams(c *gin.Context) (limit, offset int) {
	page := 1
	pageSize := 20

	// 从查询参数获取分页信息
	if p, ok := c.GetQuery("page"); ok && p != "" {
		if val, err := c.GetQuery("page"); err == false {
			if v := parseInt(val, 1); v > 0 {
				page = v
			}
		}
	}

	if ps, ok := c.GetQuery("page_size"); ok && ps != "" {
		if val, err := c.GetQuery("page_size"); err == false {
			if v := parseInt(val, 20); v > 0 && v <= 100 {
				pageSize = v
			}
		}
	}

	offset = (page - 1) * pageSize
	limit = pageSize

	return limit, offset
}

// parseInt 解析整数
func parseInt(s string, defaultVal int) int {
	var val int
	if _, err := fmt.Sscanf(s, "%d", &val); err != nil {
		return defaultVal
	}
	return val
}
