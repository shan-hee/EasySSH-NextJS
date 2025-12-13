package sftp

import (
	"context"
	"fmt"
	"os"
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/easyssh/server/internal/domain/server"
	sshDomain "github.com/easyssh/server/internal/domain/ssh"
	"github.com/easyssh/server/internal/pkg/crypto"
	"github.com/easyssh/server/internal/pkg/logger"
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
	MaxJobTimeout  time.Duration // 大目录清理的最大超时时间
	BaseRetryDelay time.Duration
	MaxRetryDelay  time.Duration
}

type TrashCleaner struct {
	cfg TrashCleanerConfig
	log *logger.Logger

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
	if cfg.MaxJobTimeout <= 0 {
		cfg.MaxJobTimeout = 10 * time.Minute // 大目录清理最大允许 10 分钟
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
		cfg: cfg,
		log: logger.NewModule("TrashCleaner"),
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
		c.log.Warn("get user settings failed, using defaults",
			logger.String("userID", userID.String()),
			logger.Err(err))
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
		c.log.Info("disabled")
		return
	}
	if c.repo == nil || c.serverService == nil || c.encryptor == nil || c.hostKeyCallback == nil {
		c.log.Warn("missing deps, not started")
		return
	}

	go c.loop()
	c.log.Info("started",
		logger.Duration("interval", c.cfg.Interval),
		logger.Duration("retention", c.cfg.Retention),
		logger.Int("concurrency", c.cfg.Concurrency))
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
		c.log.Error("list due failed", logger.Err(err))
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
			// panic 恢复：防止单个任务的 panic 影响其他任务
			defer func() {
				if r := recover(); r != nil {
					c.log.Error("PANIC recovered in cleanServer",
						logger.String("userID", gk.userID.String()),
						logger.String("serverID", gk.serverID.String()),
						logger.Any("panic", r))
				}
			}()

			// 动态计算超时时间：基于目录数量估算
			// 每个目录基础时间 + 额外缓冲时间
			estimatedTimeout := c.calculateDynamicTimeout(len(items))
			jobCtx, cancel := context.WithTimeout(ctx, estimatedTimeout)
			defer cancel()

			c.cleanServer(jobCtx, gk.userID, gk.serverID, items, now)
		}(gk, items)
	}

	wg.Wait()
}

// calculateDynamicTimeout 根据目录数量动态计算超时时间
func (c *TrashCleaner) calculateDynamicTimeout(dirCount int) time.Duration {
	// 基础超时时间
	baseTimeout := c.cfg.JobTimeout

	// 每个目录额外增加 30 秒
	extraTime := time.Duration(dirCount) * 30 * time.Second

	// 总超时 = 基础 + 额外时间
	totalTimeout := baseTimeout + extraTime

	// 不超过最大超时时间
	if totalTimeout > c.cfg.MaxJobTimeout {
		totalTimeout = c.cfg.MaxJobTimeout
	}

	return totalTimeout
}

