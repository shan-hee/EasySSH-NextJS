package sftp

import (
	"context"
	"fmt"
	"log"
	"os"
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/google/uuid"
	sftpPkg "github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type TrashCleanerConfig struct {
	Enabled bool

	Interval         time.Duration
	SuccessCooldown  time.Duration
	Retention        time.Duration
	MaxEntries       int
	MaxBytes         int64
	MaxDeletesPerDir int
	MaxFailCount     int // 最大失败重试次数，超过后停止重试

	BatchSize      int
	Concurrency    int
	ConnectTimeout time.Duration
	JobTimeout     time.Duration
	BaseRetryDelay time.Duration
	MaxRetryDelay  time.Duration
}

type TrashCleaner struct {
	cfg TrashCleanerConfig

	repo            TrashDirRepository
	itemRepo        TrashItemRepository
	settingsRepo    TrashSettingsRepository
	serverService   server.Service
	encryptor       *crypto.Encryptor
	hostKeyCallback ssh.HostKeyCallback

	stopOnce sync.Once
	stopCh   chan struct{}
	stopped  chan struct{}
}

type TrashCleanerDeps struct {
	Repo            TrashDirRepository
	ItemRepo        TrashItemRepository
	SettingsRepo    TrashSettingsRepository
	ServerService   server.Service
	Encryptor       *crypto.Encryptor
	HostKeyCallback ssh.HostKeyCallback
}

func NewTrashCleaner(cfg TrashCleanerConfig, deps TrashCleanerDeps) *TrashCleaner {
	if cfg.Interval <= 0 {
		cfg.Interval = 10 * time.Minute
	}
	if cfg.SuccessCooldown <= 0 {
		cfg.SuccessCooldown = cfg.Interval
	}
	if cfg.Retention <= 0 {
		cfg.Retention = 24 * time.Hour
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 200
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 2
	}
	if cfg.ConnectTimeout <= 0 {
		cfg.ConnectTimeout = 10 * time.Second
	}
	if cfg.JobTimeout <= 0 {
		cfg.JobTimeout = 2 * time.Minute
	}
	if cfg.BaseRetryDelay <= 0 {
		cfg.BaseRetryDelay = 1 * time.Minute
	}
	if cfg.MaxRetryDelay <= 0 {
		cfg.MaxRetryDelay = 60 * time.Minute
	}
	if cfg.MaxDeletesPerDir <= 0 {
		cfg.MaxDeletesPerDir = 200
	}
	if cfg.MaxFailCount <= 0 {
		cfg.MaxFailCount = 10 // 默认最多重试 10 次
	}

	return &TrashCleaner{
		cfg:  cfg,
		repo: deps.Repo,
		// item repo optional
		// (用于将后台清理结果回写到索引表，便于全局回收站视图保持一致)
		// 不影响清理逻辑本身
		itemRepo:        deps.ItemRepo,
		settingsRepo:    deps.SettingsRepo,
		serverService:   deps.ServerService,
		encryptor:       deps.Encryptor,
		hostKeyCallback: deps.HostKeyCallback,
		stopCh:          make(chan struct{}),
		stopped:         make(chan struct{}),
	}
}

type trashPolicy struct {
	autoClean        bool
	retention        time.Duration
	maxEntries       int
	maxBytes         int64
	maxDeletesPerDir int
}

