package rest

import (
	"net/http"
	"time"

	"github.com/easyssh/server/internal/domain/auth"
	userdomain "github.com/easyssh/server/internal/domain/user"
	"github.com/easyssh/server/internal/pkg/password"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserHandler 用户管理处理器
type UserHandler struct {
	userService        userdomain.Service
	accountLockService auth.AccountLockService
}

// NewUserHandler 创建用户管理处理器
func NewUserHandler(userService userdomain.Service, accountLockService auth.AccountLockService) *UserHandler {
	return &UserHandler{
		userService:        userService,
		accountLockService: accountLockService,
	}
}

// ListUsersRequest 用户列表请求
type ListUsersRequest struct {
	Page  int    `form:"page"`
	Limit int    `form:"limit"`
	Role  string `form:"role"` // all, admin, user, viewer
}

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Username string        `json:"username" binding:"required,min=3,max=50"`
	Email    string        `json:"email" binding:"required,email"`
	Password string        `json:"password" binding:"required,min=6"`
	Role     auth.UserRole `json:"role" binding:"required,oneof=admin user viewer"`
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	Username string        `json:"username" binding:"omitempty,min=3,max=50"`
	Email    string        `json:"email" binding:"omitempty,email"`
	Role     auth.UserRole `json:"role" binding:"omitempty,oneof=admin user viewer"`
	Avatar   string        `json:"avatar"`
}

// ChangeUserPasswordRequest 修改用户密码请求（管理员用）
type ChangeUserPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// LockUserRequest 锁定用户请求
type LockUserRequest struct {
	Reason          string `json:"reason"`                                    // 锁定原因
	DurationMinutes int    `json:"duration_minutes" binding:"required,min=1"` // 锁定时长（分钟）
}

// ListUsers 获取用户列表
// GET /api/v1/users
func (h *UserHandler) ListUsers(c *gin.Context) {
	var req ListUsersRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// 设置默认值
	if req.Page == 0 {
		req.Page = 1
	}
	if req.Limit == 0 {
		req.Limit = 20
	}

	users, total, err := h.userService.ListUsers(c.Request.Context(), req.Page, req.Limit, req.Role)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	totalPages := int(total) / req.Limit
	if int(total)%req.Limit > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        users,
		"total":       total,
		"page":        req.Page,
		"page_size":   req.Limit,
		"total_pages": totalPages,
	})
}

// GetUser 获取用户详情
// GET /api/v1/users/:id
func (h *UserHandler) GetUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	user, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": user,
	})
}

// CreateUser 创建用户
// POST /api/v1/users
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// 验证密码强度
	if err := password.ValidateWithDefault(req.Password); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "PASSWORD_POLICY_ERROR", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid password")
		return
	}

	user, err := h.userService.CreateUser(c.Request.Context(), req.Username, req.Email, req.Password, req.Role)
	if err != nil {
		if err == userdomain.ErrUserAlreadyExists {
			RespondError(c, http.StatusConflict, "USER_EXISTS", err.Error())
			return
		}
		if err == userdomain.ErrInvalidInput {
			RespondError(c, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":    user,
		"message": "User created successfully",
	})
}

// UpdateUser 更新用户
// PUT /api/v1/users/:id
func (h *UserHandler) UpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	user, err := h.userService.UpdateUser(c.Request.Context(), id, req.Username, req.Email, req.Role, req.Avatar)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		if err == userdomain.ErrUserAlreadyExists {
			RespondError(c, http.StatusConflict, "USER_EXISTS", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    user,
		"message": "User updated successfully",
	})
}