func (c *TrashCleaner) cleanServer(ctx context.Context, userID, serverID uuid.UUID, items []TrashDir, now time.Time) {
	policy := c.policyForUser(ctx, userID)
	if !policy.autoClean {
		// 用户关闭了自动清理：不做任何远端操作，只推迟下次尝试，避免重复调度占用资源
		nextAttemptAt := now.Add(c.cfg.SuccessCooldown)
		for _, item := range items {
			if err := c.repo.MarkSkipped(ctx, item.ID, nextAttemptAt, "auto_clean_disabled"); err != nil {
				c.log.Warn("mark skipped failed",
					logger.String("id", item.ID.String()),
					logger.Err(err))
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
			c.log.Warn("mark success failed",
				logger.String("id", item.ID.String()),
				logger.Err(err))
		}
	}

	// 一致性检查：验证索引中的 active 项是否仍存在于文件系统
	c.validateTrashItemConsistency(ctx, userID, serverID, sftpClient, now)
}

func (c *TrashCleaner) markFailure(ctx context.Context, item TrashDir, now time.Time, err error) {
	failCount := item.FailCount + 1

	// 检查是否超过最大重试次数
	if failCount >= c.cfg.MaxFailCount {
		c.log.Error("ALERT: trash dir exceeded max fail count, giving up",
			logger.Int("maxFailCount", c.cfg.MaxFailCount),
			logger.String("path", item.Path),
			logger.String("userID", item.UserID.String()),
			logger.String("serverID", item.ServerID.String()),
			logger.Err(err))
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
			c.log.Error("mark permanent failure failed",
				logger.String("id", item.ID.String()),
				logger.Err(upErr))
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
		c.log.Warn("mark failure failed",
			logger.String("id", item.ID.String()),
			logger.Err(upErr))
	}
}

// validateTrashItemConsistency 验证索引与文件系统的一致性
// 检查 active 状态的 TrashItem 是否仍存在于文件系统中
// 对于不存在的项目，标记为 missing
func (c *TrashCleaner) validateTrashItemConsistency(ctx context.Context, userID, serverID uuid.UUID, sftpClient *sftpPkg.Client, now time.Time) {
	if c.itemRepo == nil {
		return
	}

	const batchSize = 100
	const maxTotalChecks = 1000 // 单次最多检查 1000 条，防止无限循环
	offset := 0
	totalChecked := 0
	var allMissingIDs []uuid.UUID

	for {
		// 检查上下文是否已取消
		select {
		case <-ctx.Done():
			// 超时，保存当前进度
			if len(allMissingIDs) > 0 {
				_ = c.itemRepo.MarkMissingBatch(ctx, allMissingIDs, now)
			}
			return
		default:
		}

		// 检查是否达到最大检查数量
		if totalChecked >= maxTotalChecks {
			c.log.Debug("consistency check: reached max checks limit",
				logger.Int("checked", totalChecked),
				logger.String("serverID", serverID.String()))
			break
		}

		items, err := c.itemRepo.ListActiveByServer(ctx, userID, serverID, batchSize, offset)
		if err != nil {
			c.log.Warn("consistency check: list failed",
				logger.String("userID", userID.String()),
				logger.String("serverID", serverID.String()),
				logger.Int("offset", offset),
				logger.Err(err))
			break
		}

		if len(items) == 0 {
			break
		}

		for _, item := range items {
			select {
			case <-ctx.Done():
				// 超时，保存当前进度
				if len(allMissingIDs) > 0 {
					_ = c.itemRepo.MarkMissingBatch(ctx, allMissingIDs, now)
				}
				return
			default:
			}

			// 检查文件是否存在
			if _, err := sftpClient.Stat(item.TrashPath); err != nil {
				// 文件不存在，标记为 missing
				allMissingIDs = append(allMissingIDs, item.ID)
			}
			totalChecked++
		}

		// 如果本批次数量小于 batchSize，说明没有更多数据了
		if len(items) < batchSize {
			break
		}

		offset += batchSize
	}

	if len(allMissingIDs) > 0 {
		if err := c.itemRepo.MarkMissingBatch(ctx, allMissingIDs, now); err != nil {
			c.log.Warn("consistency check: mark missing failed",
				logger.Int("count", len(allMissingIDs)),
				logger.Err(err))
		} else {
			c.log.Info("consistency check: marked items as missing",
				logger.Int("count", len(allMissingIDs)),
				logger.Int("totalChecked", totalChecked),
				logger.String("serverID", serverID.String()))
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
	name      string
	full      string
	mod       time.Time // 文件系统的 mtime
	deletedAt time.Time // 数据库记录的删除时间（优先使用）
	size      int64
	isDir     bool
	isLink    bool
	version   int64 // 索引表中的版本号，用于乐观锁
}

// effectiveDeletedAt 返回用于过期计算的删除时间
// 优先使用数据库记录的 DeletedAt，如果没有则回退到文件 mtime
func (e *trashEntry) effectiveDeletedAt() time.Time {
	if !e.deletedAt.IsZero() {
		return e.deletedAt
	}
	return e.mod
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
		c.log.Warn("large trash directory detected",
			logger.String("path", trashDir),
			logger.Int("entries", len(entries)),
			logger.String("userID", userID.String()),
			logger.String("serverID", serverID.String()))
	}

	// 构建索引表映射（用于乐观锁和获取准确的删除时间）
	type itemMeta struct {
		version   int64
		deletedAt time.Time
	}
	metaMap := make(map[string]itemMeta)
	if c.itemRepo != nil {
		// 使用 ListActiveByTrashDir 在数据库层面过滤，优化大目录查询性能
		batchSize := 500
		offset := 0
		for {
			activeItems, err := c.itemRepo.ListActiveByTrashDir(ctx, userID, serverID, trashDir, batchSize, offset)
			if err != nil {
				c.log.Warn("list active items failed",
					logger.String("userID", userID.String()),
					logger.String("serverID", serverID.String()),
					logger.String("trashDir", trashDir),
					logger.Int("offset", offset),
					logger.Err(err))
				break
			}
			if len(activeItems) == 0 {
				break
			}
			for _, item := range activeItems {
				metaMap[item.TrashPath] = itemMeta{
					version:   item.Version,
					deletedAt: item.DeletedAt,
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

		// 从数据库记录获取版本号和删除时间
		meta := metaMap[full]

		items = append(items, trashEntry{
			name:      name,
			full:      full,
			mod:       mod,
			deletedAt: meta.deletedAt, // 从数据库获取的删除时间
			size:      size,
			isDir:     isDir,
			isLink:    isLink,
			version:   meta.version, // 可能为 0（表示无索引记录）
		})

		// 统计总字节数（包括目录）
		totalBytes += size
	}

	if len(items) == 0 {
		return nil
	}

	sort.Slice(items, func(i, j int) bool {
		// 旧的优先删除；使用 effectiveDeletedAt 获取准确的删除时间
		mi := items[i].effectiveDeletedAt()
		mj := items[j].effectiveDeletedAt()
		if mi.IsZero() && !mj.IsZero() {
			return true
		}
		if !mi.IsZero() && mj.IsZero() {
			return false
		}
		return mi.Before(mj)
	})

	shouldDelete := make([]trashEntry, 0)

	// 1) 先删超出保留期的（使用 effectiveDeletedAt 获取准确的删除时间）
	for i := range items {
		deletedAt := items[i].effectiveDeletedAt()
		if deletedAt.IsZero() || now.Sub(deletedAt) >= policy.retention {
			shouldDelete = append(shouldDelete, items[i])
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

	// 大目录删除进度日志
	totalToDelete := len(shouldDelete)
	if totalToDelete > 100 {
		c.log.Info("starting large batch delete",
			logger.String("trashDir", trashDir),
			logger.Int("totalItems", totalToDelete),
			logger.String("userID", userID.String()),
			logger.String("serverID", serverID.String()))
	}

	var firstErr error
	deletedCount := 0
	for i, it := range shouldDelete {
		select {
		case <-ctx.Done():
			// 超时时记录进度，便于下次继续
			c.log.Warn("batch delete interrupted due to timeout",
				logger.String("trashDir", trashDir),
				logger.Int("deleted", deletedCount),
				logger.Int("total", totalToDelete),
				logger.Int("remaining", totalToDelete-deletedCount))
			if firstErr == nil {
				firstErr = ctx.Err()
			}
			return firstErr
		default:
		}

		delErr := c.deleteTrashEntryWithLock(ctx, userID, serverID, sftpClient, it)
		if delErr != nil {
			if firstErr == nil {
				firstErr = delErr
			}
		} else {
			deletedCount++
		}

		// 每删除 100 个条目记录一次进度（仅大目录）
		if totalToDelete > 100 && (i+1)%100 == 0 {
			c.log.Debug("batch delete progress",
				logger.String("trashDir", trashDir),
				logger.Int("progress", i+1),
				logger.Int("total", totalToDelete))
		}
	}

	// 完成日志（仅大目录）
	if totalToDelete > 100 {
		c.log.Info("batch delete completed",
			logger.String("trashDir", trashDir),
			logger.Int("deleted", deletedCount),
			logger.Int("total", totalToDelete),
			logger.Int("errors", totalToDelete-deletedCount))
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
			c.log.Warn("TryMarkPurging failed",
				logger.String("path", it.full),
				logger.Err(err))
			return err
		}
		if affected == 0 {
			// 版本不匹配或状态已变更（可能用户正在恢复），跳过
			c.log.Debug("skipped (version mismatch or status changed)",
				logger.String("path", it.full))
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
		c.log.Info("purged item",
			logger.String("type", itemType),
			logger.String("userID", userID.String()),
			logger.String("serverID", serverID.String()),
			logger.String("trashPath", it.full),
			logger.Int64("size", it.size),
			logger.Time("timestamp", now))
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
		c.log.Info("purged unindexed item",
			logger.String("type", itemType),
			logger.String("userID", userID.String()),
			logger.String("serverID", serverID.String()),
			logger.String("trashPath", it.full),
			logger.Int64("size", it.size),
			logger.Time("timestamp", now))
	}
	return delErr
}

// deleteTrashEntryPhysical 执行物理删除操作
func deleteTrashEntryPhysical(ctx context.Context, sftpClient *sftpPkg.Client, it trashEntry) error {
	// 删除前再次检查文件是否存在
	if _, err := sftpClient.Stat(it.full); err != nil {
		// 文件已不存在（可能被恢复或已删除），跳过
		logger.Debug("file already gone (possibly restored)",
			logger.String("path", it.full))
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
		logger.Info("removing large directory",
			logger.String("dir", dir),
			logger.Int("entries", len(entries)))
	}

	deletedCount := 0
	for _, fi := range entries {
		// 频繁检查上下文，确保能及时响应取消
		select {
		case <-ctx.Done():
			logger.Warn("removal interrupted",
				logger.String("dir", dir),
				logger.Int("deleted", deletedCount),
				logger.Int("total", len(entries)))
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
