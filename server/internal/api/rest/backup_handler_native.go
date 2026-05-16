package rest

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ExportDatabaseNative 使用当前 GORM 连接导出可执行 SQL，不依赖外部客户端工具。
func (h *BackupHandler) ExportDatabaseNative() (string, error) {
	var buffer bytes.Buffer

	driver := h.db.Dialector.Name()
	buffer.WriteString("-- EasySSH Database Backup\n")
	buffer.WriteString(fmt.Sprintf("-- Generated at: %s\n", time.Now().Format(time.RFC3339)))
	buffer.WriteString(fmt.Sprintf("-- Database Driver: %s\n\n", driver))

	tables, err := h.getAllTables()
	if err != nil {
		return "", fmt.Errorf("failed to get tables: %w", err)
	}
	tables, err = h.sortTablesByDependencies(tables)
	if err != nil {
		return "", fmt.Errorf("failed to sort tables: %w", err)
	}

	buffer.WriteString("-- Clear existing data\n")
	for i := len(tables) - 1; i >= 0; i-- {
		buffer.WriteString(fmt.Sprintf("DELETE FROM %s;\n", quoteIdentifier(driver, tables[i])))
	}

	for _, table := range tables {
		columns, err := h.getTableColumns(table)
		if err != nil {
			return "", fmt.Errorf("failed to get columns for table %s: %w", table, err)
		}
		if len(columns) == 0 {
			continue
		}

		buffer.WriteString(fmt.Sprintf("\n-- Data for table: %s\n", table))

		dataSQL, err := h.getTableData(table, columns)
		if err != nil {
			return "", fmt.Errorf("failed to get data for table %s: %w", table, err)
		}
		if dataSQL != "" {
			buffer.WriteString(dataSQL)
			buffer.WriteString("\n")
		}
	}

	return buffer.String(), nil
}

