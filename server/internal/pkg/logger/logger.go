package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Level 日志级别
type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

func (l Level) String() string {
	switch l {
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// OutputFormat 输出格式
type OutputFormat int

const (
	FormatText OutputFormat = iota // 文本格式（兼容现有日志）
	FormatJSON                     // JSON 格式（结构化）
)

// Field 日志字段
type Field struct {
	Key   string
	Value interface{}
}

// String 创建字符串字段
func String(key, value string) Field {
	return Field{Key: key, Value: value}
}

// Int 创建整数字段
func Int(key string, value int) Field {
	return Field{Key: key, Value: value}
}

// Int64 创建 int64 字段
func Int64(key string, value int64) Field {
	return Field{Key: key, Value: value}
}

// Bool 创建布尔字段
func Bool(key string, value bool) Field {
	return Field{Key: key, Value: value}
}

// Duration 创建时间间隔字段
func Duration(key string, value time.Duration) Field {
	return Field{Key: key, Value: value.String()}
}

// Time 创建时间字段
func Time(key string, value time.Time) Field {
	return Field{Key: key, Value: value.Format(time.RFC3339)}
}

// Err 创建错误字段
func Err(err error) Field {
	if err == nil {
		return Field{Key: "error", Value: nil}
	}
	return Field{Key: "error", Value: err.Error()}
}

// Any 创建任意类型字段
func Any(key string, value interface{}) Field {
	return Field{Key: key, Value: value}
}

// Logger 结构化日志器
type Logger struct {
	mu       sync.Mutex
	out      io.Writer
	module   string
	level    Level
	format   OutputFormat
	fields   []Field // 预设字段
	withTime bool
}

// Config 日志器配置
type Config struct {
	Output   io.Writer
	Module   string
	Level    Level
	Format   OutputFormat
	WithTime bool
}

// DefaultConfig 默认配置
func DefaultConfig() Config {
	return Config{
		Output:   os.Stdout,
		Module:   "",
		Level:    LevelInfo,
		Format:   FormatText,
		WithTime: true,
	}
}

// New 创建日志器
func New(cfg Config) *Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}
	return &Logger{
		out:      cfg.Output,
		module:   cfg.Module,
		level:    cfg.Level,
		format:   cfg.Format,
		withTime: cfg.WithTime,
	}
}

// NewModule 创建带模块名的日志器（便捷方法）
func NewModule(module string) *Logger {
	return New(Config{
		Output:   os.Stdout,
		Module:   module,
		Level:    LevelInfo,
		Format:   FormatText,
		WithTime: true,
	})
}

// With 创建带预设字段的子日志器
func (l *Logger) With(fields ...Field) *Logger {
	newLogger := &Logger{
		out:      l.out,
		module:   l.module,
		level:    l.level,
		format:   l.format,
		withTime: l.withTime,
		fields:   make([]Field, len(l.fields)+len(fields)),
	}
	copy(newLogger.fields, l.fields)
	copy(newLogger.fields[len(l.fields):], fields)
	return newLogger
}

// SetLevel 设置日志级别
func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// SetFormat 设置输出格式
func (l *Logger) SetFormat(format OutputFormat) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.format = format
}

// Debug 输出调试日志
func (l *Logger) Debug(msg string, fields ...Field) {
	l.log(LevelDebug, msg, fields...)
}

// Info 输出信息日志
func (l *Logger) Info(msg string, fields ...Field) {
	l.log(LevelInfo, msg, fields...)
}

// Warn 输出警告日志
func (l *Logger) Warn(msg string, fields ...Field) {
	l.log(LevelWarn, msg, fields...)
}

// Error 输出错误日志
func (l *Logger) Error(msg string, fields ...Field) {
	l.log(LevelError, msg, fields...)
}

func (l *Logger) log(level Level, msg string, fields ...Field) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// 合并预设字段和临时字段
	allFields := make([]Field, 0, len(l.fields)+len(fields))
	allFields = append(allFields, l.fields...)
	allFields = append(allFields, fields...)

	if l.format == FormatJSON {
		l.outputJSON(level, msg, allFields)
	} else {
		l.outputText(level, msg, allFields)
	}
}

func (l *Logger) outputJSON(level Level, msg string, fields []Field) {
	record := make(map[string]interface{})
	if l.withTime {
		record["time"] = time.Now().Format(time.RFC3339)
	}
	record["level"] = level.String()
	if l.module != "" {
		record["module"] = l.module
	}
	record["msg"] = msg

	for _, f := range fields {
		if f.Value != nil {
			record[f.Key] = f.Value
		}
	}

	data, err := json.Marshal(record)
	if err != nil {
		// 降级到文本输出
		l.outputText(level, msg, fields)
		return
	}

	fmt.Fprintln(l.out, string(data))
}

func (l *Logger) outputText(level Level, msg string, fields []Field) {
	var sb strings.Builder

	// 时间戳
	if l.withTime {
		sb.WriteString(time.Now().Format("2006/01/02 15:04:05"))
		sb.WriteString(" ")
	}

	// 模块名（方括号格式，兼容现有日志风格）
	if l.module != "" {
		sb.WriteString("[")
		sb.WriteString(l.module)
		sb.WriteString("] ")
	}

	// 日志级别
	sb.WriteString(level.String())
	sb.WriteString(": ")

	// 消息
	sb.WriteString(msg)

	// 字段（key=value 格式）
	for _, f := range fields {
		if f.Value == nil {
			continue
		}
		sb.WriteString(", ")
		sb.WriteString(f.Key)
		sb.WriteString("=")
		sb.WriteString(formatValue(f.Value))
	}

	fmt.Fprintln(l.out, sb.String())
}

func formatValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case error:
		return val.Error()
	default:
		return fmt.Sprintf("%v", val)
	}
}

// 全局默认日志器
var defaultLogger = New(DefaultConfig())

// SetDefault 设置全局默认日志器
func SetDefault(l *Logger) {
	defaultLogger = l
}

// Default 获取全局默认日志器
func Default() *Logger {
	return defaultLogger
}

// 全局便捷方法
func Debug(msg string, fields ...Field) { defaultLogger.Debug(msg, fields...) }
func Info(msg string, fields ...Field)  { defaultLogger.Info(msg, fields...) }
func Warn(msg string, fields ...Field)  { defaultLogger.Warn(msg, fields...) }
func Error(msg string, fields ...Field) { defaultLogger.Error(msg, fields...) }

// Caller 获取调用者信息
func Caller(skip int) Field {
	_, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return String("caller", "unknown")
	}
	// 只保留文件名
	if idx := strings.LastIndex(file, "/"); idx >= 0 {
		file = file[idx+1:]
	}
	return String("caller", fmt.Sprintf("%s:%d", file, line))
}
