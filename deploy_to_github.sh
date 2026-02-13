#!/bin/bash

# Initialize Git
if [ ! -d ".git" ]; then
    git init
    echo "Git repository initialized."
fi

# Add all files
git add .
echo "Files added to Git."

# Commit changes
git commit -m "Initial commit with Traditional Chinese localization"
echo "Changes committed."

# Rename branch to main
git branch -M main

# Add remote
# Check if remote exists
if git remote | grep -q origin; then
    git remote set-url origin https://github.com/henrylin642/LiGARCheck.git
    echo "Remote origin updated."
else
    git remote add origin https://github.com/henrylin642/LiGARCheck.git
    echo "Remote origin added."
fi

# Push to GitHub
# Note: This might require authentication. If it fails, the user will need to run it manually or configure credentials.
echo "Attempting to push to GitHub..."
git push -u origin main