func (h *BackupHandler) getAllTables() ([]string, error) {
	driver := h.db.Dialector.Name()
	var tables []string

	switch driver {
	case "sqlite":
		err := h.db.Raw(`
			SELECT name
			FROM sqlite_master
			WHERE type = 'table'
			  AND name NOT LIKE 'sqlite_%'
			ORDER BY name
		`).Scan(&tables).Error
		return tables, err
	case "postgres":
		err := h.db.Raw(`
			SELECT tablename
			FROM pg_tables
			WHERE schemaname = 'public'
			ORDER BY tablename
		`).Scan(&tables).Error
		return tables, err
	case "mysql":
		err := h.db.Raw(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = DATABASE()
			  AND table_type = 'BASE TABLE'
			ORDER BY table_name
		`).Scan(&tables).Error
		return tables, err
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}
}

type tableDependency struct {
	ChildTable  string `gorm:"column:child_table"`
	ParentTable string `gorm:"column:parent_table"`
}

func (h *BackupHandler) sortTablesByDependencies(tables []string) ([]string, error) {
	if len(tables) <= 1 {
		return tables, nil
	}

	dependencies, err := h.getTableDependencies()
	if err != nil {
		return nil, err
	}

	tableSet := make(map[string]bool, len(tables))
	for _, table := range tables {
		tableSet[table] = true
	}

	for table, refs := range dependencies {
		if !tableSet[table] {
			delete(dependencies, table)
			continue
		}
		for ref := range refs {
			if !tableSet[ref] {
				delete(refs, ref)
			}
		}
	}

	sorted := make([]string, 0, len(tables))
	state := make(map[string]int, len(tables))

	var visit func(string) bool
	visit = func(table string) bool {
		switch state[table] {
		case 1:
			return false
		case 2:
			return true
		}
		state[table] = 1

		refs := make([]string, 0, len(dependencies[table]))
		for ref := range dependencies[table] {
			refs = append(refs, ref)
		}
		sort.Strings(refs)
		for _, ref := range refs {
			visit(ref)
		}

		state[table] = 2
		sorted = append(sorted, table)
		return true
	}

	ordered := append([]string(nil), tables...)
	sort.Strings(ordered)
	for _, table := range ordered {
		visit(table)
	}

	if len(sorted) != len(tables) {
		return tables, nil
	}
	return sorted, nil
}

func (h *BackupHandler) getTableDependencies() (map[string]map[string]bool, error) {
	driver := h.db.Dialector.Name()
	dependencies := make(map[string]map[string]bool)

	add := func(table, referencedTable string) {
		table = strings.TrimSpace(table)
		referencedTable = strings.TrimSpace(referencedTable)
		if table == "" || referencedTable == "" || table == referencedTable {
			return
		}
		if dependencies[table] == nil {
			dependencies[table] = make(map[string]bool)
		}
		dependencies[table][referencedTable] = true
	}

	switch driver {
	case "sqlite":
		tables, err := h.getAllTables()
		if err != nil {
			return nil, err
		}
		for _, table := range tables {
			var rows []struct {
				ReferencedTable string `gorm:"column:table"`
			}
			if err := h.db.Raw(fmt.Sprintf("PRAGMA foreign_key_list(%s)", quoteIdentifier(driver, table))).Scan(&rows).Error; err != nil {
				return nil, err
			}
			for _, row := range rows {
				add(table, row.ReferencedTable)
			}
		}
	case "postgres":
		var rows []tableDependency
		if err := h.db.Raw(`
			SELECT
				tc.table_name AS child_table,
				ccu.table_name AS parent_table
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage AS ccu
				ON ccu.constraint_name = tc.constraint_name
				AND ccu.table_schema = tc.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
			  AND tc.table_schema = 'public'
		`).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			add(row.ChildTable, row.ParentTable)
		}
	case "mysql":
		var rows []tableDependency
		if err := h.db.Raw(`
			SELECT
				table_name AS child_table,
				referenced_table_name AS parent_table
			FROM information_schema.key_column_usage
			WHERE table_schema = DATABASE()
			  AND referenced_table_name IS NOT NULL
		`).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			add(row.ChildTable, row.ParentTable)
		}
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}

	return dependencies, nil
}

func (h *BackupHandler) getTableColumns(tableName string) ([]string, error) {
	driver := h.db.Dialector.Name()
	var columns []string

	switch driver {
	case "sqlite":
		var rows []struct {
			Name string `gorm:"column:name"`
		}
		if err := h.db.Raw(fmt.Sprintf("PRAGMA table_info(%s)", quoteIdentifier(driver, tableName))).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			columns = append(columns, row.Name)
		}
	case "postgres":
		if err := h.db.Raw(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = ?
			ORDER BY ordinal_position
		`, tableName).Scan(&columns).Error; err != nil {
			return nil, err
		}
	case "mysql":
		if err := h.db.Raw(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = ?
			ORDER BY ordinal_position
		`, tableName).Scan(&columns).Error; err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}

	return columns, nil
}

func (h *BackupHandler) getTableData(tableName string, columns []string) (string, error) {
	var rows []map[string]interface{}
	if err := h.db.Table(tableName).Find(&rows).Error; err != nil {
		return "", err
	}
	if len(rows) == 0 {
		return "", nil
	}

	driver := h.db.Dialector.Name()
	var buffer bytes.Buffer

	quotedColumns := make([]string, len(columns))
	for i, col := range columns {
		quotedColumns[i] = quoteIdentifier(driver, col)
	}
	columnList := strings.Join(quotedColumns, ", ")

	batchSize := 100
	for i := 0; i < len(rows); i += batchSize {
		end := i + batchSize
		if end > len(rows) {
			end = len(rows)
		}

		buffer.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES\n", quoteIdentifier(driver, tableName), columnList))
		for j, row := range rows[i:end] {
			if j > 0 {
				buffer.WriteString(",\n")
			}
			buffer.WriteString("    (")
			for k, col := range columns {
				if k > 0 {
					buffer.WriteString(", ")
				}
				buffer.WriteString(formatValue(driver, row[col]))
			}
			buffer.WriteString(")")
		}
		buffer.WriteString(";\n")
	}

	return buffer.String(), nil
}

func quoteIdentifier(driver, name string) string {
	quote := `"`
	if driver == "mysql" {
		quote = "`"
	}
	escaped := strings.ReplaceAll(name, quote, quote+quote)
	return quote + escaped + quote
}

func formatValue(driver string, value interface{}) string {
	if value == nil {
		return "NULL"
	}

	switch v := value.(type) {
	case string:
		return "'" + strings.ReplaceAll(v, "'", "''") + "'"
	case []byte:
		return "'" + strings.ReplaceAll(string(v), "'", "''") + "'"
	case time.Time:
		return "'" + v.Format(time.RFC3339Nano) + "'"
	case bool:
		if driver == "postgres" {
			if v {
				return "true"
			}
			return "false"
		}
		if v {
			return "1"
		}
		return "0"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// ImportDatabaseNative 使用纯 Go 实现的数据库导入。
func (h *BackupHandler) ImportDatabaseNative(sqlContent string) error {
	return h.db.Transaction(func(tx *gorm.DB) error {
		statements := splitSQLStatements(sqlContent)
		for i, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" || strings.HasPrefix(stmt, "--") {
				continue
			}
			if err := tx.Exec(stmt).Error; err != nil {
				return fmt.Errorf("failed to execute statement %d: %w\nSQL: %s", i+1, err, stmt)
			}
		}
		return nil
	})
}

func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	inString := false
	inLineComment := false
	inBlockComment := false
	var stringChar rune

	runes := []rune(sql)
	for i := 0; i < len(runes); i++ {
		char := runes[i]
		next := rune(0)
		if i+1 < len(runes) {
			next = runes[i+1]
		}

		if inLineComment {
			if char == '\n' {
				inLineComment = false
			}
			continue
		}
		if inBlockComment {
			if char == '*' && next == '/' {
				i++
				inBlockComment = false
			}
			continue
		}

		if !inString && char == '-' && next == '-' {
			inLineComment = true
			i++
			continue
		}
		if !inString && char == '/' && next == '*' {
			inBlockComment = true
			i++
			continue
		}

		if inString {
			current.WriteRune(char)
			if char == stringChar {
				if next == stringChar {
					current.WriteRune(next)
					i++
					continue
				}
				inString = false
			}
			continue
		}

		if char == '\'' || char == '"' || char == '`' {
			inString = true
			stringChar = char
			current.WriteRune(char)
			continue
		}

		if char == ';' {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			current.Reset()
			continue
		}

		current.WriteRune(char)
	}

	if stmt := strings.TrimSpace(current.String()); stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}
