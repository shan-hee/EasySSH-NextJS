package monitoring

import (
	"fmt"

	"github.com/easyssh/server/internal/domain/auth"
	"github.com/easyssh/server/internal/domain/server"
	"github.com/easyssh/server/internal/pkg/crypto"
)

// DataSourceFactory 数据源工厂
type DataSourceFactory struct {
	serverService server.Service
	encryptor     *crypto.Encryptor
}

// NewDataSourceFactory 创建数据源工厂
func NewDataSourceFactory(serverService server.Service, encryptor *crypto.Encryptor) *DataSourceFactory {
	return &DataSourceFactory{
		serverService: serverService,
		encryptor:     encryptor,
	}
}

// CreateDataSource 根据用户配置创建数据源
func (f *DataSourceFactory) CreateDataSource(user *auth.User) (DataSourceProvider, error) {
	switch auth.MonitorDataSourceType(user.MonitorDataSource) {
	case auth.MonitorDataSourceEasySSH, "":
		// 默认使用 EasySSH
		return NewEasySSHDataSource(f.serverService, f.encryptor, user.ID), nil

	case auth.MonitorDataSourceNezha:
		if user.NezhaAPIEndpoint == "" {
			return nil, fmt.Errorf("Nezha endpoint is required")
		}
		// 解密 token（如果已加密）
		token := user.NezhaAPIToken
		if token != "" && f.encryptor != nil {
			decrypted, err := f.encryptor.Decrypt(token)
			if err == nil {
				token = decrypted
			}
			// 如果解密失败，假设 token 未加密，直接使用原值
		}
		return NewNezhaDataSource(user.NezhaAPIEndpoint, token), nil

	case auth.MonitorDataSourceKomari:
		if user.KomariAPIEndpoint == "" {
			return nil, fmt.Errorf("Komari endpoint is required")
		}
		// 解密 token（如果已加密）
		token := user.KomariAPIToken
		if token != "" && f.encryptor != nil {
			decrypted, err := f.encryptor.Decrypt(token)
			if err == nil {
				token = decrypted
			}
			// 如果解密失败，假设 token 未加密，直接使用原值
		}
		return NewKomariDataSource(user.KomariAPIEndpoint, token), nil

	default:
		return nil, fmt.Errorf("unsupported data source type: %s", user.MonitorDataSource)
	}
}

// CreateDataSourceFromConfig 根据配置创建数据源（用于测试连接等场景）
func (f *DataSourceFactory) CreateDataSourceFromConfig(config *DataSourceConfig, user *auth.User) (DataSourceProvider, error) {
	switch config.Type {
	case "easyssh", "":
		return NewEasySSHDataSource(f.serverService, f.encryptor, user.ID), nil

	case "nezha":
		if config.Endpoint == "" {
			return nil, fmt.Errorf("Nezha endpoint is required")
		}
		return NewNezhaDataSource(config.Endpoint, config.Token), nil

	case "komari":
		if config.Endpoint == "" {
			return nil, fmt.Errorf("Komari endpoint is required")
		}
		return NewKomariDataSource(config.Endpoint, config.Token), nil

	default:
		return nil, fmt.Errorf("unsupported data source type: %s", config.Type)
	}
}
