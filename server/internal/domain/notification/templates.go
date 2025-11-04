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
