"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModelSource, RuntimeModelSettings } from "@/lib/types";

interface RedactedModelConfig {
  activeMode: RuntimeModelSettings["mode"];
  reviewerSources: ModelSource[];
  local: {
    baseUrl: string;
    selectedModel: string;
    configured: boolean;
  };
  online: {
    baseUrlHost: string;
    selectedModel: string;
    configured: boolean;
    credentialState: "missing" | "present";
    configSource: RuntimeModelSettings["onlineConfigSource"];
  };
}

export function ModelSourceControl({
  value,
  onChange
}: {
  value: RuntimeModelSettings;
  onChange: (settings: RuntimeModelSettings) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [config, setConfig] = useState<RedactedModelConfig | null>(null);
  const [localPort, setLocalPort] = useState(portFromBaseUrl(value.localBaseUrl));
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "testing" | "connected" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const reviewerSources: Array<{ value: ModelSource; label: string }> = [
    { value: "local", label: "Local" },
    { value: "online", label: "Online" }
  ];
  const activeMode = draft.mode;
  const localBaseUrl = useMemo(() => localBaseUrlFromPort(localPort), [localPort]);
  const onlineConfigSource = draft.onlineConfigSource;
  const configuredOnlineBaseUrl = config?.online.baseUrlHost
    ? `http://${config.online.baseUrlHost}`
    : "";

  useEffect(() => {
    setDraft(value);
    setLocalPort(portFromBaseUrl(value.localBaseUrl));
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch("/api/model-config")
      .then((response) => {
        if (!response.ok) throw new Error("Model configuration not available");
        return response.json();
      })
      .then((data: { config: RedactedModelConfig }) => {
        if (cancelled) return;
        if (!data.config) throw new Error("Model configuration not available");
        setConfig(data.config);
        setStatus("idle");
        if (data.config.local.baseUrl) setLocalPort(portFromBaseUrl(data.config.local.baseUrl));
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<RuntimeModelSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange(next);
    if (status === "connected") {
      setStatus("idle");
      setMessage("");
    }
  };

  const selectSource = (source: ModelSource) => {
    update({ mode: source });
    setExpanded(true);
  };

  const updateLocalPort = (port: string) => {
    setLocalPort(port);
    update({
      mode: "local",
      localBaseUrl: localBaseUrlFromPort(port),
      localModel: ""
    });
  };

  const testLocalConnection = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const response = await fetch("/api/model-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "local",
          baseUrl: localBaseUrl
        })
      });
      const data = (await response.json()) as {
        ok: boolean;
        models: string[];
        error: string | null;
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Local model unavailable");
      const selectedModel = data.models[0] ?? value.localModel;
      const next: RuntimeModelSettings = {
        ...draft,
        mode: "local",
        localBaseUrl,
        localModel: selectedModel
      };
      setDraft(next);
      onChange(next);
      setStatus("connected");
      setMessage(selectedModel ? `Connected: ${selectedModel}` : "Connected");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Local model unavailable");
    }
  };

  const testOnlineConnection = async () => {
    setStatus("testing");
    setMessage("");
    try {
      const response = await fetch("/api/model-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "online",
          baseUrl: draft.onlineBaseUrl,
          model: draft.onlineModel,
          configSource: onlineConfigSource,
          apiKey: onlineConfigSource === "manual" ? draft.onlineApiKey : ""
        })
      });
      const data = (await response.json()) as {
        ok: boolean;
        models: string[];
        error: string | null;
        baseUrl?: string;
        selectedModel?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Online model unavailable");
      const selectedModel = data.selectedModel || data.models[0] || draft.onlineModel;
      const next: RuntimeModelSettings = {
        ...draft,
        mode: "online",
        onlineConfigSource,
        onlineBaseUrl: data.baseUrl || draft.onlineBaseUrl,
        onlineModel: selectedModel
      };
      setDraft(next);
      onChange(next);
      setStatus("connected");
      setMessage(selectedModel ? `Connected: ${selectedModel}` : "Connected");
    } catch (error) {
      setStatus("error");
      const detail = error instanceof Error ? error.message : "Online model unavailable";
      const keyStatus = config?.online.credentialState;
      setMessage(keyStatus ? `Server key status: ${keyStatus}. ${detail}` : detail);
    }
  };

  return (
    <section>
      <div role="group" aria-label="Model source" className="grid grid-cols-2 gap-1">
        {reviewerSources.map((source) => (
          <button
            key={source.value}
            type="button"
            aria-pressed={activeMode === source.value}
            onClick={() => selectSource(source.value)}
            className="workbench-tab-button"
          >
            {source.label}
          </button>
        ))}
      </div>
      {expanded && activeMode === "local" ? (
        <div className="mt-3 grid gap-2 border-t border-swiss-rule pt-3">
          <div className="grid gap-1.5">
            <label htmlFor="local-model-port" className="text-xs font-semibold">
              Local port
            </label>
            <input
              id="local-model-port"
              value={localPort}
              onChange={(event) => updateLocalPort(event.target.value)}
              className="border border-swiss-rule px-2 py-1.5 font-mono text-sm"
              inputMode="numeric"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="local-model-name" className="text-xs font-semibold">
              Local model
            </label>
            <input
              id="local-model-name"
              value={draft.localModel}
              onChange={(event) => update({ mode: "local", localModel: event.target.value })}
              className="border border-swiss-rule px-2 py-1.5 text-sm"
              placeholder={config?.local.selectedModel || "Detected after connection test"}
            />
          </div>
          <button
            type="button"
            aria-label="Test local connection"
            onClick={testLocalConnection}
            disabled={status === "testing"}
            className="workbench-button"
          >
            {status === "testing" ? "Testing" : "Test"}
          </button>
        </div>
      ) : null}
      {expanded && activeMode === "online" ? (
        <div className="mt-3 grid gap-2 border-t border-swiss-rule pt-3">
          <div className="grid gap-1.5">
            <label htmlFor="online-credential-source" className="text-xs font-semibold">
              Credential source
            </label>
            <select
              id="online-credential-source"
              value={onlineConfigSource}
              onChange={(event) =>
                update({
                  mode: "online",
                  onlineConfigSource: event.target
                    .value as RuntimeModelSettings["onlineConfigSource"]
                })
              }
              className="border border-swiss-rule bg-white px-2 py-1.5 text-sm"
            >
              <option value="manual">Manual API key</option>
              <option value="env">Configured environment</option>
              <option value="cc_switch">CC switch / Codex config</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="online-base-url" className="text-xs font-semibold">
              Online base URL
            </label>
            <input
              id="online-base-url"
              value={draft.onlineBaseUrl}
              onChange={(event) => update({ mode: "online", onlineBaseUrl: event.target.value })}
              className="border border-swiss-rule px-2 py-1.5 text-sm"
              placeholder={configuredOnlineBaseUrl || "https://api.openai.com/v1"}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="online-model-name" className="text-xs font-semibold">
              Online model
            </label>
            <input
              id="online-model-name"
              value={draft.onlineModel}
              onChange={(event) => update({ mode: "online", onlineModel: event.target.value })}
              className="border border-swiss-rule px-2 py-1.5 text-sm"
              placeholder={config?.online.selectedModel || "Detected after connection test"}
            />
          </div>
          {onlineConfigSource === "manual" ? (
            <div className="grid gap-1.5">
              <label htmlFor="online-manual-api-key" className="text-xs font-semibold">
                Manual API key
              </label>
              <input
                id="online-manual-api-key"
                type="password"
                value={draft.onlineApiKey}
                onChange={(event) => update({ mode: "online", onlineApiKey: event.target.value })}
                className="border border-swiss-rule px-2 py-1.5 text-sm"
                autoComplete="off"
              />
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Test online connection"
            onClick={testOnlineConnection}
            disabled={status === "testing"}
            className="workbench-button"
          >
            {status === "testing" ? "Testing" : "Test"}
          </button>
          <p className="border-t border-swiss-rule pt-2 text-xs text-swiss-muted">
            Server key status: {config?.online.credentialState ?? "unknown"}
            {onlineConfigSource !== "manual" && config?.online.selectedModel
              ? ` / ${config.online.selectedModel}`
              : ""}
          </p>
        </div>
      ) : null}
      {expanded && message ? (
        <p className={status === "error" ? "mt-3 text-sm text-swiss-red" : "mt-3 text-sm text-swiss-ink"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

function portFromBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).port || "80";
  } catch {
    return "8000";
  }
}

function localBaseUrlFromPort(port: string): string {
  return `http://localhost:${port.trim() || "8000"}/v1`;
}
