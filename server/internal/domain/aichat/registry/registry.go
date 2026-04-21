package registry

import (
	"context"
	"encoding/json"
	"slices"
	"sort"

	"github.com/google/uuid"
)

type ConfirmStrategy string

const (
	ConfirmNone ConfirmStrategy = "none"
	ConfirmUser ConfirmStrategy = "user"
)

type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type ExecutionResult struct {
	Content string `json:"content"`
	IsError bool   `json:"is_error,omitempty"`
}

type ToolExecutor func(ctx context.Context, userID uuid.UUID, args json.RawMessage) (ExecutionResult, error)

type ToolSpec struct {
	Name            string                 `json:"name"`
	DisplayName     string                 `json:"display_name,omitempty"`
	Description     string                 `json:"description"`
	Parameters      map[string]interface{} `json:"parameters"`
	Dangerous       bool                   `json:"dangerous"`
	ConfirmStrategy ConfirmStrategy        `json:"confirm_strategy"`
	SupportedModes  []string               `json:"supported_modes,omitempty"`
	Executor        ToolExecutor           `json:"-"`
}

type ToolRegistry struct {
	order []string
	tools map[string]ToolSpec
}

func NewToolRegistry(specs []ToolSpec) *ToolRegistry {
	registry := &ToolRegistry{
		order: make([]string, 0, len(specs)),
		tools: make(map[string]ToolSpec, len(specs)),
	}

	for _, spec := range specs {
		if spec.Name == "" {
			continue
		}
		registry.order = append(registry.order, spec.Name)
		registry.tools[spec.Name] = spec
	}

	return registry
}

func (r *ToolRegistry) Get(name string) (ToolSpec, bool) {
	if r == nil {
		return ToolSpec{}, false
	}
	spec, ok := r.tools[name]
	return spec, ok
}

func (r *ToolRegistry) All() []ToolSpec {
	if r == nil {
		return nil
	}

	result := make([]ToolSpec, 0, len(r.order))
	for _, name := range r.order {
		if spec, ok := r.tools[name]; ok {
			result = append(result, spec)
		}
	}
	return result
}

func (r *ToolRegistry) VisibleForMode(mode string) []ToolSpec {
	if r == nil {
		return nil
	}

	result := make([]ToolSpec, 0, len(r.order))
	for _, name := range r.order {
		spec, ok := r.tools[name]
		if !ok {
			continue
		}
		if spec.SupportsMode(mode) {
			result = append(result, spec)
		}
	}
	return result
}

func (r *ToolRegistry) PublicToolViews(mode string) []ToolSpec {
	visible := r.VisibleForMode(mode)
	sort.SliceStable(visible, func(i, j int) bool {
		return visible[i].Name < visible[j].Name
	})
	return visible
}

func (s ToolSpec) SupportsMode(mode string) bool {
	if len(s.SupportedModes) == 0 {
		return true
	}
	return slices.Contains(s.SupportedModes, mode)
}
