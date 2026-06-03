package rest

import (
	"net/http"
	"strconv"

	"github.com/easyssh/server/internal/domain/operationrecord"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OperationRecordHandler struct {
	service operationrecord.Service
}

func NewOperationRecordHandler(service operationrecord.Service) *OperationRecordHandler {
	return &OperationRecordHandler{service: service}
}

// List 查询当前用户操作记录
// GET /api/v1/operation-records?page=1&page_size=20&type=transfer
func (h *OperationRecordHandler) List(c *gin.Context) {
	currentUserID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	req, ok := parseOperationRecordListRequest(c)
	if !ok {
		return
	}
	applyOperationRecordUserScope(c, req, currentUserID)

	result, err := h.service.List(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "query_failed", err.Error())
		return
	}

	RespondSuccess(c, result)
}

// GetByID 获取当前用户操作记录详情
// GET /api/v1/operation-records/:id
func (h *OperationRecordHandler) GetByID(c *gin.Context) {
	currentUserID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_id", "Invalid record ID")
		return
	}

	record, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil || (!isAdminContext(c) && record.UserID != currentUserID) {
		RespondError(c, http.StatusNotFound, "record_not_found", "Operation record not found")
		return
	}

	RespondSuccess(c, record)
}

// GetStatistics 获取当前用户操作记录统计
// GET /api/v1/operation-records/statistics?days=30&type=connection
func (h *OperationRecordHandler) GetStatistics(c *gin.Context) {
	currentUserID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	req, ok := parseOperationRecordStatisticsRequest(c)
	if !ok {
		return
	}
	applyOperationRecordStatisticsUserScope(c, req, currentUserID)

	stats, err := h.service.GetStatistics(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

func parseOperationRecordListRequest(c *gin.Context) (*operationrecord.ListRequest, bool) {
	req := &operationrecord.ListRequest{}

	if userIDStr := c.Query("user_id"); userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user_id")
			return nil, false
		}
		req.UserID = &userID
	}
	if typ := c.Query("type"); typ != "" {
		req.Type = operationrecord.RecordType(typ)
	}
	if action := c.Query("action"); action != "" {
		req.Action = action
	}
	if status := c.Query("status"); status != "" {
		req.Status = operationrecord.Status(status)
	}
	if serverIDStr := c.Query("server_id"); serverIDStr != "" {
		serverID, err := uuid.Parse(serverIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server_id")
			return nil, false
		}
		req.ServerID = &serverID
	}

	if startTime, ok := parseQueryTime(c, "start_date", false); !ok {
		return nil, false
	} else {
		req.StartTime = startTime
	}
	if endTime, ok := parseQueryTime(c, "end_date", true); !ok {
		return nil, false
	} else {
		req.EndTime = endTime
	}

	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		req.Page = page
	}
	if pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
		req.PageSize = pageSize
	}

	return req, true
}

func parseOperationRecordStatisticsRequest(c *gin.Context) (*operationrecord.StatisticsRequest, bool) {
	req := &operationrecord.StatisticsRequest{}

	if userIDStr := c.Query("user_id"); userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_user_id", "Invalid user_id")
			return nil, false
		}
		req.UserID = &userID
	}
	if typ := c.Query("type"); typ != "" {
		req.Type = operationrecord.RecordType(typ)
	}
	if days, err := strconv.Atoi(c.DefaultQuery("days", "30")); err == nil {
		req.Days = days
	}
	if startTime, ok := parseQueryTime(c, "start_date", false); !ok {
		return nil, false
	} else {
		req.StartTime = startTime
	}
	if endTime, ok := parseQueryTime(c, "end_date", true); !ok {
		return nil, false
	} else {
		req.EndTime = endTime
	}

	return req, true
}

func applyOperationRecordUserScope(c *gin.Context, req *operationrecord.ListRequest, currentUserID uuid.UUID) {
	if isAdminContext(c) {
		return
	}
	req.UserID = &currentUserID
}

func applyOperationRecordStatisticsUserScope(c *gin.Context, req *operationrecord.StatisticsRequest, currentUserID uuid.UUID) {
	if isAdminContext(c) {
		return
	}
	req.UserID = &currentUserID
}

func isAdminContext(c *gin.Context) bool {
	role, exists := c.Get("role")
	return exists && role == "admin"
}
