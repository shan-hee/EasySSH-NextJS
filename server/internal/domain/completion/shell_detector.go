package completion

import (
	"bufio"
	"fmt"
	"log"
	"regexp"
	"strings"

	"golang.org/x/crypto/ssh"
)

// ShellType 表示Shell类型
type ShellType string

const (
	ShellBash ShellType = "bash"
	ShellZsh  ShellType = "zsh"
	ShellFish ShellType = "fish"
	ShellSh   ShellType = "sh"
)

// DetectShellType 检测Shell类型（使用SSH客户端）
func DetectShellType(client *ssh.Client) (ShellType, error) {
	// 创建临时会话用于检测
	session, err := client.NewSession()
	if err != nil {
		log.Printf("Failed to create session for shell detection: %v", err)
		return ShellBash, nil // 默认返回bash
	}
	defer session.Close()

	// 执行命令获取SHELL环境变量
	output, err := session.CombinedOutput("echo $SHELL")
	if err != nil {
		log.Printf("Failed to detect shell type: %v", err)
		return ShellBash, nil // 默认返回bash
	}

	shellPath := strings.TrimSpace(string(output))

	switch {
	case strings.HasSuffix(shellPath, "/zsh"):
		return ShellZsh, nil
	case strings.HasSuffix(shellPath, "/fish"):
		return ShellFish, nil
	case strings.HasSuffix(shellPath, "/bash"):
		return ShellBash, nil
	case strings.HasSuffix(shellPath, "/sh"):
		return ShellSh, nil
	default:
		return ShellBash, nil // 默认bash
	}
}

// HistoryParser 历史解析器接口
type HistoryParser interface {
	Parse(content string) []string
}

// BashHistoryParser Bash历史解析器
type BashHistoryParser struct{}

func (p *BashHistoryParser) Parse(content string) []string {
	var commands []string
	scanner := bufio.NewScanner(strings.NewReader(content))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			commands = append(commands, line)
		}
	}

	return commands
}

// ZshHistoryParser Zsh历史解析器
// Zsh历史格式: : 时间戳:持续时间;命令
type ZshHistoryParser struct{}

func (p *ZshHistoryParser) Parse(content string) []string {
	var commands []string
	scanner := bufio.NewScanner(strings.NewReader(content))

	// Zsh历史格式: : 1234567890:0;ls -la
	zshPattern := regexp.MustCompile(`^:\s*\d+:\d+;(.*)$`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// 尝试匹配zsh格式
		if matches := zshPattern.FindStringSubmatch(line); len(matches) > 1 {
			commands = append(commands, strings.TrimSpace(matches[1]))
		} else {
			// 如果不匹配zsh格式，直接添加（可能是多行命令的一部分）
			commands = append(commands, line)
		}
	}

	return commands
}

// FishHistoryParser Fish历史解析器
// Fish历史格式: YAML格式
type FishHistoryParser struct{}

func (p *FishHistoryParser) Parse(content string) []string {
	var commands []string
	scanner := bufio.NewScanner(strings.NewReader(content))

	// Fish历史格式:
	// - cmd: ls -la
	//   when: 1234567890
	cmdPattern := regexp.MustCompile(`^-\s+cmd:\s+(.*)$`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// 匹配cmd行
		if matches := cmdPattern.FindStringSubmatch(line); len(matches) > 1 {
			commands = append(commands, strings.TrimSpace(matches[1]))
		}
	}

	return commands
}

// GetHistoryParser 根据Shell类型获取解析器
func GetHistoryParser(shellType ShellType) HistoryParser {
	switch shellType {
	case ShellZsh:
		return &ZshHistoryParser{}
	case ShellFish:
		return &FishHistoryParser{}
	case ShellBash, ShellSh:
		fallthrough
	default:
		return &BashHistoryParser{}
	}
}

// GetHistoryFilePath 获取历史文件路径
func GetHistoryFilePath(shellType ShellType) string {
	switch shellType {
	case ShellZsh:
		return "~/.zsh_history"
	case ShellFish:
		return "~/.local/share/fish/fish_history"
	case ShellBash:
		return "~/.bash_history"
	case ShellSh:
		return "~/.sh_history"
	default:
		return "~/.bash_history"
	}
}

// FetchHistory 从SSH客户端获取历史命令
func FetchHistory(client *ssh.Client, shellType ShellType, limit int) ([]string, error) {
	historyFile := GetHistoryFilePath(shellType)

	// 创建会话用于获取历史
	session, err := client.NewSession()
	if err != nil {
		log.Printf("Failed to create session for fetching history: %v", err)
		return []string{}, nil
	}
	defer session.Close()

	// 构建命令：tail -n {limit} {historyFile}
	cmd := fmt.Sprintf("tail -n %d %s 2>/dev/null || echo ''", limit, historyFile)

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		log.Printf("Failed to fetch history: %v", err)
		return []string{}, nil // 返回空数组而不是错误
	}

	content := string(output)
	if content == "" || content == "\n" {
		return []string{}, nil
	}

	// 使用对应的解析器解析历史
	parser := GetHistoryParser(shellType)
	commands := parser.Parse(content)

	// 去重并反转（最新的在前）
	return deduplicateAndReverse(commands), nil
}

// deduplicateAndReverse 去重并反转数组
func deduplicateAndReverse(commands []string) []string {
	seen := make(map[string]bool)
	var result []string

	// 从后往前遍历（最新的命令）
	for i := len(commands) - 1; i >= 0; i-- {
		cmd := commands[i]
		if cmd == "" {
			continue
		}

		// 去重
		if !seen[cmd] {
			seen[cmd] = true
			result = append(result, cmd)
		}
	}

	return result
}
