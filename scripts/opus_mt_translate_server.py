#!/usr/bin/env python3
import argparse
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = None
TOKENIZER = None
REQUIRED_FILES = [
    "config.json",
    "pytorch_model.bin",
    "source.spm",
    "target.spm",
    "tokenizer_config.json",
    "vocab.json",
]


def load_model(model_name):
    global MODEL, TOKENIZER
    if MODEL is None or TOKENIZER is None:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_path = model_name
        if "/" in model_name and not os.path.exists(model_name):
            model_path = ensure_model_files(model_name)
        TOKENIZER = AutoTokenizer.from_pretrained(model_path)
        MODEL = AutoModelForSeq2SeqLM.from_pretrained(model_path)
    return TOKENIZER, MODEL


def ensure_model_files(model_name):
    # ponytail: old transformers/huggingface_hub cannot follow HF relative redirects.
    root = os.environ.get("OPUS_MT_CACHE_DIR") or os.path.join(
        os.path.expanduser("~"), ".cache", "paper-lens", "models"
    )
    model_dir = os.path.join(root, model_name.replace("/", "--"))
    os.makedirs(model_dir, exist_ok=True)
    for filename in REQUIRED_FILES:
        target = os.path.join(model_dir, filename)
        if not os.path.exists(target):
            download_hf_file(model_name, filename, target)
    return model_dir


def download_hf_file(model_name, filename, target):
    import requests

    url = f"https://huggingface.co/{model_name}/resolve/main/{filename}"
    for _ in range(8):
        response = requests.get(url, stream=True, allow_redirects=False, timeout=30)
        if response.status_code not in (301, 302, 303, 307, 308):
            break
        location = response.headers.get("location", "")
        url = f"https://huggingface.co{location}" if location.startswith("/") else location
    response.raise_for_status()
    fd, tmp_path = tempfile.mkstemp(prefix=f"{filename}.", dir=os.path.dirname(target))
    with os.fdopen(fd, "wb") as handle:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)
    os.replace(tmp_path, target)


def translate(text, model_name, max_length, max_new_tokens, target_token):
    import torch

    tokenizer, model = load_model(model_name)
    source = text.strip()
    if target_token and not source.startswith(">>"):
        source = f">>{target_token}<< {source}"
    inputs = tokenizer([source], return_tensors="pt", truncation=True, max_length=max_length)
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=max_new_tokens)
    return tokenizer.batch_decode(output, skip_special_tokens=True)[0].strip()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.respond({"error": "not found"}, 404)
            return
        self.respond({"ok": True, "model": self.server.model_name})

    def do_POST(self):
        if self.path != "/translate":
            self.respond({"error": "not found"}, 404)
            return
        length = int(self.headers.get("content-length", "0") or "0")
        body = json.loads(self.rfile.read(length) or b"{}")
        text = str(body.get("text", "")).strip()
        if not text:
            self.respond({"error": "text is required"}, 400)
            return
        try:
            self.respond({
                "translation": translate(
                    text,
                    self.server.model_name,
                    self.server.max_length,
                    self.server.max_new_tokens,
                    self.server.target_token,
                )
            })
        except Exception as error:
            self.respond({"error": str(error)}, 500)

    def respond(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("TRANSLATION_OPUS_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("TRANSLATION_OPUS_PORT", "8010")))
    parser.add_argument("--model", default=os.environ.get("OPUS_MT_MODEL", "Helsinki-NLP/opus-mt-en-zh"))
    parser.add_argument("--target-token", default=os.environ.get("OPUS_MT_TARGET_TOKEN", "cmn_Hans"))
    parser.add_argument("--max-length", type=int, default=int(os.environ.get("OPUS_MT_MAX_LENGTH", "512")))
    parser.add_argument("--max-new-tokens", type=int, default=int(os.environ.get("OPUS_MT_MAX_NEW_TOKENS", "256")))
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.model_name = args.model
    server.target_token = args.target_token
    server.max_length = args.max_length
    server.max_new_tokens = args.max_new_tokens
    print(f"OPUS-MT translate server listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
