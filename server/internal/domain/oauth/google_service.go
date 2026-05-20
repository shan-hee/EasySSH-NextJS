package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleUserInfo Google 用户信息
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

// GoogleService Google OAuth 服务
type GoogleService struct {
	clientID     string
	clientSecret string
	redirectURI  string
}

// NewGoogleService 创建 Google OAuth 服务
func NewGoogleService(clientID, clientSecret, redirectURI string) *GoogleService {
	return &GoogleService{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
	}
}

// GetOAuthConfig 获取 OAuth 配置
func (s *GoogleService) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.clientID,
		ClientSecret: s.clientSecret,
		RedirectURL:  s.redirectURI,
		Scopes: []string{
			"openid",
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

// ExchangeCode 使用授权码和 PKCE verifier 换取 Google ID Token，并返回已验证的用户信息。
func (s *GoogleService) ExchangeCode(ctx context.Context, code, codeVerifier string) (*GoogleUserInfo, error) {
	code = strings.TrimSpace(code)
	codeVerifier = strings.TrimSpace(codeVerifier)
	if code == "" {
		return nil, fmt.Errorf("authorization code is required")
	}
	if codeVerifier == "" {
		return nil, fmt.Errorf("code verifier is required")
	}

	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)

	token, err := s.GetOAuthConfig().Exchange(ctx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		return nil, fmt.Errorf("failed to exchange authorization code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return nil, fmt.Errorf("missing id token in token response")
	}

	return s.VerifyIDToken(ctx, rawIDToken)
}

// VerifyIDToken 验证 Google ID Token 并获取用户信息
func (s *GoogleService) VerifyIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, httpClient)

	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, fmt.Errorf("failed to create oidc provider: %w", err)
	}

	verifier := provider.Verifier(&oidc.Config{
		ClientID: s.clientID,
	})

	verifiedToken, err := verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id token: %w", err)
	}

	var claims struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Locale        string `json:"locale"`
	}

	if err := verifiedToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to decode id token claims: %w", err)
	}

	if claims.Sub == "" {
		return nil, fmt.Errorf("id token missing subject")
	}
	if claims.Email == "" {
		return nil, fmt.Errorf("id token missing email")
	}

	return &GoogleUserInfo{
		ID:            claims.Sub,
		Email:         claims.Email,
		VerifiedEmail: claims.EmailVerified,
		Name:          claims.Name,
		GivenName:     claims.GivenName,
		FamilyName:    claims.FamilyName,
		Picture:       claims.Picture,
		Locale:        claims.Locale,
	}, nil
}

// GetUserInfo 通过 access token 获取用户信息
func (s *GoogleService) GetUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	url := "https://www.googleapis.com/oauth2/v2/userinfo"

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get user info: %s", string(body))
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &userInfo, nil
}