// DeleteUser 删除用户
// DELETE /api/v1/users/:id
func (h *UserHandler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	// 获取当前用户ID
	currentUserID, exists := c.Get("user_id")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	// user_id 在认证中间件中被设置为字符串类型
	currentIDStr, ok := currentUserID.(string)
	if !ok {
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Invalid user ID type")
		return
	}

	currentID, err := uuid.Parse(currentIDStr)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Invalid user ID format")
		return
	}

	err = h.userService.DeleteUser(c.Request.Context(), id, currentID)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		if err == userdomain.ErrCannotDeleteSelf {
			RespondError(c, http.StatusForbidden, "CANNOT_DELETE_SELF", "Cannot delete yourself")
			return
		}
		if err == userdomain.ErrCannotDeleteAdmin {
			RespondError(c, http.StatusForbidden, "CANNOT_DELETE_ADMIN", "Cannot delete the last admin")
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// ChangePassword 修改密码
// POST /api/v1/users/:id/password
func (h *UserHandler) ChangePassword(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	var req ChangeUserPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// 验证密码强度
	if err := password.ValidateWithDefault(req.NewPassword); err != nil {
		if password.IsValidationError(err) {
			RespondError(c, http.StatusBadRequest, "PASSWORD_POLICY_ERROR", err.Error())
			return
		}
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid password")
		return
	}

	err = h.userService.ChangePassword(c.Request.Context(), id, req.NewPassword)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		if err == userdomain.ErrInvalidInput {
			RespondError(c, http.StatusBadRequest, "INVALID_INPUT", err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password changed successfully",
	})
}

// GetStatistics 获取用户统计信息
// GET /api/v1/users/statistics
func (h *UserHandler) GetStatistics(c *gin.Context) {
	stats, err := h.userService.GetStatistics(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": stats,
	})
}

// LockUser 锁定用户账户
// POST /api/v1/users/:id/lock
func (h *UserHandler) LockUser(c *gin.Context) {
	// 检查是否有账户锁定服务
	if h.accountLockService == nil {
		RespondError(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Account lock service not available")
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	var req LockUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// 获取当前用户ID，不能锁定自己
	currentUserID, exists := c.Get("user_id")
	if exists {
		currentIDStr, ok := currentUserID.(string)
		if ok {
			currentID, err := uuid.Parse(currentIDStr)
			if err == nil && currentID == id {
				RespondError(c, http.StatusForbidden, "CANNOT_LOCK_SELF", "Cannot lock your own account")
				return
			}
		}
	}

	// 获取用户信息（主要是获取邮箱）
	user, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	// 设置锁定原因
	reason := req.Reason
	if reason == "" {
		reason = "管理员手动锁定"
	}

	// 锁定账户
	duration := time.Duration(req.DurationMinutes) * time.Minute
	if err := h.accountLockService.LockAccount(c.Request.Context(), user.Email, reason, duration); err != nil {
		RespondError(c, http.StatusInternalServerError, "LOCK_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User account locked successfully",
	})
}

// UnlockUser 解锁用户账户
// POST /api/v1/users/:id/unlock
func (h *UserHandler) UnlockUser(c *gin.Context) {
	// 检查是否有账户锁定服务
	if h.accountLockService == nil {
		RespondError(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Account lock service not available")
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "INVALID_ID", "Invalid user ID format")
		return
	}

	// 获取用户信息（主要是获取邮箱）
	user, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		if err == userdomain.ErrUserNotFound {
			RespondError(c, http.StatusNotFound, "USER_NOT_FOUND", "User not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	// 解锁账户
	if err := h.accountLockService.UnlockAccount(c.Request.Context(), user.Email); err != nil {
		RespondError(c, http.StatusInternalServerError, "UNLOCK_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User account unlocked successfully",
	})
}

// RegisterUserRoutes 注册用户管理路由
func RegisterUserRoutes(r *gin.RouterGroup, userService userdomain.Service, accountLockService auth.AccountLockService, authMiddleware gin.HandlerFunc) {
	handler := NewUserHandler(userService, accountLockService)

	users := r.Group("/users")
	users.Use(authMiddleware) // 所有用户管理接口都需要认证
	{
		users.GET("", handler.ListUsers)                     // 获取用户列表
		users.GET("/statistics", handler.GetStatistics)      // 获取统计信息
		users.GET("/:id", handler.GetUser)                   // 获取用户详情
		users.POST("", handler.CreateUser)                   // 创建用户
		users.PUT("/:id", handler.UpdateUser)                // 更新用户
		users.DELETE("/:id", handler.DeleteUser)             // 删除用户
		users.POST("/:id/password", handler.ChangePassword)  // 修改密码
		users.POST("/:id/unlock", handler.UnlockUser)        // 解锁账户
	}
}
