#!/usr/bin/env bash
set -euo pipefail

env_name="lit_reviewer"
env_file="environment.local.yml"

if ! command -v conda >/dev/null 2>&1; then
  echo "Conda is required. Install Miniconda or Anaconda, then rerun npm run setup:local."
  exit 1
fi

if conda run -n "$env_name" python --version >/dev/null 2>&1; then
  echo "Updating conda environment: $env_name"
  conda env update -n "$env_name" -f "$env_file"
else
  echo "Creating conda environment: $env_name"
  conda env create -f "$env_file"
fi

conda run -n "$env_name" python -c \
  "import requests, sacremoses, sentence_transformers, sentencepiece, torch, transformers"

echo "Local AI environment is ready."
echo "Start with: npm run dev:local:cpu"
echo "GPU embedding: npm run dev:local:gpu"
