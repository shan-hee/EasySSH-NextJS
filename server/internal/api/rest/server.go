package rest

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/easyssh/server/internal/domain/server"
)

// ServerHandler 服务器处理器
type ServerHandler struct {
	serverService server.Service
}

// NewServerHandler 创建服务器处理器
func NewServerHandler(serverService server.Service) *ServerHandler {
	return &ServerHandler{
		serverService: serverService,
	}
}

// Create 创建服务器
// POST /api/v1/servers
func (h *ServerHandler) Create(c *gin.Context) {
	var req server.CreateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 创建服务器
	srv, err := h.serverService.Create(c.Request.Context(), userID, &req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "create_failed", err.Error())
		return
	}

	RespondCreated(c, srv.ToPublic())
}

// List 获取服务器列表
// GET /api/v1/servers
func (h *ServerHandler) List(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 获取分页参数
	limit, offset := GetPaginationParams(c)

	// 检查是否有搜索关键字
	query := c.Query("q")
	group := c.Query("group")

	var servers []*server.Server
	var total int64

	if query != "" {
		// 搜索模式
		servers, total, err = h.serverService.Search(c.Request.Context(), userID, query, limit, offset)
	} else if group != "" {
		// 按分组筛选
		servers, total, err = h.serverService.FindByGroup(c.Request.Context(), userID, group, limit, offset)
	} else {
		// 正常列表
		servers, total, err = h.serverService.List(c.Request.Context(), userID, limit, offset)
	}

	if err != nil {
		RespondError(c, http.StatusInternalServerError, "list_failed", err.Error())
		return
	}

	// 转换为公开信息
	publicServers := make([]interface{}, len(servers))
	for i, srv := range servers {
		publicServers[i] = srv.ToPublic()
	}

	// 计算分页信息
	page := (offset / limit) + 1
	RespondPaginated(c, publicServers, total, page, limit)
}

// GetByID 获取服务器详情
// GET /api/v1/servers/:id
func (h *ServerHandler) GetByID(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID format")
		return
	}

	// 获取服务器
	srv, err := h.serverService.GetByID(c.Request.Context(), userID, serverID)
	if err != nil {
		if errors.Is(err, server.ErrServerNotFound) {
			RespondError(c, http.StatusNotFound, "server_not_found", "Server not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "get_failed", err.Error())
		return
	}

	RespondSuccess(c, srv.ToPublic())
}

// Update 更新服务器
// PUT /api/v1/servers/:id
func (h *ServerHandler) Update(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID format")
		return
	}

	// 解析请求
	var req server.UpdateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 更新服务器
	srv, err := h.serverService.Update(c.Request.Context(), userID, serverID, &req)
	if err != nil {
		if errors.Is(err, server.ErrServerNotFound) {
			RespondError(c, http.StatusNotFound, "server_not_found", "Server not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "update_failed", err.Error())
		return
	}

	RespondSuccess(c, srv.ToPublic())
}

// Delete 删除服务器
// DELETE /api/v1/servers/:id
func (h *ServerHandler) Delete(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 解析服务器 ID
	serverID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID format")
		return
	}

	// 删除服务器
	if err := h.serverService.Delete(c.Request.Context(), userID, serverID); err != nil {
		if errors.Is(err, server.ErrServerNotFound) {
			RespondError(c, http.StatusNotFound, "server_not_found", "Server not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "delete_failed", err.Error())
		return
	}

	RespondNoContent(c)
}


// GetStatistics 获取服务器统计
// GET /api/v1/servers/statistics
func (h *ServerHandler) GetStatistics(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 获取统计
	stats, err := h.serverService.GetStatistics(c.Request.Context(), userID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "get_statistics_failed", err.Error())
		return
	}

	RespondSuccess(c, stats)
}

// Reorder 批量更新服务器排序顺序
// PATCH /api/v1/servers/reorder
func (h *ServerHandler) Reorder(c *gin.Context) {
	// 从上下文获取用户 ID
	userID, err := getUserIDFromContext(c)
	if err != nil {
		RespondError(c, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	// 解析请求：期望一个服务器 ID 数组
	var req struct {
		ServerIDs []string `json:"server_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// 转换字符串 ID 为 UUID
	serverIDs := make([]uuid.UUID, 0, len(req.ServerIDs))
	for _, idStr := range req.ServerIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid_server_id", "Invalid server ID format: "+idStr)
			return
		}
		serverIDs = append(serverIDs, id)
	}

	// 调用服务层更新排序
	if err := h.serverService.ReorderServers(c.Request.Context(), userID, serverIDs); err != nil {
		RespondError(c, http.StatusInternalServerError, "reorder_failed", err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "Servers reordered successfully"})
}

// getUserIDFromContext 从上下文获取用户 ID
func getUserIDFromContext(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user not authenticated")
	}

	userIDString, ok := userIDStr.(string)
	if !ok {
		return uuid.Nil, errors.New("invalid user ID format")
	}

	return uuid.Parse(userIDString)
}
