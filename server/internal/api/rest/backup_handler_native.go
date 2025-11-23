package rest

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ExportDatabaseNative 使用纯 Go 实现的数据库导出（不依赖 pg_dump）
func (h *BackupHandler) ExportDatabaseNative() (string, error) {
	var buffer bytes.Buffer

	// 写入 SQL 文件头部
	buffer.WriteString("-- EasySSH Database Backup\n")
	buffer.WriteString(fmt.Sprintf("-- Generated at: %s\n", time.Now().Format(time.RFC3339)))
	buffer.WriteString("-- PostgreSQL Database Dump\n\n")
	buffer.WriteString("SET statement_timeout = 0;\n")
	buffer.WriteString("SET lock_timeout = 0;\n")
	buffer.WriteString("SET client_encoding = 'UTF8';\n")
	buffer.WriteString("SET standard_conforming_strings = on;\n")
	buffer.WriteString("SET check_function_bodies = false;\n")
	buffer.WriteString("SET xmloption = content;\n")
	buffer.WriteString("SET client_min_messages = warning;\n\n")

	// 获取所有表名
	tables, err := h.getAllTables()
	if err != nil {
		return "", fmt.Errorf("failed to get tables: %w", err)
	}

	// 导出每个表
	for _, table := range tables {
		// 获取表结构
		createSQL, err := h.getTableSchema(table)
		if err != nil {
			return "", fmt.Errorf("failed to get schema for table %s: %w", table, err)
		}
		buffer.WriteString(fmt.Sprintf("\n-- Table: %s\n", table))
		buffer.WriteString(fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE;\n", quoteIdentifier(table)))
		buffer.WriteString(createSQL)
		buffer.WriteString("\n\n")

		// 导出表数据
		dataSQL, err := h.getTableData(table)
		if err != nil {
			return "", fmt.Errorf("failed to get data for table %s: %w", table, err)
		}
		if dataSQL != "" {
			buffer.WriteString(fmt.Sprintf("-- Data for table: %s\n", table))
			buffer.WriteString(dataSQL)
			buffer.WriteString("\n\n")
		}
	}

	// 写入序列重置语句
	buffer.WriteString("\n-- Reset sequences\n")
	sequences, err := h.getAllSequences()
	if err == nil {
		for _, seq := range sequences {
			buffer.WriteString(fmt.Sprintf("SELECT setval('%s', (SELECT COALESCE(MAX(id), 1) FROM %s), true);\n",
				seq.Name, quoteIdentifier(seq.Table)))
		}
	}

	return buffer.String(), nil
}

// getAllTables 获取所有用户表
func (h *BackupHandler) getAllTables() ([]string, error) {
	var tables []string
	query := `
		SELECT tablename
		FROM pg_tables
		WHERE schemaname = 'public'
		ORDER BY tablename
	`
	err := h.db.Raw(query).Scan(&tables).Error
	return tables, err
}

// getTableSchema 获取表的 CREATE TABLE 语句
func (h *BackupHandler) getTableSchema(tableName string) (string, error) {
	// 获取列信息
	type Column struct {
		ColumnName    string
		DataType      string
		IsNullable    string
		ColumnDefault *string
	}

	var columns []Column
	query := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position
	`
	if err := h.db.Raw(query, tableName).Scan(&columns).Error; err != nil {
		return "", err
	}

	var buffer bytes.Buffer
	buffer.WriteString(fmt.Sprintf("CREATE TABLE %s (\n", quoteIdentifier(tableName)))

	for i, col := range columns {
		if i > 0 {
			buffer.WriteString(",\n")
		}
		buffer.WriteString(fmt.Sprintf("    %s %s", quoteIdentifier(col.ColumnName), col.DataType))

		if col.IsNullable == "NO" {
			buffer.WriteString(" NOT NULL")
		}

		if col.ColumnDefault != nil {
			buffer.WriteString(fmt.Sprintf(" DEFAULT %s", *col.ColumnDefault))
		}
	}

	// 获取主键
	var pkColumns []string
	pkQuery := `
		SELECT a.attname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE i.indrelid = $1::regclass AND i.indisprimary
	`
	if err := h.db.Raw(pkQuery, tableName).Scan(&pkColumns).Error; err == nil && len(pkColumns) > 0 {
		buffer.WriteString(",\n")
		// 转义主键列名
		quotedPKColumns := make([]string, len(pkColumns))
		for i, col := range pkColumns {
			quotedPKColumns[i] = quoteIdentifier(col)
		}
		buffer.WriteString(fmt.Sprintf("    PRIMARY KEY (%s)", strings.Join(quotedPKColumns, ", ")))
	}

	buffer.WriteString("\n);\n")
	return buffer.String(), nil
}

// getTableData 获取表数据的 INSERT 语句
func (h *BackupHandler) getTableData(tableName string) (string, error) {
	// 获取列名
	var columns []string
	colQuery := `
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position
	`
	if err := h.db.Raw(colQuery, tableName).Scan(&columns).Error; err != nil {
		return "", err
	}

	if len(columns) == 0 {
		return "", nil
	}

	// 获取数据
	var rows []map[string]interface{}
	if err := h.db.Table(tableName).Find(&rows).Error; err != nil {
		return "", err
	}

	if len(rows) == 0 {
		return "", nil
	}

	var buffer bytes.Buffer
	// 转义列名
	quotedColumns := make([]string, len(columns))
	for i, col := range columns {
		quotedColumns[i] = quoteIdentifier(col)
	}
	columnList := strings.Join(quotedColumns, ", ")

	// 批量插入（每100行一个语句）
	batchSize := 100
	for i := 0; i < len(rows); i += batchSize {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}

		buffer.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES\n", quoteIdentifier(tableName), columnList))

		for j, row := range rows[i:end] {
			if j > 0 {
				buffer.WriteString(",\n")
			}
			buffer.WriteString("    (")

			for k, col := range columns {
				if k > 0 {
					buffer.WriteString(", ")
				}
				value := row[col]
				buffer.WriteString(formatValue(value))
			}

			buffer.WriteString(")")
		}

		buffer.WriteString(";\n")
	}

	return buffer.String(), nil
}

// quoteIdentifier 转义 SQL 标识符（表名、列名等）
// PostgreSQL 使用双引号包裹标识符，并将内部的双引号转义为 ""
func quoteIdentifier(name string) string {
	// 转义双引号
	escaped := strings.ReplaceAll(name, `"`, `""`)
	return fmt.Sprintf(`"%s"`, escaped)
}

// formatValue 格式化 SQL 值
func formatValue(value interface{}) string {
	if value == nil {
		return "NULL"
	}

	switch v := value.(type) {
	case string:
		// 转义单引号
		escaped := strings.ReplaceAll(v, "'", "''")
		return fmt.Sprintf("'%s'", escaped)
	case []byte:
		escaped := strings.ReplaceAll(string(v), "'", "''")
		return fmt.Sprintf("'%s'", escaped)
	case time.Time:
		return fmt.Sprintf("'%s'", v.Format(time.RFC3339))
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// getAllSequences 获取所有序列
func (h *BackupHandler) getAllSequences() ([]struct {
	Name  string
	Table string
}, error) {
	var sequences []struct {
		Name  string
		Table string
	}

	query := `
		SELECT
			s.relname as name,
			t.relname as table
		FROM pg_class s
		JOIN pg_depend d ON d.objid = s.oid
		JOIN pg_class t ON d.refobjid = t.oid
		WHERE s.relkind = 'S' AND t.relkind = 'r'
	`

	err := h.db.Raw(query).Scan(&sequences).Error
	return sequences, err
}

// ImportDatabaseNative 使用纯 Go 实现的数据库导入（不依赖 psql）
func (h *BackupHandler) ImportDatabaseNative(sqlContent string) error {
	// 在事务中执行 SQL
	return h.db.Transaction(func(tx *gorm.DB) error {
		// 分割 SQL 语句（简单实现，按分号分割）
		statements := splitSQLStatements(sqlContent)

		for i, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" || strings.HasPrefix(stmt, "--") {
				continue // 跳过空行和注释
			}

			// 执行 SQL 语句
			if err := tx.Exec(stmt).Error; err != nil {
				return fmt.Errorf("failed to execute statement %d: %w\nSQL: %s", i+1, err, stmt)
			}
		}

		return nil
	})
}

// splitSQLStatements 分割 SQL 语句
// 支持 PostgreSQL 的 '' 转义和 $$ 美元引号
func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	inString := false
	inDollarQuote := false
	inComment := false
	var stringChar rune
	var dollarTag string

	lines := strings.Split(sql, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// 跳过单行注释（只有在不在字符串内时）
		if !inString && !inDollarQuote && strings.HasPrefix(trimmed, "--") {
			continue
		}

		// 处理多行注释
		if !inString && !inDollarQuote {
			if strings.Contains(trimmed, "/*") {
				inComment = true
			}
			if inComment {
				if strings.Contains(trimmed, "*/") {
					inComment = false
				}
				continue
			}
		}

		// 逐字符处理
		runes := []rune(line)
		for i := 0; i < len(runes); i++ {
			char := runes[i]

			// 处理美元引号 $$tag$$
			if !inString && char == '$' {
				// 查找完整的美元标签
				tag := "$"
				j := i + 1
				for j < len(runes) && (runes[j] == '_' || (runes[j] >= 'a' && runes[j] <= 'z') || (runes[j] >= 'A' && runes[j] <= 'Z') || (runes[j] >= '0' && runes[j] <= '9')) {
					tag += string(runes[j])
					j++
				}
				if j < len(runes) && runes[j] == '$' {
					tag += "$"
					if inDollarQuote && tag == dollarTag {
						// 美元引号结束
						inDollarQuote = false
						dollarTag = ""
						current.WriteString(tag)
						i = j
						continue
					} else if !inDollarQuote {
						// 美元引号开始
						inDollarQuote = true
						dollarTag = tag
						current.WriteString(tag)
						i = j
						continue
					}
				}
			}

			// 在美元引号内，直接写入
			if inDollarQuote {
				current.WriteRune(char)
				continue
			}

			if !inString {
				// 检查字符串开始
				if char == '\'' || char == '"' {
					inString = true
					stringChar = char
					current.WriteRune(char)
				} else if char == ';' {
					// 语句结束
					stmt := strings.TrimSpace(current.String())
					if stmt != "" {
						statements = append(statements, stmt)
					}
					current.Reset()
				} else {
					current.WriteRune(char)
				}
			} else {
				// 在字符串内
				current.WriteRune(char)
				if char == stringChar {
					// PostgreSQL 使用 '' 转义单引号
					if i+1 < len(runes) && runes[i+1] == stringChar {
						// 这是转义的引号，继续
						current.WriteRune(runes[i+1])
						i++ // 跳过下一个字符
					} else {
						// 字符串结束
						inString = false
					}
				}
			}
		}

		// 保留换行符（对于多行语句）
		if current.Len() > 0 {
			current.WriteRune('\n')
		}
	}

	// 添加最后一个语句
	if current.Len() > 0 {
		stmt := strings.TrimSpace(current.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}

	return statements
}
