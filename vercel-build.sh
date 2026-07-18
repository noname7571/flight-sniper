#!/bin/bash
set -e
cd backend
npm install --include=dev
npm run build
