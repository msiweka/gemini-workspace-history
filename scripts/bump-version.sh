#!/bin/bash

# Get the latest tag matching v*
LATEST_TAG=$(git tag -l "v*" | sort -V | tail -n1)

if [ -z "$LATEST_TAG" ]; then
    echo "No tags found, starting from v0.0.0"
    LATEST_TAG="v0.0.0"
fi

echo "Latest tag found: $LATEST_TAG"

# Remove the 'v' prefix
VERSION=${LATEST_TAG#v}

# Split version into parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# Ensure patch is treated as a number
PATCH=${PATCH:-0}

# Bump patch ONLY
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

echo "New version (patch bump): $NEW_VERSION"

# Update package.json using sed
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update gemini-extension.json
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" gemini-extension.json

echo "Updated package.json and gemini-extension.json"
