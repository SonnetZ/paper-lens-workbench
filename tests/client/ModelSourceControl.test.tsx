import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeModelSettings } from "@/lib/types";
import { ModelSourceControl } from "@/components/ModelSourceControl";

describe("ModelSourceControl", () => {
  it("shows Local and Online but not Mock as selectable choices", async () => {
    const fetchMock = vi.fn(async () => Response.json({ config: redactedConfig() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelSourceControl value={defaultSettings()} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Online" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand model settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Development mode: mock responses")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show model settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Select Local or Online")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Local port")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Model source" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/model-config"));
  });

  it("loads redacted config and tests the local provider with /models only", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/model-config") {
        return Response.json({ config: redactedConfig({ onlineHost: "api.openai.com" }) });
      }
      if (url === "/api/model-config/test" && init?.method === "POST") {
        return Response.json({ ok: true, models: ["qwen-local"], error: null });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelSourceControl value={defaultSettings()} onChange={onChange} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/model-config"));
    await userEvent.click(screen.getByRole("button", { name: "Local" }));
    await userEvent.clear(screen.getByLabelText("Local port"));
    await userEvent.type(screen.getByLabelText("Local port"), "8017");
    await userEvent.click(screen.getByRole("button", { name: "Test local connection" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-config/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "local",
            baseUrl: "http://localhost:8017/v1"
          })
        })
      );
    });
    expect(await screen.findByText("Connected: qwen-local")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "local",
        localBaseUrl: "http://localhost:8017/v1",
        localModel: "qwen-local"
      })
    );
  });

  it("lets reviewers choose manual, environment, or cc switch credentials without exposing a saved key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          config: redactedConfig()
        })
      )
    );

    render(<ModelSourceControl value={defaultSettings()} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Online" }));

    expect(screen.getByLabelText("Credential source")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Manual API key" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Configured environment" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CC switch / Codex config" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Environment key" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Manual API key")).toHaveAttribute("type", "password");
    expect(screen.queryByDisplayValue("sk-saved")).not.toBeInTheDocument();
  });

  it("tests an online provider using configured environment settings", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/model-config") {
        return Response.json({
          config: redactedConfig({
            onlineHost: "127.0.0.1:15721",
            onlineModel: "gpt-5.5",
            credentialState: "present",
            configSource: "env"
          })
        });
      }
      if (url === "/api/model-config/test" && init?.method === "POST") {
        return Response.json({
          ok: true,
          models: ["gpt-5.5"],
          error: null,
          baseUrl: "http://127.0.0.1:15721/v1",
          selectedModel: "gpt-5.5"
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelSourceControl value={defaultSettings()} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Online" }));
    await userEvent.selectOptions(screen.getByLabelText("Credential source"), "env");
    await userEvent.click(screen.getByRole("button", { name: "Test online connection" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-config/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "online",
            baseUrl: "",
            model: "",
            configSource: "env",
            apiKey: ""
          })
        })
      );
    });
    expect(await screen.findByText("Connected: gpt-5.5")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "online",
        onlineConfigSource: "env",
        onlineBaseUrl: "http://127.0.0.1:15721/v1",
        onlineModel: "gpt-5.5"
      })
    );
  });

  it("preserves cc switch as the online credential source", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/model-config") {
        return Response.json({
          config: redactedConfig({
            onlineHost: "127.0.0.1:15721",
            onlineModel: "gpt-5.5",
            credentialState: "present",
            configSource: "cc_switch"
          })
        });
      }
      if (url === "/api/model-config/test" && init?.method === "POST") {
        return Response.json({
          ok: true,
          models: ["gpt-5.5"],
          error: null,
          baseUrl: "http://127.0.0.1:15721/v1",
          selectedModel: "gpt-5.5"
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelSourceControl value={defaultSettings()} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Online" }));
    await userEvent.selectOptions(screen.getByLabelText("Credential source"), "cc_switch");
    await userEvent.click(screen.getByRole("button", { name: "Test online connection" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/model-config/test",
        expect.objectContaining({
          body: JSON.stringify({
            source: "online",
            baseUrl: "",
            model: "",
            configSource: "cc_switch",
            apiKey: ""
          })
        })
      );
    });
    expect(await screen.findByText("Connected: gpt-5.5")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "online",
        onlineConfigSource: "cc_switch",
        onlineBaseUrl: "http://127.0.0.1:15721/v1",
        onlineModel: "gpt-5.5"
      })
    );
  });

  it("shows key status with the online configuration error", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/model-config") {
        return Response.json({
          config: redactedConfig({ configSource: "cc_switch" })
        });
      }
      if (url === "/api/model-config/test" && init?.method === "POST") {
        return Response.json({
          ok: false,
          models: [],
          error: "Online base URL is not configured"
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModelSourceControl value={defaultSettings()} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Online" }));
    await userEvent.selectOptions(screen.getByLabelText("Credential source"), "cc_switch");
    await userEvent.click(screen.getByRole("button", { name: "Test online connection" }));

    expect(
      await screen.findByText("Server key status: missing. Online base URL is not configured")
    ).toBeInTheDocument();
  });
});

function defaultSettings(): RuntimeModelSettings {
  return {
    mode: "mock",
    localBaseUrl: "http://localhost:8000/v1",
    localModel: "",
    onlineBaseUrl: "",
    onlineModel: "",
    onlineConfigSource: "manual",
    onlineApiKey: ""
  };
}

function redactedConfig({
  onlineHost = "",
  onlineModel = "",
  credentialState = "missing",
  configSource = "manual"
} = {}) {
  return {
    activeMode: "mock",
    reviewerSources: ["local", "online"],
    local: {
      baseUrl: "http://localhost:8000/v1",
      selectedModel: "",
      configured: true
    },
    online: {
      baseUrlHost: onlineHost,
      selectedModel: onlineModel,
      configured: Boolean(onlineHost && onlineModel),
      credentialState,
      configSource
    }
  };
}
