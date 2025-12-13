package notification

// 登录通知邮件模板
const loginTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .info-box {
            background-color: #f8fafc;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .info-item {
            margin: 8px 0;
        }
        .info-label {
            font-weight: 600;
            color: #64748b;
            display: inline-block;
            min-width: 100px;
        }
        .warning {
            background-color: #fef3c7;
            border-left-color: #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 新设备登录通知</h1>
        </div>

        <div class="content">
            <p>您好，<strong>{{.Username}}</strong>：</p>

            <p>我们检测到您的账户在新设备上登录，详细信息如下：</p>

            <div class="info-box">
                <div class="info-item">
                    <span class="info-label">登录时间：</span>
                    <span>{{.LoginTime}}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">IP 地址：</span>
                    <span>{{.IPAddress}}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">地理位置：</span>
                    <span>{{.Location}}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">设备信息：</span>
                    <span>{{.DeviceInfo}}</span>
                </div>
            </div>

            <div class="warning">
                <strong>⚠️ 安全提示：</strong>
                <p style="margin: 10px 0 0 0;">如果这不是您本人的操作，请立即修改密码并启用双因子认证以保护您的账户安全。</p>
            </div>
        </div>

        <div class="footer">
            <p>此邮件由 EasySSH 系统自动发送，请勿直接回复。</p>
            <p style="margin: 5px 0;">© 2024 EasySSH. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// 告警通知邮件模板
const alertTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #dc2626;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .alert-box {
            background-color: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .info-item {
            margin: 8px 0;
        }
        .info-label {
            font-weight: 600;
            color: #64748b;
            display: inline-block;
            min-width: 100px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ 系统告警通知</h1>
        </div>

        <div class="content">
            <p>您好，<strong>{{.Username}}</strong>：</p>

            <p>您的系统触发了以下告警：</p>

            <div class="alert-box">
                <div class="info-item">
                    <span class="info-label">告警时间：</span>
                    <span>{{.AlertTime}}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">告警类型：</span>
                    <span>{{.AlertType}}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">告警内容：</span>
                    <span>{{.AlertMessage}}</span>
                </div>
            </div>

            <p>请及时登录系统查看详细信息并处理相关问题。</p>
        </div>

        <div class="footer">
            <p>此邮件由 EasySSH 系统自动发送，请勿直接回复。</p>
            <p style="margin: 5px 0;">© 2024 EasySSH. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// 欢迎邮件模板
const welcomeTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #16a34a;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .features {
            background-color: #f0fdf4;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .feature-item {
            margin: 10px 0;
            padding-left: 25px;
            position: relative;
        }
        .feature-item:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #16a34a;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 欢迎使用 EasySSH</h1>
        </div>

        <div class="content">
            <p>您好，<strong>{{.Username}}</strong>：</p>

            <p>欢迎加入 EasySSH！您的账户已成功创建。</p>

            <div class="features">
                <h3 style="margin-top: 0; color: #16a34a;">您可以开始使用以下功能：</h3>
                <div class="feature-item">管理多个 SSH 服务器连接</div>
                <div class="feature-item">执行批量命令和脚本</div>
                <div class="feature-item">文件传输和管理</div>
                <div class="feature-item">实时监控和告警</div>
                <div class="feature-item">安全的双因子认证</div>
            </div>

            <p>为了确保账户安全，我们建议您：</p>
            <ul>
                <li>设置一个强密码</li>
                <li>启用双因子认证</li>
                <li>定期检查登录活动</li>
            </ul>
        </div>

        <div class="footer">
            <p>此邮件由 EasySSH 系统自动发送，请勿直接回复。</p>
            <p style="margin: 5px 0;">© 2024 EasySSH. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// 2FA 启用通知模板
const twoFAEnabledTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #7c3aed;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .success-box {
            background-color: #f0fdf4;
            border-left: 4px solid #16a34a;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 双因子认证已启用</h1>
        </div>

        <div class="content">
            <p>您好，<strong>{{.Username}}</strong>：</p>

            <div class="success-box">
                <p style="margin: 0;"><strong>✓ 双因子认证已成功启用</strong></p>
                <p style="margin: 10px 0 0 0;">启用时间：{{.Time}}</p>
            </div>

            <p>从现在开始，登录时除了密码外，还需要提供认证应用生成的 6 位验证码。</p>

            <p><strong>重要提示：</strong></p>
            <ul>
                <li>请妥善保管您的备份码，以备紧急情况使用</li>
                <li>如果更换手机，请先禁用并重新启用 2FA</li>
                <li>丢失认证器访问权限时，可使用备份码登录</li>
            </ul>
        </div>

        <div class="footer">
            <p>此邮件由 EasySSH 系统自动发送，请勿直接回复。</p>
            <p style="margin: 5px 0;">© 2024 EasySSH. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// 密码修改通知模板
const passwordChangedTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            color: #ea580c;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .info-box {
            background-color: #fff7ed;
            border-left: 4px solid #ea580c;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .warning {
            background-color: #fef3c7;
            border-left-color: #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            color: #64748b;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔑 密码已修改</h1>
        </div>

        <div class="content">
            <p>您好，<strong>{{.Username}}</strong>：</p>

            <div class="info-box">
                <p style="margin: 0;"><strong>您的账户密码已成功修改</strong></p>
                <p style="margin: 10px 0 0 0;">修改时间：{{.ChangeTime}}</p>
            </div>

            <div class="warning">
                <strong>⚠️ 安全提示：</strong>
                <p style="margin: 10px 0 0 0;">如果这不是您本人的操作，请立即联系管理员处理。您的账户可能已被他人访问。</p>
            </div>

            <p>为了确保账户安全，建议您：</p>
            <ul>
                <li>检查最近的登录活动</li>
                <li>启用双因子认证</li>
                <li>定期更换密码</li>
            </ul>
        </div>

        <div class="footer">
            <p>此邮件由 EasySSH 系统自动发送，请勿直接回复。</p>
            <p style="margin: 5px 0;">© 2024 EasySSH. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// 验证码邮件模板
const verificationCodeTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
        }
        .container {
            background-color: #ffffff;
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 40px 30px;
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 16px;
            color: #475569;
            margin-bottom: 20px;
        }
        .code-box {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 2px dashed #cbd5e1;
            text-align: center;
            padding: 40px 20px;
            margin: 30px 0;
            border-radius: 12px;
            position: relative;
        }
        .code-label {
            font-size: 14px;
            color: #64748b;
            font-weight: 500;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .code {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 12px;
            color: #6366f1;
            margin: 15px 0;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
            text-shadow: 0 2px 4px rgba(99, 102, 241, 0.1);
        }
        .expiry {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            color: #64748b;
            margin-top: 15px;
            padding: 8px 16px;
            background: white;
            border-radius: 20px;
            font-weight: 500;
        }
        .info-section {
            background-color: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }
        .info-section h3 {
            color: #1e40af;
            font-size: 15px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .info-section ul {
            margin: 0;
            padding-left: 20px;
            color: #475569;
        }
        .info-section li {
            margin: 8px 0;
            font-size: 14px;
        }
        .warning {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }
        .warning-title {
            color: #92400e;
            font-weight: 600;
            font-size: 15px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .warning p {
            color: #78350f;
            font-size: 14px;
            margin: 0;
            line-height: 1.6;
        }
        .footer {
            background-color: #f8fafc;
            text-align: center;
            padding: 30px;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            color: #64748b;
            font-size: 13px;
            margin: 5px 0;
        }
        .footer-brand {
            color: #475569;
            font-weight: 600;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <div class="header-icon">✉️</div>
                <h1>邮箱验证码</h1>
            </div>

            <div class="content">
                <p class="greeting">您好：</p>

                <p style="color: #475569; margin-bottom: 25px;">
                    您正在注册 <strong>{{.SystemName}}</strong> 账户，请使用以下验证码完成注册：
                </p>

                <div class="code-box">
                    <div class="code-label">您的验证码</div>
                    <div class="code">{{.Code}}</div>
                    <div class="expiry">
                        <span>⏱</span>
                        <span>有效期：5 分钟</span>
                    </div>
                </div>

                <div class="info-section">
                    <h3>📌 使用说明</h3>
                    <ul>
                        <li>请在注册页面输入此验证码</li>
                        <li>验证码 5 分钟内有效</li>
                        <li>每个验证码只能使用一次</li>
                    </ul>
                </div>

                <div class="warning">
                    <div class="warning-title">
                        <span>⚠️</span>
                        <span>安全提示</span>
                    </div>
                    <p>如果这不是您的操作，请忽略此邮件。请勿将验证码透露给任何人。</p>
                </div>
            </div>

            <div class="footer">
                <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
                <p class="footer-brand">© {{.CurrentYear}} {{.SystemName}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
`

// 密码重置验证码邮件模板
const passwordResetTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);
            padding: 40px 20px;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
        }
        .container {
            background-color: #ffffff;
            border-radius: 16px;
            padding: 0;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);
            color: white;
            text-align: center;
            padding: 40px 30px;
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        .header h1 {
            color: white;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 16px;
            color: #475569;
            margin-bottom: 20px;
        }
        .code-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
            border: 2px dashed #f59e0b;
            text-align: center;
            padding: 40px 20px;
            margin: 30px 0;
            border-radius: 12px;
            position: relative;
        }
        .code-label {
            font-size: 14px;
            color: #92400e;
            font-weight: 500;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .code {
            font-size: 48px;
            font-weight: 700;
            letter-spacing: 12px;
            color: #dc2626;
            margin: 15px 0;
            font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
            text-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);
        }
        .expiry {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            color: #92400e;
            margin-top: 15px;
            padding: 8px 16px;
            background: white;
            border-radius: 20px;
            font-weight: 500;
        }
        .info-section {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }
        .info-section h3 {
            color: #92400e;
            font-size: 15px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .info-section ul {
            margin: 0;
            padding-left: 20px;
            color: #78350f;
        }
        .info-section li {
            margin: 8px 0;
            font-size: 14px;
        }
        .warning {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border-left: 4px solid #dc2626;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }
        .warning-title {
            color: #991b1b;
            font-weight: 600;
            font-size: 15px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .warning p {
            color: #7f1d1d;
            font-size: 14px;
            margin: 0;
            line-height: 1.6;
        }
        .footer {
            background-color: #f8fafc;
            text-align: center;
            padding: 30px;
            border-top: 1px solid #e2e8f0;
        }
        .footer p {
            color: #64748b;
            font-size: 13px;
            margin: 5px 0;
        }
        .footer-brand {
            color: #475569;
            font-weight: 600;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <div class="header-icon">🔑</div>
                <h1>密码重置验证码</h1>
            </div>

            <div class="content">
                <p class="greeting">您好：</p>

                <p style="color: #475569; margin-bottom: 25px;">
                    您正在重置 <strong>{{.SystemName}}</strong> 账户密码，请使用以下验证码完成密码重置：
                </p>

                <div class="code-box">
                    <div class="code-label">您的验证码</div>
                    <div class="code">{{.Code}}</div>
                    <div class="expiry">
                        <span>⏱</span>
                        <span>有效期：5 分钟</span>
                    </div>
                </div>

                <div class="info-section">
                    <h3>📌 使用说明</h3>
                    <ul>
                        <li>请在密码重置页面输入此验证码</li>
                        <li>验证码 5 分钟内有效</li>
                        <li>每个验证码只能使用一次</li>
                    </ul>
                </div>

                <div class="warning">
                    <div class="warning-title">
                        <span>⚠️</span>
                        <span>安全提示</span>
                    </div>
                    <p>如果这不是您的操作，请立即登录系统修改密码并启用双因子认证。您的账户可能存在安全风险。</p>
                </div>
            </div>

            <div class="footer">
                <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
                <p class="footer-brand">© {{.CurrentYear}} {{.SystemName}}. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
`

// 新设备登录告警模板
const newDeviceAlertTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
        .header h1 { color: #f59e0b; margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-item { margin: 8px 0; }
        .info-label { font-weight: 600; color: #64748b; display: inline-block; width: 100px; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🆕 新设备登录告警</h1>
        </div>
        <div class="content">
            <p>尊敬的 <strong>{{.Username}}</strong>，</p>
            <p>我们检测到您的账户在一个新设备上登录：</p>
            <div class="info-box">
                <div class="info-item"><span class="info-label">设备名称：</span>{{.DeviceName}}</div>
                <div class="info-item"><span class="info-label">IP 地址：</span>{{.IPAddress}}</div>
                <div class="info-item"><span class="info-label">地理位置：</span>{{.Location}}</div>
                <div class="info-item"><span class="info-label">登录时间：</span>{{.LoginTime}}</div>
            </div>
            <p>如果这是您本人的操作，请忽略此邮件。如果不是，请立即修改密码并检查账户安全。</p>
        </div>
        <div class="footer">
            <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
        </div>
    </div>
</body>
</html>
`

// 新地点登录告警模板
const newLocationAlertTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
        .header h1 { color: #3b82f6; margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-item { margin: 8px 0; }
        .info-label { font-weight: 600; color: #64748b; display: inline-block; width: 100px; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📍 新地点登录告警</h1>
        </div>
        <div class="content">
            <p>尊敬的 <strong>{{.Username}}</strong>，</p>
            <p>我们检测到您的账户在一个新的地理位置登录：</p>
            <div class="info-box">
                <div class="info-item"><span class="info-label">地理位置：</span>{{.Location}}</div>
                <div class="info-item"><span class="info-label">IP 地址：</span>{{.IPAddress}}</div>
                <div class="info-item"><span class="info-label">登录时间：</span>{{.LoginTime}}</div>
            </div>
            <p>如果这是您本人的操作，请忽略此邮件。如果不是，请立即修改密码并检查账户安全。</p>
        </div>
        <div class="footer">
            <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
        </div>
    </div>
</body>
</html>
`

// 可疑登录告警模板
const suspiciousLoginAlertTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
        .header h1 { color: #ef4444; margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-item { margin: 8px 0; }
        .info-label { font-weight: 600; color: #64748b; display: inline-block; width: 100px; }
        .warning { background-color: #fef2f2; padding: 15px; border-radius: 4px; margin-top: 15px; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ 可疑登录告警</h1>
        </div>
        <div class="content">
            <p>尊敬的 <strong>{{.Username}}</strong>，</p>
            <p>我们检测到您的账户存在可疑登录行为：</p>
            <div class="info-box">
                <div class="info-item"><span class="info-label">告警原因：</span>{{.Reason}}</div>
                <div class="info-item"><span class="info-label">IP 地址：</span>{{.IPAddress}}</div>
                <div class="info-item"><span class="info-label">地理位置：</span>{{.Location}}</div>
                <div class="info-item"><span class="info-label">登录时间：</span>{{.LoginTime}}</div>
            </div>
            <div class="warning">
                <p><strong>建议操作：</strong></p>
                <ul>
                    <li>如果这不是您的操作，请立即修改密码</li>
                    <li>启用双因子认证以增强账户安全</li>
                    <li>检查账户的登录历史记录</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
        </div>
    </div>
</body>
</html>
`

// 账户锁定告警模板
const accountLockedAlertTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
        .header h1 { color: #dc2626; margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .info-item { margin: 8px 0; }
        .info-label { font-weight: 600; color: #64748b; display: inline-block; width: 100px; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #f0f0f0; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 账户已锁定</h1>
        </div>
        <div class="content">
            <p>尊敬的 <strong>{{.Username}}</strong>，</p>
            <p>由于安全原因，您的账户已被临时锁定：</p>
            <div class="info-box">
                <div class="info-item"><span class="info-label">锁定原因：</span>{{.Reason}}</div>
                <div class="info-item"><span class="info-label">解锁时间：</span>{{.UnlockTime}}</div>
            </div>
            <p>账户将在上述时间后自动解锁。如果您认为这是误操作，请联系系统管理员。</p>
        </div>
        <div class="footer">
            <p>此邮件由 {{.SystemName}} 系统自动发送，请勿直接回复。</p>
        </div>
    </div>
</body>
</html>
`