func (c *TrashCleaner) policyForUser(ctx context.Context, userID uuid.UUID) trashPolicy {
	p := trashPolicy{
		autoClean:        true,
		retention:        c.cfg.Retention,
		maxEntries:       c.cfg.MaxEntries,
		maxBytes:         c.cfg.MaxBytes,
		maxDeletesPerDir: c.cfg.MaxDeletesPerDir,
	}

	if c.settingsRepo == nil {
		return p
	}

	settings, err := c.settingsRepo.GetByUserID(ctx, userID)
	if err != nil {
		log.Printf("[TrashCleaner] get user settings failed: user=%s, err=%v (using defaults)", userID, err)
		return p
	}
	if settings == nil {
		return p
	}

	// user 级覆盖：0/未设置则使用系统默认（即当前 cfg）
	p.autoClean = settings.IsAutoCleanEnabled()

	defaultRetentionHours := int(c.cfg.Retention / time.Hour)
	p.retention = time.Duration(settings.GetRetentionHoursOrDefault(defaultRetentionHours)) * time.Hour

	p.maxEntries = settings.GetMaxEntriesPerDirOrDefault(c.cfg.MaxEntries)

	defaultMaxBytesMB := int(c.cfg.MaxBytes / (1024 * 1024))
	maxBytesMB := settings.GetMaxBytesPerDirMBOrDefault(defaultMaxBytesMB)
	p.maxBytes = int64(maxBytesMB) * 1024 * 1024

	return p
}

func (c *TrashCleaner) Start() {
	if !c.cfg.Enabled {
		log.Println("[TrashCleaner] disabled")
		return
	}
	if c.repo == nil || c.serverService == nil || c.encryptor == nil || c.hostKeyCallback == nil {
		log.Println("[TrashCleaner] missing deps, not started")
		return
	}

	go c.loop()
	log.Printf("[TrashCleaner] started: interval=%v, retention=%v, concurrency=%d", c.cfg.Interval, c.cfg.Retention, c.cfg.Concurrency)
}

func (c *TrashCleaner) Stop() {
	c.stopOnce.Do(func() {
		close(c.stopCh)
		<-c.stopped
	})
}

func (c *TrashCleaner) loop() {
	ticker := time.NewTicker(c.cfg.Interval)
	defer ticker.Stop()
	defer close(c.stopped)

	// 启动后立即跑一轮
	c.runOnce(context.Background())

	for {
		select {
		case <-ticker.C:
			c.runOnce(context.Background())
		case <-c.stopCh:
			return
		}
	}
}

func (c *TrashCleaner) runOnce(ctx context.Context) {
	now := time.Now()
	rows, err := c.repo.ListDue(ctx, now, c.cfg.BatchSize)
	if err != nil {
		log.Printf("[TrashCleaner] list due failed: %v", err)
		return
	}
	if len(rows) == 0 {
		return
	}

	type groupKey struct {
		userID   uuid.UUID
		serverID uuid.UUID
	}
	groups := make(map[groupKey][]TrashDir)
	for _, row := range rows {
		gk := groupKey{userID: row.UserID, serverID: row.ServerID}
		groups[gk] = append(groups[gk], row)
	}

	sem := make(chan struct{}, c.cfg.Concurrency)
	var wg sync.WaitGroup

	for gk, items := range groups {
		wg.Add(1)
		sem <- struct{}{}
		go func(gk groupKey, items []TrashDir) {
			defer wg.Done()
			defer func() { <-sem }()

			jobCtx, cancel := context.WithTimeout(ctx, c.cfg.JobTimeout)
			defer cancel()

			c.cleanServer(jobCtx, gk.userID, gk.serverID, items, now)
		}(gk, items)
	}

	wg.Wait()
}

