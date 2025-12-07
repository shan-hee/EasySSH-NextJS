package geoip

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/easyssh/server/internal/infra/cache"
)

const (
	// Redis 缓存 key 前缀
	redisCacheKeyPrefix = "geoip:"
	// 缓存过期时间
	cacheTTL = 24 * time.Hour
)

// Location 地理位置信息
type Location struct {
	Country     string `json:"country"`      // 国家
	CountryCode string `json:"country_code"` // 国家代码
	Region      string `json:"region"`       // 地区/省份
	City        string `json:"city"`         // 城市
}

// String 返回格式化的地理位置字符串
func (l *Location) String() string {
	if l == nil {
		return ""
	}
	if l.City != "" && l.Region != "" {
		return fmt.Sprintf("%s, %s", l.City, l.Region)
	}
	if l.City != "" {
		return l.City
	}
	if l.Region != "" {
		return l.Region
	}
	return l.Country
}

// Client GeoIP 客户端
type Client struct {
	httpClient  *http.Client
	redisClient *cache.RedisClient
}

// 全局单例
var (
	defaultClient *Client
	once          sync.Once
)

// NewClient 创建 GeoIP 客户端（返回全局单例）
// 注意：必须先调用 SetRedisClient 设置 Redis 客户端
func NewClient() *Client {
	once.Do(func() {
		defaultClient = &Client{
			httpClient: &http.Client{
				Timeout: 5 * time.Second,
			},
		}
	})
	return defaultClient
}

// SetRedisClient 设置 Redis 客户端（应用启动时调用）
func SetRedisClient(redisClient *cache.RedisClient) {
	if defaultClient == nil {
		NewClient()
	}
	defaultClient.redisClient = redisClient
}

// Lookup 查询 IP 地理位置
func (c *Client) Lookup(ctx context.Context, ipOrHost string) (*Location, error) {
	// 解析主机名到 IP
	ip := ipOrHost
	if net.ParseIP(ipOrHost) == nil {
		// 不是有效 IP，尝试解析域名
		ips, err := net.LookupIP(ipOrHost)
		if err != nil || len(ips) == 0 {
			return nil, fmt.Errorf("failed to resolve host: %s", ipOrHost)
		}
		// 优先使用 IPv4
		for _, addr := range ips {
			if addr.To4() != nil {
				ip = addr.String()
				break
			}
		}
		if ip == ipOrHost {
			ip = ips[0].String()
		}
	}

	// 检查是否为私有 IP
	if isPrivateIP(ip) {
		return &Location{
			Country:     "Private Network",
			CountryCode: "LAN",
			Region:      "",
			City:        "",
		}, nil
	}

	// 1. 查 Redis 缓存
	if loc := c.getFromRedis(ctx, ip); loc != nil {
		return loc, nil
	}

	// 2. 查询外部 API
	location, err := c.queryIPAPI(ctx, ip)
	if err != nil {
		return nil, err
	}

	// 3. 写入 Redis 缓存
	c.setToRedis(ctx, ip, location)

	return location, nil
}

// getFromRedis 从 Redis 获取
func (c *Client) getFromRedis(ctx context.Context, ip string) *Location {
	if c.redisClient == nil {
		return nil
	}

	key := redisCacheKeyPrefix + ip
	data, err := c.redisClient.Get(ctx, key)
	if err != nil {
		return nil
	}

	var loc Location
	if err := json.Unmarshal([]byte(data), &loc); err != nil {
		return nil
	}

	return &loc
}

// setToRedis 写入 Redis
func (c *Client) setToRedis(ctx context.Context, ip string, loc *Location) {
	if c.redisClient == nil {
		return
	}

	data, err := json.Marshal(loc)
	if err != nil {
		return
	}

	key := redisCacheKeyPrefix + ip
	_ = c.redisClient.Set(ctx, key, string(data), cacheTTL)
}

// queryIPAPI 使用 ip-api.com 查询
func (c *Client) queryIPAPI(ctx context.Context, ip string) (*Location, error) {
	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,message,country,countryCode,regionName,city", ip)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Status      string `json:"status"`
		Message     string `json:"message"`
		Country     string `json:"country"`
		CountryCode string `json:"countryCode"`
		RegionName  string `json:"regionName"`
		City        string `json:"city"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("ip-api error: %s", result.Message)
	}

	return &Location{
		Country:     result.Country,
		CountryCode: result.CountryCode,
		Region:      result.RegionName,
		City:        result.City,
	}, nil
}

// isPrivateIP 检查是否为私有 IP
func isPrivateIP(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	// 检查是否为私有地址
	privateBlocks := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}

	for _, block := range privateBlocks {
		_, cidr, err := net.ParseCIDR(block)
		if err != nil {
			continue
		}
		if cidr.Contains(ip) {
			return true
		}
	}

	return false
}
