package main

import (
	"embed"

	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main initializes the desktop shell. The first screen is the SSH/SFTP workspace;
// Dashboard navigation and server administration stay outside this window shell.
func main() {
	activityLogService := NewActivityLogService()

	app := application.New(application.Options{
		Name:        "EasySSH",
		Description: "EasySSH Desktop",
		Services: []application.Service{
			application.NewService(&DesktopService{}),
			application.NewService(activityLogService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "EasySSH",
		Width:     1180,
		Height:    760,
		MinWidth:  960,
		MinHeight: 620,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(13, 17, 23),
		URL:              "/",
	})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