func (c *TrashCleaner) cleanServer(ctx context.Context, userID, serverID uuid.UUID, items []TrashDir, now time.Time) {
	policy := c.policyForUser(ctx, userID)
	if !policy.autoClean {
		// 用户关闭了自动清理：不做任何远端操作，只推迟下次尝试，避免重复调度占用资源
		nextAttemptAt := now.Add(c.cfg.SuccessCooldown)
		for _, item := range items {
			if err := c.repo.MarkSkipped(ctx, item.ID, nextAttemptAt, "auto_clean_disabled"); err != nil {
				log.Printf("[TrashCleaner] mark skipped failed: id=%s, err=%v", item.ID, err)
			}
		}
		return
	}

	connectCtx, cancel := context.WithTimeout(ctx, c.cfg.ConnectTimeout)
	defer cancel()

	srv, err := c.serverService.GetByID(connectCtx, userID, serverID)
	if err != nil {
		for _, item := range items {
			c.markFailure(ctx, item, now, fmt.Errorf("failed to get server: %w", err))
		}
		return
	}

	sshClient, err := sshDomain.NewClient(srv, c.encryptor, c.hostKeyCallback)
	if err != nil {
		for _, item := range items {
			c.markFailure(ctx, item, now, fmt.Errorf("failed to create ssh client: %w", err))
		}
		return
	}
	defer sshClient.Close()

	if err := sshClient.ConnectContext(connectCtx, srv.Host, srv.Port); err != nil {
		for _, item := range items {
			c.markFailure(ctx, item, now, fmt.Errorf("failed to connect ssh: %w", err))
		}
		return
	}

	raw := sshClient.GetRawConnection()
	if raw == nil {
		for _, item := range items {
			c.markFailure(ctx, item, now, fmt.Errorf("ssh raw connection nil"))
		}
		return
	}

	sftpClient, err := sftpPkg.NewClient(raw)
	if err != nil {
		for _, item := range items {
			c.markFailure(ctx, item, now, fmt.Errorf("failed to create sftp client: %w", err))
		}
		return
	}
	defer sftpClient.Close()

	for _, item := range items {
		select {
		case <-ctx.Done():
			c.markFailure(ctx, item, now, ctx.Err())
			continue
		default:
		}

		if !isValidTrashDir(item.Path) {
			c.markFailure(ctx, item, now, fmt.Errorf("invalid trash dir: %s", item.Path))
			continue
		}

		if err := c.cleanOneTrashDir(ctx, userID, serverID, sftpClient, item.Path, now, policy); err != nil {
			c.markFailure(ctx, item, now, err)
			continue
		}

		nextAttemptAt := now.Add(c.cfg.SuccessCooldown)
		if err := c.repo.MarkSuccess(ctx, item.ID, now, nextAttemptAt); err != nil {
			log.Printf("[TrashCleaner] mark success failed: id=%s, err=%v", item.ID, err)
		}
	}

	// 一致性检查：验证索引中的 active 项是否仍存在于文件系统
	c.validateTrashItemConsistency(ctx, userID, serverID, sftpClient, now)
}

func (c *TrashCleaner) markFailure(ctx context.Context, item TrashDir, now time.Time, err error) {
	failCount := item.FailCount + 1

	// 检查是否超过最大重试次数
	if failCount >= c.cfg.MaxFailCount {
		log.Printf("[TrashCleaner] ALERT: trash dir exceeded max fail count (%d), giving up: path=%s, userID=%s, serverID=%s, lastErr=%v",
			c.cfg.MaxFailCount, item.Path, item.UserID, item.ServerID, err)
		// 标记为永久失败，设置很长的下次尝试时间（实际上不会再尝试）
		nextAttemptAt := now.Add(365 * 24 * time.Hour) // 1年后
		lastErr := "exceeded max fail count"
		if err != nil {
			lastErr = fmt.Sprintf("exceeded max fail count (%d): %s", c.cfg.MaxFailCount, err.Error())
		}
		if len(lastErr) > 2000 {
			lastErr = lastErr[:2000]
		}
		if upErr := c.repo.MarkFailure(ctx, item.ID, failCount, nextAttemptAt, lastErr); upErr != nil {
			log.Printf("[TrashCleaner] mark permanent failure failed: id=%s, err=%v", item.ID, upErr)
		}
		return
	}

	delay := c.backoffDelay(failCount)
	nextAttemptAt := now.Add(delay)

	lastErr := ""
	if err != nil {
		lastErr = err.Error()
	}
	if len(lastErr) > 2000 {
		lastErr = lastErr[:2000]
	}

	if upErr := c.repo.MarkFailure(ctx, item.ID, failCount, nextAttemptAt, lastErr); upErr != nil {
		log.Printf("[TrashCleaner] mark failure failed: id=%s, err=%v", item.ID, upErr)
	}
}

