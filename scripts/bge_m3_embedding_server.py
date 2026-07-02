#!/usr/bin/env python3
import argparse
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = None


def load_model(server):
    global MODEL
    if MODEL is None:
        from sentence_transformers import SentenceTransformer

        MODEL = SentenceTransformer(server.model_name, device=server.device)
        MODEL.max_seq_length = server.max_length
    return MODEL


def embed(texts, server):
    model = load_model(server)
    vectors = model.encode(
        texts,
        batch_size=server.batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return [vector.astype(float).tolist() for vector in vectors]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.respond({"error": "not found"}, 404)
            return
        self.respond({
            "ok": True,
            "model": self.server.model_name,
            "device": self.server.device,
            "max_length": self.server.max_length,
            "normalize_embeddings": True,
        })

    def do_POST(self):
        if self.path not in ("/v1/embeddings", "/embeddings"):
            self.respond({"error": "not found"}, 404)
            return
        length = int(self.headers.get("content-length", "0") or "0")
        body = json.loads(self.rfile.read(length) or b"{}")
        inputs = body.get("input", [])
        if isinstance(inputs, str):
            inputs = [inputs]
        if not isinstance(inputs, list) or not all(isinstance(item, str) for item in inputs):
            self.respond({"error": "input must be a string or string array"}, 400)
            return
        try:
            vectors = embed(inputs, self.server)
            self.respond({
                "object": "list",
                "model": self.server.model_name,
                "data": [
                    {"object": "embedding", "index": index, "embedding": vector}
                    for index, vector in enumerate(vectors)
                ],
                "usage": {
                    "prompt_tokens": sum(len(text.split()) for text in inputs),
                    "total_tokens": sum(len(text.split()) for text in inputs),
                },
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
    parser.add_argument("--host", default=os.environ.get("BGE_M3_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("BGE_M3_PORT", "8090")))
    parser.add_argument("--model", default=os.environ.get("BGE_M3_MODEL", "BAAI/bge-m3"))
    parser.add_argument("--device", default=os.environ.get("BGE_M3_DEVICE", "cpu"))
    parser.add_argument("--batch-size", type=int, default=int(os.environ.get("BGE_M3_BATCH_SIZE", "8")))
    parser.add_argument("--max-length", type=int, default=int(os.environ.get("BGE_M3_MAX_LENGTH", "8192")))
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.model_name = args.model
    server.device = args.device
    server.batch_size = args.batch_size
    server.max_length = args.max_length
    print(
        f"BGE-M3 embedding server listening on http://{args.host}:{args.port}/v1 "
        f"model={args.model} device={args.device} max_length={args.max_length}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
