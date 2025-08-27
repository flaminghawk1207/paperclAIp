#!/bin/bash

echo "🚀 Packaging PaperclAIp Desktop Application..."

# Build the application first
echo "📦 Building application..."
npm run build

# Create package directory
PACKAGE_DIR="PaperclAIp.app"
CONTENTS_DIR="$PACKAGE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# Clean up previous package
rm -rf "$PACKAGE_DIR"

# Create directory structure
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Copy Electron binary
echo "🔧 Copying Electron binary..."
cp -r "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" "$MACOS_DIR/PaperclAIp"

# Copy Electron frameworks
echo "📚 Copying Electron frameworks..."
cp -r "node_modules/electron/dist/Electron.app/Contents/Frameworks" "$CONTENTS_DIR/"

# Copy app resources
echo "📁 Copying app resources..."
cp -r "dist" "$RESOURCES_DIR/"
cp -r "dist-electron" "$RESOURCES_DIR/"
cp -r "assets" "$RESOURCES_DIR/"

# Create Info.plist
echo "📋 Creating Info.plist..."
cat > "$CONTENTS_DIR/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PaperclAIp</string>
    <key>CFBundleIdentifier</key>
    <string>com.paperclaip.app</string>
    <key>CFBundleName</key>
    <string>PaperclAIp</string>
    <key>CFBundleDisplayName</key>
    <string>PaperclAIp</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Create PkgInfo
echo "📦 Creating PkgInfo..."
echo "APPL????" > "$CONTENTS_DIR/PkgInfo"

# Copy icon
cp "assets/icon.icns" "$RESOURCES_DIR/"

# Make the app executable
chmod +x "$MACOS_DIR/PaperclAIp"

echo "✅ Packaging complete! Your app is ready at: $PACKAGE_DIR"
echo "🎯 You can now double-click on PaperclAIp.app to run it!"
echo "📁 To move it to Applications: cp -r $PACKAGE_DIR /Applications/"
