package rest

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const unifiedBackupVersion = "2.0"

var (
	compactTimezoneSuffix = regexp.MustCompile(`([+-]\d{2})(\d{2})$`)
	shortTimezoneSuffix   = regexp.MustCompile(`([+-]\d{2})$`)
	timeOfDayPattern      = regexp.MustCompile(`\d{2}:\d{2}`)
	identifierPattern     = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
)

type BackupContentSelection struct {
	Config   bool `json:"config"`
	Database bool `json:"database"`
}

type UnifiedBackup struct {
	Format     string                 `json:"format"`
	Version    string                 `json:"version"`
	ExportTime string                 `json:"export_time"`
	Contents   BackupContentSelection `json:"contents"`
	Config     *BackupDataSection     `json:"config,omitempty"`
	Database   *BackupDataSection     `json:"database,omitempty"`
}

type BackupDataSection struct {
	Driver string        `json:"driver"`
	Tables []BackupTable `json:"tables"`
}

type BackupTable struct {
	Name       string                   `json:"name"`
	PrimaryKey []string                 `json:"primary_key"`
	Columns    []string                 `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
}

type RestoreConflictStrategy string

const (
	RestoreConflictSkip      RestoreConflictStrategy = "skip"
	RestoreConflictOverwrite RestoreConflictStrategy = "overwrite"
	RestoreConflictError     RestoreConflictStrategy = "error"
)

type restoreSectionSummary struct {
	Tables      int `json:"tables"`
	Inserted    int `json:"inserted"`
	Updated     int `json:"updated"`
	Skipped     int `json:"skipped"`
	ConfigReset int `json:"config_reset,omitempty"`
}

type restoreConflictKey struct {
	Name     string
	Columns  []string
	Required bool
}

var configBackupTables = map[string]bool{
	"system_config":       true,
	"security_config":     true,
	"notification_config": true,
	"ai_config":           true,
}

// ExportBackup 导出统一备份文件。
// @Summary 导出统一备份文件
// @Tags 备份恢复
// @Produce json
// @Param include_config query bool false "是否包含配置"
// @Param include_database query bool false "是否包含数据库数据"
// @Success 200 {file} binary
// @Router /api/v1/backup/export [get]
func (h *BackupHandler) ExportBackup(c *gin.Context) {
	includeConfig := parseBoolQuery(c, "include_config", true)
	includeDatabase := parseBoolQuery(c, "include_database", true)
	if !includeConfig && !includeDatabase {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No backup content selected"})
		return
	}

	backup := &UnifiedBackup{
		Format:     "easyssh-unified-backup",
		Version:    unifiedBackupVersion,
		ExportTime: time.Now().UTC().Format(time.RFC3339),
		Contents: BackupContentSelection{
			Config:   includeConfig,
			Database: includeDatabase,
		},
	}

	if includeConfig {
		section, err := h.exportStructuredSection(isConfigBackupTable)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":  "Failed to export config",
				"detail": err.Error(),
			})
			return
		}
		backup.Config = section
	}

	if includeDatabase {
		section, err := h.exportStructuredSection(func(table string) bool {
			return !isConfigBackupTable(table)
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":  "Failed to export database",
				"detail": err.Error(),
			})
			return
		}
		backup.Database = section
	}

	jsonData, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to serialize backup",
			"detail": err.Error(),
		})
		return
	}

	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("easyssh_backup_%s.json", timestamp)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/json", jsonData)
}

// RestoreBackup 从统一备份文件恢复数据。
// @Summary 恢复统一备份文件
// @Tags 备份恢复
// @Accept multipart/form-data
// @Param file formData file true "统一备份文件"
// @Param include_config formData bool false "是否恢复配置"
// @Param include_database formData bool false "是否恢复数据库数据"
// @Param conflict_strategy formData string false "冲突策略：skip/overwrite/error"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/backup/restore [post]
func (h *BackupHandler) RestoreBackup(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	uploadedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
		return
	}
	defer uploadedFile.Close()

	var backup UnifiedBackup
	decoder := json.NewDecoder(uploadedFile)
	decoder.UseNumber()
	if err := decoder.Decode(&backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Invalid backup file format",
			"detail": err.Error(),
		})
		return
	}

	if err := validateUnifiedBackup(&backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Invalid backup file",
			"detail": err.Error(),
		})
		return
	}

	includeConfig := parseBoolForm(c, "include_config", backup.Config != nil)
	includeDatabase := parseBoolForm(c, "include_database", backup.Database != nil)
	if !includeConfig && !includeDatabase {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No restore content selected"})
		return
	}
	if includeConfig && backup.Config == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup file does not include config"})
		return
	}
	if includeDatabase && backup.Database == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup file does not include database"})
		return
	}

	strategy, err := parseRestoreConflictStrategy(c.PostForm("conflict_strategy"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	summary := gin.H{}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if includeConfig {
			result, err := h.restoreConfigSection(tx, backup.Config, strategy)
			if err != nil {
				return err
			}
			summary["config"] = result
		}

		if includeDatabase {
			result, err := h.restoreDataSection(tx, backup.Database, strategy)
			if err != nil {
				return err
			}
			summary["database"] = result
		}

		return nil
	}); err != nil {
		c.JSON(http.StatusConflict, gin.H{
			"error":  "Failed to restore backup",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":           "Backup restored successfully",
		"conflict_strategy": strategy,
		"summary":           summary,
	})
}

func parseBoolQuery(c *gin.Context, key string, defaultValue bool) bool {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return defaultValue
	}
	parsed, err := parseBoolString(value)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func parseBoolForm(c *gin.Context, key string, defaultValue bool) bool {
	value := strings.TrimSpace(c.PostForm(key))
	if value == "" {
		return defaultValue
	}
	parsed, err := parseBoolString(value)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func parseBoolString(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid bool value: %s", value)
	}
}

func parseRestoreConflictStrategy(value string) (RestoreConflictStrategy, error) {
	switch RestoreConflictStrategy(strings.ToLower(strings.TrimSpace(value))) {
	case "", RestoreConflictError:
		return RestoreConflictError, nil
	case RestoreConflictSkip:
		return RestoreConflictSkip, nil
	case RestoreConflictOverwrite:
		return RestoreConflictOverwrite, nil
	default:
		return "", fmt.Errorf("unsupported conflict strategy: %s", value)
	}
}

func validateUnifiedBackup(backup *UnifiedBackup) error {
	if strings.TrimSpace(backup.Format) != "easyssh-unified-backup" {
		return fmt.Errorf("unsupported backup format")
	}
	if strings.TrimSpace(backup.Version) == "" {
		return fmt.Errorf("missing backup version")
	}
	if backup.Config == nil && backup.Database == nil {
		return fmt.Errorf("backup has no restorable content")
	}
	return nil
}

func isConfigBackupTable(table string) bool {
	return configBackupTables[strings.ToLower(strings.TrimSpace(table))]
}

func (h *BackupHandler) exportStructuredSection(includeTable func(string) bool) (*BackupDataSection, error) {
	driver := h.db.Dialector.Name()
	section := &BackupDataSection{
		Driver: driver,
		Tables: make([]BackupTable, 0),
	}

	tables, err := h.getAllTables()
	if err != nil {
		return nil, fmt.Errorf("failed to get tables: %w", err)
	}
	tables, err = h.sortTablesByDependencies(tables)
	if err != nil {
		return nil, fmt.Errorf("failed to sort tables: %w", err)
	}

	for _, table := range tables {
		if !includeTable(table) {
			continue
		}

		columns, err := h.getTableColumns(table)
		if err != nil {
			return nil, fmt.Errorf("failed to get columns for table %s: %w", table, err)
		}
		if len(columns) == 0 {
			continue
		}

		primaryKey, err := h.getTablePrimaryKeys(h.db, table, columns)
		if err != nil {
			return nil, fmt.Errorf("failed to get primary key for table %s: %w", table, err)
		}

		rows, err := h.getStructuredTableRows(table, columns)
		if err != nil {
			return nil, fmt.Errorf("failed to export rows for table %s: %w", table, err)
		}

		section.Tables = append(section.Tables, BackupTable{
			Name:       table,
			PrimaryKey: primaryKey,
			Columns:    columns,
			Rows:       rows,
		})
	}

	return section, nil
}

func (h *BackupHandler) getStructuredTableRows(table string, columns []string) ([]map[string]interface{}, error) {
	driver := h.db.Dialector.Name()
	quotedColumns := make([]string, len(columns))
	for i, column := range columns {
		quotedColumns[i] = quoteIdentifier(driver, column)
	}

	query := fmt.Sprintf(
		"SELECT %s FROM %s",
		strings.Join(quotedColumns, ", "),
		quoteIdentifier(driver, table),
	)

	rows, err := h.db.Raw(query).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		values := make([]interface{}, len(columns))
		scanTargets := make([]interface{}, len(columns))
		for i := range values {
			scanTargets[i] = &values[i]
		}

		if err := rows.Scan(scanTargets...); err != nil {
			return nil, err
		}

		row := make(map[string]interface{}, len(columns))
		for i, column := range columns {
			row[column] = normalizeBackupValue(values[i])
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func normalizeBackupValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case time.Time:
		return v.Format(time.RFC3339Nano)
	case []byte:
		if utf8.Valid(v) {
			return string(v)
		}
		return map[string]string{
			"encoding": "base64",
			"value":    base64.StdEncoding.EncodeToString(v),
		}
	default:
		return v
	}
}

func (h *BackupHandler) restoreConfigSection(tx *gorm.DB, section *BackupDataSection, strategy RestoreConflictStrategy) (*restoreSectionSummary, error) {
	summary := &restoreSectionSummary{}
	restoredTables := make([]BackupTable, 0)
	for _, table := range section.Tables {
		if !isConfigBackupTable(table.Name) {
			continue
		}
		summary.Tables++
		if len(table.Rows) == 0 {
			continue
		}

		if err := h.validateRestoreTable(tx, &table); err != nil {
			return nil, err
		}

		hasRows, err := h.tableHasRows(tx, table.Name)
		if err != nil {
			return nil, err
		}

		if hasRows {
			switch strategy {
			case RestoreConflictSkip:
				summary.Skipped += len(table.Rows)
				continue
			case RestoreConflictError:
				return nil, fmt.Errorf("config table %s already has data", table.Name)
			case RestoreConflictOverwrite:
				if err := tx.Exec(fmt.Sprintf("DELETE FROM %s", quoteIdentifier(tx.Dialector.Name(), table.Name))).Error; err != nil {
					return nil, fmt.Errorf("failed to clear config table %s: %w", table.Name, err)
				}
				summary.ConfigReset++
			}
		}

		for _, rawRow := range table.Rows {
			row, err := h.normalizeRestoreRow(tx, table.Name, table.Columns, rawRow)
			if err != nil {
				return nil, err
			}
			if err := tx.Table(table.Name).Create(row).Error; err != nil {
				return nil, fmt.Errorf("failed to restore config table %s: %w", table.Name, err)
			}
			summary.Inserted++
			restoredTables = append(restoredTables, table)
		}
	}
	if err := h.resetPostgresSequences(tx, &BackupDataSection{Tables: restoredTables}); err != nil {
		return nil, err
	}
	return summary, nil
}

func (h *BackupHandler) restoreDataSection(tx *gorm.DB, section *BackupDataSection, strategy RestoreConflictStrategy) (*restoreSectionSummary, error) {
	summary := &restoreSectionSummary{}
	restoredTables := make([]BackupTable, 0)
	for _, table := range section.Tables {
		if isConfigBackupTable(table.Name) {
			continue
		}
		summary.Tables++
		if len(table.Rows) == 0 {
			continue
		}

		if err := h.validateRestoreTable(tx, &table); err != nil {
			return nil, err
		}

		if len(table.PrimaryKey) == 0 {
			table.PrimaryKey = fallbackPrimaryKey(table.Columns)
		}
		conflictKeys, err := h.getRestoreConflictKeys(tx, table.Name, table.PrimaryKey)
		if err != nil {
			return nil, err
		}
		if len(conflictKeys) == 0 {
			return nil, fmt.Errorf("table %s has no primary or unique key, cannot apply conflict strategy", table.Name)
		}

		for _, rawRow := range table.Rows {
			row, err := h.normalizeRestoreRow(tx, table.Name, table.Columns, rawRow)
			if err != nil {
				return nil, err
			}

			conflictKey, err := h.findBackupConflictKey(tx, table.Name, conflictKeys, row)
			if err != nil {
				return nil, err
			}

			if conflictKey != nil {
				switch strategy {
				case RestoreConflictSkip:
					summary.Skipped++
					continue
				case RestoreConflictError:
					return nil, fmt.Errorf("table %s item already exists: %s", table.Name, formatConflictKey(*conflictKey, row))
				case RestoreConflictOverwrite:
					if err := h.updateBackupRow(tx, table.Name, *conflictKey, row); err != nil {
						return nil, err
					}
					summary.Updated++
					restoredTables = append(restoredTables, table)
					continue
				}
			}

			if err := tx.Table(table.Name).Create(row).Error; err != nil {
				return nil, fmt.Errorf("failed to restore table %s: %w", table.Name, err)
			}
			summary.Inserted++
			restoredTables = append(restoredTables, table)
		}
	}
	if err := h.resetPostgresSequences(tx, &BackupDataSection{Tables: restoredTables}); err != nil {
		return nil, err
	}
	return summary, nil
}

func (h *BackupHandler) validateRestoreTable(tx *gorm.DB, table *BackupTable) error {
	if !isValidDBIdentifier(table.Name) {
		return fmt.Errorf("invalid table name: %s", table.Name)
	}
	for _, column := range table.Columns {
		if !isValidDBIdentifier(column) {
			return fmt.Errorf("invalid column name in table %s: %s", table.Name, column)
		}
	}
	for _, column := range table.PrimaryKey {
		if !isValidDBIdentifier(column) {
			return fmt.Errorf("invalid primary key column in table %s: %s", table.Name, column)
		}
	}

	currentColumns, err := h.getTableColumnsForDB(tx, table.Name)
	if err != nil {
		return fmt.Errorf("failed to inspect table %s: %w", table.Name, err)
	}
	if len(currentColumns) == 0 {
		return fmt.Errorf("table %s does not exist", table.Name)
	}

	currentColumnSet := make(map[string]bool, len(currentColumns))
	for _, column := range currentColumns {
		currentColumnSet[column] = true
	}
	for _, column := range table.Columns {
		if !currentColumnSet[column] {
			return fmt.Errorf("table %s does not have column %s", table.Name, column)
		}
	}

	return nil
}

func (h *BackupHandler) normalizeRestoreRow(tx *gorm.DB, table string, columns []string, rawRow map[string]interface{}) (map[string]interface{}, error) {
	columnTypes, err := h.getTableColumnTypes(tx, table)
	if err != nil {
		return nil, fmt.Errorf("failed to get column types for table %s: %w", table, err)
	}

	row := make(map[string]interface{}, len(columns))
	for _, column := range columns {
		value, ok := rawRow[column]
		if !ok {
			continue
		}
		row[column] = coerceRestoreValue(value, columnTypes[column])
	}

	return row, nil
}

func coerceRestoreValue(value interface{}, columnType string) interface{} {
	if value == nil {
		return nil
	}

	normalizedType := strings.ToLower(columnType)
	switch v := value.(type) {
	case json.Number:
		if isBoolColumn(normalizedType) {
			return v.String() != "0"
		}
		if isIntegerColumn(normalizedType) {
			if number, err := v.Int64(); err == nil {
				return number
			}
			if number, err := v.Float64(); err == nil {
				return int64(math.Round(number))
			}
		}
		if isFloatColumn(normalizedType) {
			if number, err := v.Float64(); err == nil {
				return number
			}
		}
		return v.String()
	case float64:
		if isBoolColumn(normalizedType) {
			return v != 0
		}
		if isIntegerColumn(normalizedType) {
			return int64(math.Round(v))
		}
		return v
	case string:
		if isBoolColumn(normalizedType) {
			if parsed, err := parseBoolString(v); err == nil {
				return parsed
			}
		}
		if isTimeColumn(normalizedType) {
			return normalizeTimeString(v)
		}
		return v
	case map[string]interface{}:
		if encoding, _ := v["encoding"].(string); encoding == "base64" {
			if encoded, _ := v["value"].(string); encoded != "" {
				if decoded, err := base64.StdEncoding.DecodeString(encoded); err == nil {
					return decoded
				}
			}
		}
		return v
	default:
		return value
	}
}

func normalizeTimeString(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if !timeOfDayPattern.MatchString(value) {
		return value
	}
	if compactTimezoneSuffix.MatchString(value) {
		return compactTimezoneSuffix.ReplaceAllString(value, "$1:$2")
	}
	if shortTimezoneSuffix.MatchString(value) && !strings.Contains(value[len(value)-3:], ":") {
		return value + ":00"
	}
	return value
}

func isIntegerColumn(columnType string) bool {
	return strings.Contains(columnType, "int") ||
		strings.Contains(columnType, "serial")
}

func isFloatColumn(columnType string) bool {
	return strings.Contains(columnType, "real") ||
		strings.Contains(columnType, "float") ||
		strings.Contains(columnType, "double") ||
		strings.Contains(columnType, "decimal") ||
		strings.Contains(columnType, "numeric")
}

func isBoolColumn(columnType string) bool {
	return strings.Contains(columnType, "bool")
}

func isTimeColumn(columnType string) bool {
	return strings.Contains(columnType, "time") ||
		strings.Contains(columnType, "date")
}

func (h *BackupHandler) tableHasRows(tx *gorm.DB, table string) (bool, error) {
	var count int64
	if err := tx.Table(table).Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to count table %s: %w", table, err)
	}
	return count > 0, nil
}

func (h *BackupHandler) getRestoreConflictKeys(tx *gorm.DB, table string, primaryKey []string) ([]restoreConflictKey, error) {
	keys := make([]restoreConflictKey, 0)
	seen := make(map[string]bool)

	if len(primaryKey) > 0 {
		key := restoreConflictKey{
			Name:     "primary key",
			Columns:  append([]string(nil), primaryKey...),
			Required: true,
		}
		keys = append(keys, key)
		seen[columnsSignature(key.Columns)] = true
	}

	uniqueKeys, err := h.getTableUniqueKeys(tx, table)
	if err != nil {
		return nil, fmt.Errorf("failed to get unique keys for table %s: %w", table, err)
	}
	for _, key := range uniqueKeys {
		if len(key.Columns) == 0 {
			continue
		}
		signature := columnsSignature(key.Columns)
		if seen[signature] {
			continue
		}
		seen[signature] = true
		keys = append(keys, key)
	}

	return keys, nil
}

func (h *BackupHandler) findBackupConflictKey(tx *gorm.DB, table string, keys []restoreConflictKey, row map[string]interface{}) (*restoreConflictKey, error) {
	for _, key := range keys {
		if missingColumn := missingConflictKeyColumn(row, key.Columns); missingColumn != "" {
			if key.Required {
				return nil, fmt.Errorf("table %s row is missing %s column %s", table, key.Name, missingColumn)
			}
			continue
		}

		exists, err := h.backupRowExistsByColumns(tx, table, key.Columns, row)
		if err != nil {
			return nil, err
		}
		if exists {
			matched := key
			return &matched, nil
		}
	}

	return nil, nil
}

func (h *BackupHandler) backupRowExistsByColumns(tx *gorm.DB, table string, columns []string, row map[string]interface{}) (bool, error) {
	query := tx.Table(table)
	driver := tx.Dialector.Name()
	for _, column := range columns {
		value, ok := row[column]
		if !ok || value == nil {
			return false, fmt.Errorf("table %s row is missing conflict key column %s", table, column)
		}
		query = query.Where(fmt.Sprintf("%s = ?", quoteIdentifier(driver, column)), value)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check existing row in table %s: %w", table, err)
	}
	return count > 0, nil
}

func (h *BackupHandler) updateBackupRow(tx *gorm.DB, table string, key restoreConflictKey, row map[string]interface{}) error {
	query := tx.Table(table)
	driver := tx.Dialector.Name()
	for _, column := range key.Columns {
		value, ok := row[column]
		if !ok || value == nil {
			return fmt.Errorf("table %s row is missing conflict key column %s", table, column)
		}
		query = query.Where(fmt.Sprintf("%s = ?", quoteIdentifier(driver, column)), value)
	}

	updates := make(map[string]interface{}, len(row))
	for column, value := range row {
		if containsString(key.Columns, column) {
			continue
		}
		updates[column] = value
	}

	if len(updates) == 0 {
		return nil
	}
	if err := query.Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to update table %s item %s: %w", table, formatConflictKey(key, row), err)
	}
	return nil
}

func fallbackPrimaryKey(columns []string) []string {
	for _, column := range columns {
		if strings.EqualFold(column, "id") {
			return []string{column}
		}
	}
	return nil
}

func formatPrimaryKey(primaryKey []string, row map[string]interface{}) string {
	return formatConflictColumns(primaryKey, row)
}

func formatConflictKey(key restoreConflictKey, row map[string]interface{}) string {
	label := strings.TrimSpace(key.Name)
	if label == "" {
		label = "conflict key"
	}
	return fmt.Sprintf("%s (%s)", label, formatConflictColumns(key.Columns, row))
}

func formatConflictColumns(columns []string, row map[string]interface{}) string {
	parts := make([]string, 0, len(columns))
	for _, column := range columns {
		parts = append(parts, fmt.Sprintf("%s=%v", column, row[column]))
	}
	return strings.Join(parts, ", ")
}

func missingConflictKeyColumn(row map[string]interface{}, columns []string) string {
	for _, column := range columns {
		value, ok := row[column]
		if !ok || value == nil {
			return column
		}
	}
	return ""
}

func columnsSignature(columns []string) string {
	normalized := make([]string, 0, len(columns))
	for _, column := range columns {
		normalized = append(normalized, strings.ToLower(strings.TrimSpace(column)))
	}
	sort.Strings(normalized)
	return strings.Join(normalized, "\x00")
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func isValidDBIdentifier(value string) bool {
	return identifierPattern.MatchString(value)
}

func (h *BackupHandler) getTableUniqueKeys(db *gorm.DB, tableName string) ([]restoreConflictKey, error) {
	driver := db.Dialector.Name()
	switch driver {
	case "sqlite":
		return h.getSQLiteUniqueKeys(db, tableName)
	case "postgres":
		return h.getPostgresUniqueKeys(db, tableName)
	case "mysql":
		return h.getMySQLUniqueKeys(db, tableName)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}
}

func (h *BackupHandler) getSQLiteUniqueKeys(db *gorm.DB, tableName string) ([]restoreConflictKey, error) {
	var indexes []struct {
		Name    string `gorm:"column:name"`
		Unique  int    `gorm:"column:unique"`
		Origin  string `gorm:"column:origin"`
		Partial int    `gorm:"column:partial"`
	}
	if err := db.Raw(fmt.Sprintf("PRAGMA index_list(%s)", quoteIdentifier("sqlite", tableName))).Scan(&indexes).Error; err != nil {
		return nil, err
	}

	keys := make([]restoreConflictKey, 0)
	for _, index := range indexes {
		if index.Unique == 0 || index.Origin == "pk" || index.Partial != 0 {
			continue
		}

		var rows []struct {
			SeqNo int    `gorm:"column:seqno"`
			Name  string `gorm:"column:name"`
		}
		if err := db.Raw(fmt.Sprintf("PRAGMA index_info(%s)", quoteIdentifier("sqlite", index.Name))).Scan(&rows).Error; err != nil {
			return nil, err
		}
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].SeqNo < rows[j].SeqNo
		})

		columns := make([]string, 0, len(rows))
		for _, row := range rows {
			if strings.TrimSpace(row.Name) != "" {
				columns = append(columns, row.Name)
			}
		}
		if len(columns) > 0 {
			keys = append(keys, restoreConflictKey{Name: index.Name, Columns: columns})
		}
	}

	return keys, nil
}

func (h *BackupHandler) getPostgresUniqueKeys(db *gorm.DB, tableName string) ([]restoreConflictKey, error) {
	var rows []struct {
		IndexName string `gorm:"column:index_name"`
		Column    string `gorm:"column:column_name"`
		Ordinal   int    `gorm:"column:ordinal"`
	}
	if err := db.Raw(`
		SELECT
			i.relname AS index_name,
			a.attname AS column_name,
			array_position(ix.indkey::int2[], a.attnum::int2) AS ordinal
		FROM pg_class AS t
		JOIN pg_namespace AS ns ON ns.oid = t.relnamespace
		JOIN pg_index AS ix ON ix.indrelid = t.oid
		JOIN pg_class AS i ON i.oid = ix.indexrelid
		JOIN pg_attribute AS a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		WHERE ns.nspname = 'public'
		  AND t.relname = ?
		  AND ix.indisunique = true
		  AND ix.indisprimary = false
		  AND ix.indpred IS NULL
		ORDER BY i.relname, array_position(ix.indkey::int2[], a.attnum::int2)
	`, tableName).Scan(&rows).Error; err != nil {
		return nil, err
	}

	return groupedUniqueKeys(rows, func(row struct {
		IndexName string `gorm:"column:index_name"`
		Column    string `gorm:"column:column_name"`
		Ordinal   int    `gorm:"column:ordinal"`
	}) (string, string, int) {
		return row.IndexName, row.Column, row.Ordinal
	}), nil
}

func (h *BackupHandler) getMySQLUniqueKeys(db *gorm.DB, tableName string) ([]restoreConflictKey, error) {
	var rows []struct {
		IndexName string `gorm:"column:index_name"`
		Column    string `gorm:"column:column_name"`
		Ordinal   int    `gorm:"column:seq_in_index"`
	}
	if err := db.Raw(`
		SELECT index_name, column_name, seq_in_index
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		  AND table_name = ?
		  AND non_unique = 0
		  AND index_name <> 'PRIMARY'
		ORDER BY index_name, seq_in_index
	`, tableName).Scan(&rows).Error; err != nil {
		return nil, err
	}

	return groupedUniqueKeys(rows, func(row struct {
		IndexName string `gorm:"column:index_name"`
		Column    string `gorm:"column:column_name"`
		Ordinal   int    `gorm:"column:seq_in_index"`
	}) (string, string, int) {
		return row.IndexName, row.Column, row.Ordinal
	}), nil
}

func groupedUniqueKeys[T any](rows []T, unpack func(T) (string, string, int)) []restoreConflictKey {
	type uniqueColumn struct {
		Name    string
		Ordinal int
	}

	grouped := make(map[string][]uniqueColumn)
	order := make([]string, 0)
	for _, row := range rows {
		indexName, column, ordinal := unpack(row)
		indexName = strings.TrimSpace(indexName)
		column = strings.TrimSpace(column)
		if indexName == "" || column == "" {
			continue
		}
		if _, ok := grouped[indexName]; !ok {
			order = append(order, indexName)
		}
		grouped[indexName] = append(grouped[indexName], uniqueColumn{Name: column, Ordinal: ordinal})
	}

	keys := make([]restoreConflictKey, 0, len(grouped))
	for _, indexName := range order {
		columns := grouped[indexName]
		sort.Slice(columns, func(i, j int) bool {
			return columns[i].Ordinal < columns[j].Ordinal
		})

		keyColumns := make([]string, 0, len(columns))
		for _, column := range columns {
			keyColumns = append(keyColumns, column.Name)
		}
		if len(keyColumns) > 0 {
			keys = append(keys, restoreConflictKey{Name: indexName, Columns: keyColumns})
		}
	}
	return keys
}

func (h *BackupHandler) getTablePrimaryKeys(db *gorm.DB, tableName string, columns []string) ([]string, error) {
	driver := db.Dialector.Name()
	switch driver {
	case "sqlite":
		var rows []struct {
			Name string `gorm:"column:name"`
			PK   int    `gorm:"column:pk"`
		}
		if err := db.Raw(fmt.Sprintf("PRAGMA table_info(%s)", quoteIdentifier(driver, tableName))).Scan(&rows).Error; err != nil {
			return nil, err
		}
		sort.Slice(rows, func(i, j int) bool {
			return rows[i].PK < rows[j].PK
		})
		primaryKey := make([]string, 0)
		for _, row := range rows {
			if row.PK > 0 {
				primaryKey = append(primaryKey, row.Name)
			}
		}
		if len(primaryKey) > 0 {
			return primaryKey, nil
		}
	case "postgres":
		var primaryKey []string
		if err := db.Raw(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
			  ON tc.constraint_name = kcu.constraint_name
			 AND tc.table_schema = kcu.table_schema
			 AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY'
			  AND tc.table_schema = 'public'
			  AND tc.table_name = ?
			ORDER BY kcu.ordinal_position
		`, tableName).Scan(&primaryKey).Error; err != nil {
			return nil, err
		}
		if len(primaryKey) > 0 {
			return primaryKey, nil
		}
	case "mysql":
		var primaryKey []string
		if err := db.Raw(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
			  ON tc.constraint_name = kcu.constraint_name
			 AND tc.table_schema = kcu.table_schema
			 AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY'
			  AND tc.table_schema = DATABASE()
			  AND tc.table_name = ?
			ORDER BY kcu.ordinal_position
		`, tableName).Scan(&primaryKey).Error; err != nil {
			return nil, err
		}
		if len(primaryKey) > 0 {
			return primaryKey, nil
		}
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}

	return fallbackPrimaryKey(columns), nil
}

func (h *BackupHandler) getTableColumnsForDB(db *gorm.DB, tableName string) ([]string, error) {
	driver := db.Dialector.Name()
	var columns []string

	switch driver {
	case "sqlite":
		var rows []struct {
			Name string `gorm:"column:name"`
		}
		if err := db.Raw(fmt.Sprintf("PRAGMA table_info(%s)", quoteIdentifier(driver, tableName))).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			columns = append(columns, row.Name)
		}
	case "postgres":
		if err := db.Raw(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = ?
			ORDER BY ordinal_position
		`, tableName).Scan(&columns).Error; err != nil {
			return nil, err
		}
	case "mysql":
		if err := db.Raw(`
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

func (h *BackupHandler) getTableColumnTypes(db *gorm.DB, tableName string) (map[string]string, error) {
	driver := db.Dialector.Name()
	columnTypes := make(map[string]string)

	switch driver {
	case "sqlite":
		var rows []struct {
			Name string `gorm:"column:name"`
			Type string `gorm:"column:type"`
		}
		if err := db.Raw(fmt.Sprintf("PRAGMA table_info(%s)", quoteIdentifier(driver, tableName))).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			columnTypes[row.Name] = row.Type
		}
	case "postgres":
		var rows []struct {
			Name string `gorm:"column:column_name"`
			Type string `gorm:"column:data_type"`
		}
		if err := db.Raw(`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = ?
		`, tableName).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			columnTypes[row.Name] = row.Type
		}
	case "mysql":
		var rows []struct {
			Name string `gorm:"column:column_name"`
			Type string `gorm:"column:data_type"`
		}
		if err := db.Raw(`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = ?
		`, tableName).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			columnTypes[row.Name] = row.Type
		}
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", driver)
	}

	return columnTypes, nil
}

func (h *BackupHandler) resetPostgresSequences(tx *gorm.DB, section *BackupDataSection) error {
	if tx.Dialector.Name() != "postgres" {
		return nil
	}

	for _, table := range section.Tables {
		if len(table.Rows) == 0 || !containsString(table.Columns, "id") {
			continue
		}

		columnTypes, err := h.getTableColumnTypes(tx, table.Name)
		if err != nil {
			return fmt.Errorf("failed to get column types for table %s: %w", table.Name, err)
		}
		if !isIntegerColumn(strings.ToLower(columnTypes["id"])) {
			continue
		}

		quotedTable := quoteIdentifier("postgres", table.Name)
		stmt := fmt.Sprintf(`
			SELECT setval(
				pg_get_serial_sequence(?, 'id'),
				COALESCE((SELECT MAX(id) FROM %s), 1),
				(SELECT COUNT(*) > 0 FROM %s)
			)
			WHERE pg_get_serial_sequence(?, 'id') IS NOT NULL
		`, quotedTable, quotedTable)
		if err := tx.Exec(stmt, table.Name, table.Name).Error; err != nil {
			return fmt.Errorf("failed to reset sequence for table %s: %w", table.Name, err)
		}
	}

	return nil
}
