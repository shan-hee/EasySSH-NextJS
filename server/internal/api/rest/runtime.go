package rest

import (
	"net/http"

	"github.com/easyssh/server/internal/platform"
	"github.com/gin-gonic/gin"
)

type RuntimeHandler struct {
	runtimeInfo platform.RuntimeInfo
}

func NewRuntimeHandler(runtimeInfo platform.RuntimeInfo) *RuntimeHandler {
	return &RuntimeHandler{runtimeInfo: runtimeInfo}
}

// GetRuntime 返回当前运行形态和能力声明。
// GET /api/v1/runtime
func (h *RuntimeHandler) GetRuntime(c *gin.Context) {
	c.JSON(http.StatusOK, h.runtimeInfo)
}