// validateTrashItemConsistency 验证索引与文件系统的一致性
// 检查 active 状态的 TrashItem 是否仍存在于文件系统中
// 对于不存在的项目，标记为 missing
func (c *TrashCleaner) validateTrashItemConsistency(ctx context.Context, userID, serverID uuid.UUID, sftpClient *sftpPkg.Client, now time.Time) {
	if c.itemRepo == nil {
		return
	}

	// 每次最多检查 100 条记录
	const batchSize = 100
	items, err := c.itemRepo.ListActiveByServer(ctx, userID, serverID, batchSize, 0)
	if err != nil {
		log.Printf("[TrashCleaner] consistency check: list failed: user=%s, server=%s, err=%v", userID, serverID, err)
		return
	}

	if len(items) == 0 {
		return
	}

	var missingIDs []uuid.UUID
	for _, item := range items {
		select {
		case <-ctx.Done():
			// 超时，保存当前进度
			if len(missingIDs) > 0 {
				_ = c.itemRepo.MarkMissingBatch(ctx, missingIDs, now)
			}
			return
		default:
		}

		// 检查文件是否存在
		if _, err := sftpClient.Stat(item.TrashPath); err != nil {
			// 文件不存在，标记为 missing
			missingIDs = append(missingIDs, item.ID)
		}
	}

	if len(missingIDs) > 0 {
		if err := c.itemRepo.MarkMissingBatch(ctx, missingIDs, now); err != nil {
			log.Printf("[TrashCleaner] consistency check: mark missing failed: count=%d, err=%v", len(missingIDs), err)
		} else {
			log.Printf("[TrashCleaner] consistency check: marked %d items as missing for server=%s", len(missingIDs), serverID)
		}
	}
}

func (c *TrashCleaner) backoffDelay(failCount int) time.Duration {
	if failCount <= 0 {
		return c.cfg.BaseRetryDelay
	}
	shift := failCount - 1
	if shift > 8 {
		shift = 8
	}
	delay := c.cfg.BaseRetryDelay * time.Duration(1<<shift)
	if delay > c.cfg.MaxRetryDelay {
		delay = c.cfg.MaxRetryDelay
	}
	return delay
}

type trashEntry struct {
	name    string
	full    string
	mod     time.Time
	size    int64
	isDir   bool
	isLink  bool
	version int64 // 索引表中的版本号，用于乐观锁
}

// estimateDirSize 估算目录大小（非递归，仅一层）
// 对于深层目录，我们只计算顶层以避免性能问题
// 如果需要精确大小，可以递归但会增加延迟
func estimateDirSize(ctx context.Context, sftpClient *sftpPkg.Client, dirPath string) int64 {
	return estimateDirSizeWithDepth(ctx, sftpClient, dirPath, 0)
}

// estimateDirSizeWithDepth 带深度限制的目录大小估算
const maxEstimateDirDepth = 3 // 最多递归 3 层，平衡精度和性能

func estimateDirSizeWithDepth(ctx context.Context, sftpClient *sftpPkg.Client, dirPath string, depth int) int64 {
	// 深度保护
	if depth > maxEstimateDirDepth {
		return 0
	}

	entries, err := sftpClient.ReadDir(dirPath)
	if err != nil {
		return 0
	}

	// 大目录保护：超过一定数量时停止递归估算
	const maxEntriesForEstimate = 1000
	if len(entries) > maxEntriesForEstimate && depth > 0 {
		// 简单估算：假设平均文件大小
		var sampleSize int64
		sampleCount := 0
		for i := 0; i < 100 && i < len(entries); i++ {
			if entries[i] != nil && !entries[i].IsDir() {
				sampleSize += entries[i].Size()
				sampleCount++
			}
		}
		if sampleCount > 0 {
			avgSize := sampleSize / int64(sampleCount)
			return avgSize * int64(len(entries))
		}
		return 0
	}

	var total int64
	for _, fi := range entries {
		select {
		case <-ctx.Done():
			return total
		default:
		}

		if fi == nil {
			continue
		}
		name := fi.Name()
		if name == "." || name == ".." {
			continue
		}

		if fi.IsDir() && fi.Mode()&os.ModeSymlink == 0 {
			// 递归估算子目录大小
			subPath := path.Join(dirPath, name)
			total += estimateDirSizeWithDepth(ctx, sftpClient, subPath, depth+1)
		} else if !fi.IsDir() {
			total += fi.Size()
		}
	}
	return total
}

