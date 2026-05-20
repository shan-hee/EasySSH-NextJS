package password

import (
	"bufio"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const pwnedPasswordRangeEndpoint = "https://api.pwnedpasswords.com/range/"

func PwnedCheckEnabled() bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv("PASSWORD_PWNED_CHECK_ENABLED")))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func IsPwnedPassword(password string) (bool, int, error) {
	sum := sha1.Sum([]byte(password))
	hash := strings.ToUpper(hex.EncodeToString(sum[:]))
	prefix := hash[:5]
	suffix := hash[5:]

	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest(http.MethodGet, pwnedPasswordRangeEndpoint+prefix, nil)
	if err != nil {
		return false, 0, err
	}
	req.Header.Set("Add-Padding", "true")
	req.Header.Set("User-Agent", "EasySSH-Password-Validator")

	resp, err := client.Do(req)
	if err != nil {
		return false, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, 0, fmt.Errorf("pwned password API returned status %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		candidate, countText, ok := strings.Cut(line, ":")
		if !ok || !strings.EqualFold(candidate, suffix) {
			continue
		}
		count, _ := strconv.Atoi(strings.TrimSpace(countText))
		return true, count, nil
	}
	if err := scanner.Err(); err != nil {
		return false, 0, err
	}

	return false, 0, nil
}

func ValidateNotPwned(password string) error {
	if !PwnedCheckEnabled() {
		return nil
	}

	pwned, _, err := IsPwnedPassword(password)
	if err != nil {
		return nil
	}
	if pwned {
		return &ValidationError{
			Code:    "password_pwned",
			Message: "该密码已出现在公开泄露数据中，请更换一个未使用过的新密码",
		}
	}

	return nil
}
