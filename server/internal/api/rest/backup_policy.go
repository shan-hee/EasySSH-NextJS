package rest

import "strings"

type backupSection string

const (
	backupSectionConfig   backupSection = "config"
	backupSectionDatabase backupSection = "database"
	backupSectionRuntime  backupSection = "runtime"
)

type backupRestoreMode string

const (
	backupRestoreSingleton backupRestoreMode = "singleton"
	backupRestoreEntity    backupRestoreMode = "entity"
	backupRestoreIgnore    backupRestoreMode = "ignore"
)

type backupTablePolicy struct {
	Table         string
	Section       backupSection
	RestoreMode   backupRestoreMode
	Exportable    bool
	Restorable    bool
	LogicalKeys   [][]string
	UserScoped    bool
	History       bool
	DefaultSeeded bool
}

var backupTablePolicies = map[string]backupTablePolicy{
	// Singleton configuration. These rows describe current system state; restoring config means
	// making the current singleton rows match the backup, not applying database conflict strategy.
	"system_config":       singletonConfigPolicy("system_config"),
	"security_config":     singletonConfigPolicy("security_config"),
	"notification_config": singletonConfigPolicy("notification_config"),
	"ai_config":           singletonConfigPolicy("ai_config"),

	// User-owned configuration is business data because each row belongs to a user.
	"user_ai_config": entityPolicy("user_ai_config", [][]string{{"user_id"}}, true),

	// Core business entities.
	"users":           entityPolicy("users", [][]string{{"email"}, {"google_sub"}}, false),
	"servers":         entityPolicy("servers", nil, true),
	"ssh_keys":        entityPolicy("ssh_keys", [][]string{{"user_id", "fingerprint"}}, true),
	"ssh_host_keys":   entityPolicy("ssh_host_keys", [][]string{{"host", "port"}}, false),
	"scripts":         entityPolicy("scripts", nil, true),
	"batch_tasks":     entityPolicy("batch_tasks", nil, true),
	"scheduled_tasks": entityPolicy("scheduled_tasks", nil, true),
	"permissions":     defaultSeededEntityPolicy("permissions", [][]string{{"code"}}, false),

	// Operational history and append-like records. They remain in the database section but keep
	// explicit policy metadata so later UI can expose them separately without touching restore logic.
	"audit_logs":        historyPolicy("audit_logs", nil, true),
	"operation_records": historyPolicy("operation_records", [][]string{{"source_table", "source_id"}}, true),
	"login_attempts":    historyPolicy("login_attempts", [][]string{{"id"}}, false),
	"login_alerts":      historyPolicy("login_alerts", nil, true),
	"ai_sessions":       historyPolicy("ai_sessions", nil, true),

	// Runtime/security state should not travel with backup restore. Sessions, trusted devices,
	// and RSA key material are derived security state and must be regenerated in the target env.
	"user_sessions":   ignoredRuntimePolicy("user_sessions"),
	"trusted_devices": ignoredRuntimePolicy("trusted_devices"),
	"rsa_key_pairs":   ignoredRuntimePolicy("rsa_key_pairs"),
}

func singletonConfigPolicy(table string) backupTablePolicy {
	return backupTablePolicy{
		Table:         table,
		Section:       backupSectionConfig,
		RestoreMode:   backupRestoreSingleton,
		Exportable:    true,
		Restorable:    true,
		LogicalKeys:   [][]string{{"id"}},
		DefaultSeeded: true,
	}
}

func entityPolicy(table string, logicalKeys [][]string, userScoped bool) backupTablePolicy {
	return backupTablePolicy{
		Table:       table,
		Section:     backupSectionDatabase,
		RestoreMode: backupRestoreEntity,
		Exportable:  true,
		Restorable:  true,
		LogicalKeys: logicalKeys,
		UserScoped:  userScoped,
	}
}

func defaultSeededEntityPolicy(table string, logicalKeys [][]string, userScoped bool) backupTablePolicy {
	policy := entityPolicy(table, logicalKeys, userScoped)
	policy.DefaultSeeded = true
	return policy
}

func historyPolicy(table string, logicalKeys [][]string, userScoped bool) backupTablePolicy {
	policy := entityPolicy(table, logicalKeys, userScoped)
	policy.History = true
	return policy
}

func ignoredRuntimePolicy(table string) backupTablePolicy {
	return backupTablePolicy{
		Table:       table,
		Section:     backupSectionRuntime,
		RestoreMode: backupRestoreIgnore,
		Exportable:  false,
		Restorable:  false,
	}
}

func backupPolicyForTable(table string) (backupTablePolicy, bool) {
	normalized := normalizeBackupTableName(table)
	if policy, ok := backupTablePolicies[normalized]; ok {
		return policy, true
	}
	return backupTablePolicy{Table: normalized}, false
}

func normalizeBackupTableName(table string) string {
	return strings.ToLower(strings.TrimSpace(table))
}