func (c *TrashCleaner) cleanOneTrashDir(ctx context.Context, userID, serverID uuid.UUID, sftpClient *sftpPkg.Client, trashDir string, now time.Time, policy trashPolicy) error {
	entries, err := sftpClient.ReadDir(trashDir)
	if err != nil {
		return fmt.Errorf("readdir failed: %w", err)
	}

	// 大目录警告：超过 10000 条目时记录日志
	const largeDirectoryThreshold = 10000
	if len(entries) > largeDirectoryThreshold {
		log.Printf("[TrashCleaner] WARNING: large trash directory detected: path=%s, entries=%d, userID=%s, serverID=%s",
			trashDir, len(entries), userID, serverID)
	}

	// 构建索引表版本映射（用于乐观锁）
	versionMap := make(map[string]int64)
	if c.itemRepo != nil {
		// 批量获取该目录下所有 active 状态项目的版本号
		// 对于大目录，分批获取以避免内存问题
		batchSize := 500
		offset := 0
		for {
			activeItems, err := c.itemRepo.ListActiveByServer(ctx, userID, serverID, batchSize, offset)
			if err != nil {
				log.Printf("[TrashCleaner] list active items failed: userID=%s, serverID=%s, offset=%d, err=%v", userID, serverID, offset, err)
				break
			}
			if len(activeItems) == 0 {
				break
			}
			for _, item := range activeItems {
				// 只关注当前 trashDir 下的项目
				if strings.HasPrefix(item.TrashPath, trashDir+"/") || item.TrashDir == trashDir {
					versionMap[item.TrashPath] = item.Version
				}
			}
			if len(activeItems) < batchSize {
				break
			}
			offset += batchSize

			// 检查上下文是否已取消
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
		}
	}

	// 预分配合理的容量，避免大量重新分配
	initialCap := len(entries)
	if initialCap > 10000 {
		initialCap = 10000 // 限制初始容量以节省内存
	}
	items := make([]trashEntry, 0, initialCap)
	var totalBytes int64
	for _, fi := range entries {
		if fi == nil {
			continue
		}
		name := fi.Name()
		if name == "." || name == ".." {
			continue
		}
		full := path.Join(trashDir, name)
		isLink := fi.Mode()&os.ModeSymlink != 0
		isDir := fi.IsDir()
		size := fi.Size()
		mod := fi.ModTime()

		// 对于目录，计算其实际占用空间
		if isDir && !isLink {
			size = estimateDirSize(ctx, sftpClient, full)
		}

		items = append(items, trashEntry{
			name:    name,
			full:    full,
			mod:     mod,
			size:    size,
			isDir:   isDir,
			isLink:  isLink,
			version: versionMap[full], // 可能为 0（表示无索引记录）
		})

		// 统计总字节数（包括目录）
		totalBytes += size
	}

	if len(items) == 0 {
		return nil
	}

	sort.Slice(items, func(i, j int) bool {
		// 旧的优先删除；mod 为零值时排前面（更保守）
		mi := items[i].mod
		mj := items[j].mod
		if mi.IsZero() && !mj.IsZero() {
			return true
		}
		if !mi.IsZero() && mj.IsZero() {
			return false
		}
		return mi.Before(mj)
	})

	shouldDelete := make([]trashEntry, 0)

	// 1) 先删超出保留期的
	for _, it := range items {
		if it.mod.IsZero() || now.Sub(it.mod) >= policy.retention {
			shouldDelete = append(shouldDelete, it)
		}
	}

	// 2) 如果仍超过上限，继续删最老的（即便未过期）
	maxEntries := policy.maxEntries
	maxBytes := policy.maxBytes

	remainingEntries := len(items) - len(shouldDelete)
	remainingBytes := totalBytes
	for _, it := range shouldDelete {
		// 现在 size 已包含目录大小，直接减去
		remainingBytes -= it.size
	}

	if (maxEntries > 0 && remainingEntries > maxEntries) || (maxBytes > 0 && remainingBytes > maxBytes) {
		marked := make(map[string]bool, len(shouldDelete))
		for _, it := range shouldDelete {
			marked[it.full] = true
		}
		for _, it := range items {
			if marked[it.full] {
				continue
			}
			shouldDelete = append(shouldDelete, it)
			remainingEntries--
			// 现在 size 已包含目录大小，直接减去
			remainingBytes -= it.size
			if (maxEntries <= 0 || remainingEntries <= maxEntries) && (maxBytes <= 0 || remainingBytes <= maxBytes) {
				break
			}
		}
	}

	if len(shouldDelete) == 0 {
		return nil
	}

	// 限制单次删除数量，避免一次性清理过猛
	if policy.maxDeletesPerDir > 0 && len(shouldDelete) > policy.maxDeletesPerDir {
		shouldDelete = shouldDelete[:policy.maxDeletesPerDir]
	}

	var firstErr error
	for _, it := range shouldDelete {
		select {
		case <-ctx.Done():
			if firstErr == nil {
				firstErr = ctx.Err()
			}
			return firstErr
		default:
		}

		delErr := c.deleteTrashEntryWithLock(ctx, userID, serverID, sftpClient, it)
		if delErr != nil && firstErr == nil {
			firstErr = delErr
		}
	}

	return firstErr
}

