#!/bin/bash

# 开发模式启动脚本 - 支持热重载

echo "🔥 Starting EasySSH Server in Development Mode with Hot Reload..."
echo "📝 File changes will automatically trigger rebuild"
echo ""

# 使用air进行热重载
/root/go/bin/air
