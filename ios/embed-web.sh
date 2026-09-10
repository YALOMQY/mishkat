#!/bin/sh
# Only runtime assets belong in the signed application, never local credentials or QA files.
set -eu
WEB_SOURCE="${SRCROOT:?}/.."
WEB_DEST="${TARGET_BUILD_DIR:?}/${UNLOCALIZED_RESOURCES_FOLDER_PATH:?}/www"
case "$WEB_DEST" in *.app/www) ;; *) echo "Unexpected application resources path" >&2; exit 1 ;; esac
mkdir -p "$WEB_DEST"
rsync -a --delete --delete-excluded \
  --exclude '.*' --exclude '*.p8' --exclude '*.p12' --exclude '*.pem' --exclude '*.key' --exclude '*.mobileprovision' \
  --include '/index.html' --include '/styles.css' --include '/sw.js' \
  --include '/manifest.webmanifest' --include '/privacy.html' \
  --include '/js/***' --include '/data/***' --include '/assets/***' \
  --include '/fonts/***' --include '/icons/***' --exclude '*' \
  "$WEB_SOURCE/" "$WEB_DEST/"

FIREBASE_CONFIG="$SRCROOT/Mishkat/GoogleService-Info.plist"
if [ -f "$FIREBASE_CONFIG" ]; then
  cp "$FIREBASE_CONFIG" "$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/GoogleService-Info.plist"
  echo "embedded Firebase configuration"
else
  echo "Firebase configuration is absent; push messaging stays disabled"
fi
echo "embedded runtime web app -> $WEB_DEST"