// deleteTrashEntryWithLock 使用乐观锁安全删除回收站条目
// 流程：TryMarkPurging -> 物理删除 -> FinishPurge/RollbackPurging
func (c *TrashCleaner) deleteTrashEntryWithLock(ctx context.Context, userID, serverID uuid.UUID, sftpClient *sftpPkg.Client, it trashEntry) error {
	// 保险：只允许删除 .trash 下的条目
	if !strings.Contains(it.full, "/.trash/") && path.Base(path.Dir(it.full)) != ".trash" {
		return fmt.Errorf("refuse to delete outside .trash: %s", it.full)
	}

	// 如果有索引记录，使用乐观锁机制
	if c.itemRepo != nil && it.version > 0 {
		// 步骤1：尝试获取锁（CAS: active -> purging）
		affected, err := c.itemRepo.TryMarkPurging(ctx, userID, serverID, it.full, it.version)
		if err != nil {
			log.Printf("[TrashCleaner] TryMarkPurging failed: path=%s, err=%v", it.full, err)
			return err
		}
		if affected == 0 {
			// 版本不匹配或状态已变更（可能用户正在恢复），跳过
			log.Printf("[TrashCleaner] skipped (version mismatch or status changed): %s", it.full)
			return nil
		}

		// 步骤2：执行物理删除
		delErr := deleteTrashEntryPhysical(ctx, sftpClient, it)

		// 步骤3：根据删除结果更新索引状态
		if delErr != nil {
			// 删除失败，回滚状态
			_ = c.itemRepo.RollbackPurging(ctx, userID, serverID, it.full)
			return delErr
		}

		// 删除成功，完成清理
		now := time.Now()
		_ = c.itemRepo.FinishPurge(ctx, userID, serverID, it.full, now)

		// 审计日志：记录清理器成功清理的项目
		itemType := "file"
		if it.isDir {
			itemType = "directory"
		}
		log.Printf("[TrashCleaner] purged %s: userID=%s, serverID=%s, trashPath=%s, size=%d, timestamp=%s",
			itemType, userID, serverID, it.full, it.size, now.Format(time.RFC3339))
		return nil
	}

	// 无索引记录，直接删除（兼容无索引的旧文件）
	delErr := deleteTrashEntryPhysical(ctx, sftpClient, it)
	if delErr == nil {
		now := time.Now()
		if c.itemRepo != nil {
			// 尝试更新索引（如果存在）
			_ = c.itemRepo.MarkPurgedByTrashPath(ctx, userID, serverID, it.full, now, TrashItemStatusPurged)
		}
		// 审计日志：无索引记录的清理
		itemType := "file"
		if it.isDir {
			itemType = "directory"
		}
		log.Printf("[TrashCleaner] purged unindexed %s: userID=%s, serverID=%s, trashPath=%s, size=%d, timestamp=%s",
			itemType, userID, serverID, it.full, it.size, now.Format(time.RFC3339))
	}
	return delErr
}

