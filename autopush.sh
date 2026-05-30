#!/bin/bash

git add .

git diff --cached --quiet || {
    git commit -m "Автосохранение $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
}