// deleteTrashEntryPhysical 执行物理删除操作
func deleteTrashEntryPhysical(ctx context.Context, sftpClient *sftpPkg.Client, it trashEntry) error {
	// 删除前再次检查文件是否存在
	if _, err := sftpClient.Stat(it.full); err != nil {
		// 文件已不存在（可能被恢复或已删除），跳过
		log.Printf("[TrashCleaner] file already gone (possibly restored): %s", it.full)
		return nil
	}

	// 符号链接不要递归，直接删链接本身
	if it.isLink || !it.isDir {
		if err := sftpClient.Remove(it.full); err != nil {
			// 再次检查是否是因为文件不存在
			if os.IsNotExist(err) {
				return nil
			}
			return fmt.Errorf("remove failed: path=%s, err=%w", it.full, err)
		}
		return nil
	}

	if err := removeAllSFTP(ctx, sftpClient, it.full); err != nil {
		return err
	}
	return nil
}

func removeAllSFTP(ctx context.Context, c *sftpPkg.Client, dir string) error {
	return removeAllSFTPWithDepth(ctx, c, dir, 0)
}

// removeAllSFTPWithDepth 带深度限制的递归删除
// maxDepth 用于防止无限递归，同时提供进度日志
const maxRecursionDepth = 50

func removeAllSFTPWithDepth(ctx context.Context, c *sftpPkg.Client, dir string, depth int) error {
	// 深度保护，防止无限递归
	if depth > maxRecursionDepth {
		return fmt.Errorf("max recursion depth exceeded: dir=%s, depth=%d", dir, depth)
	}

	entries, err := c.ReadDir(dir)
	if err != nil {
		// 目录读不了时，尝试直接删
		if rmErr := c.Remove(dir); rmErr == nil {
			return nil
		}
		if rmDirErr := c.RemoveDirectory(dir); rmDirErr == nil {
			return nil
		}
		// 如果是因为不存在，也算成功
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("readdir failed: dir=%s, err=%w", dir, err)
	}

	// 大目录日志提示
	if len(entries) > 100 && depth == 0 {
		log.Printf("[TrashCleaner] removing large directory: %s (%d entries)", dir, len(entries))
	}

	deletedCount := 0
	for _, fi := range entries {
		// 频繁检查上下文，确保能及时响应取消
		select {
		case <-ctx.Done():
			log.Printf("[TrashCleaner] removal interrupted: dir=%s, deleted=%d/%d", dir, deletedCount, len(entries))
			return ctx.Err()
		default:
		}

		if fi == nil {
			continue
		}
		name := fi.Name()
		if name == "." || name == ".." {
			continue
		}
		full := path.Join(dir, name)
		isLink := fi.Mode()&os.ModeSymlink != 0

		if fi.IsDir() && !isLink {
			if err := removeAllSFTPWithDepth(ctx, c, full, depth+1); err != nil {
				return err
			}
			deletedCount++
			continue
		}

		if err := c.Remove(full); err != nil {
			// 如果文件不存在，跳过
			if os.IsNotExist(err) {
				deletedCount++
				continue
			}
			return fmt.Errorf("remove failed: path=%s, err=%w", full, err)
		}
		deletedCount++
	}

	if err := c.RemoveDirectory(dir); err != nil {
		// 如果目录不存在，也算成功
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("remove directory failed: dir=%s, err=%w", dir, err)
	}
	return nil
}

func isValidTrashDir(p string) bool {
	p = path.Clean(p)
	// 允许 /xxx/.trash 或相对 .trash
	if p == ".trash" {
		return true
	}
	// 只需检查路径以 .trash 结尾即可
	return path.Base(p) == ".trash"
}
