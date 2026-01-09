import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
} from "./templates";
import { SessionTemplate } from "@/types/jules";

// Mock localStorage
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

// Mock crypto
const randomUUIDMock = vi.fn();
Object.defineProperty(global, "crypto", {
  value: { randomUUID: randomUUIDMock },
  writable: true,
});

describe("Templates Utility", () => {
  const TEMPLATES_KEY = "jules-session-templates";

  let originalWindow: typeof global.window;
  let originalLocalStorage: typeof global.localStorage;
  let originalCrypto: typeof global.crypto;

  beforeAll(() => {
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;
    originalCrypto = global.crypto;
    Object.defineProperty(global, "window", {
      value: { localStorage: localStorageMock },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    if (originalWindow !== undefined) {
      Object.defineProperty(global, "window", { value: originalWindow, writable: true, configurable: true });
    } else {
      delete (global as unknown as Record<string, unknown>).window;
    }
    if (originalLocalStorage !== undefined) {
      Object.defineProperty(global, "localStorage", { value: originalLocalStorage, writable: true, configurable: true });
    } else {
      delete (global as unknown as Record<string, unknown>).localStorage;
    }
    if (originalCrypto !== undefined) {
      Object.defineProperty(global, "crypto", { value: originalCrypto, writable: true, configurable: true });
    } else {
      delete (global as unknown as Record<string, unknown>).crypto;
    }
  });

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    randomUUIDMock.mockReturnValue("test-uuid");
  });

  describe("getTemplates", () => {
    it("should return prebuilt templates when localStorage is empty", () => {
      const templates = getTemplates();
      expect(templates.length).toBeGreaterThan(4);
      expect(templates.some((t) => t.id === "bolt-performance-agent")).toBe(true);
      expect(templates.some((t) => t.id === "palette-ux-agent")).toBe(true);
      expect(templates.some((t) => t.id === "sentinel-security-agent")).toBe(true);
      expect(templates.some((t) => t.id === "guardian-test-agent")).toBe(true);
      expect(templates.some((t) => t.id === "echo-reproduction-agent")).toBe(true);
    });

    it("should return parsed templates sorted by updatedAt desc", () => {
      const t1 = { id: "1", name: "T1", updatedAt: "2023-01-01T00:00:00Z" } as SessionTemplate;
      const t2 = { id: "2", name: "T2", updatedAt: "2023-01-02T00:00:00Z" } as SessionTemplate;
      localStorageMock.setItem(TEMPLATES_KEY, JSON.stringify([t1, t2]));
      const templates = getTemplates();
      expect(templates).toHaveLength(2);
      expect(templates[0].id).toBe("2");
      expect(templates[1].id).toBe("1");
    });
  });

  describe("saveTemplate", () => {
    it("should create new template and preserve prebuilt ones", () => {
      const input = { name: "New Template", description: "Desc", prompt: "Prompt", title: "Title" };
      const result = saveTemplate(input);
      expect(result).toMatchObject(input);
      expect(result.id).toBe("test-uuid");
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      const stored = JSON.parse(localStorageMock.getItem(TEMPLATES_KEY)!);
      expect(stored.length).toBeGreaterThan(5);
      expect(stored).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "test-uuid" }),
          expect.objectContaining({ id: "bolt-performance-agent" }),
          expect.objectContaining({ id: "palette-ux-agent" }),
          expect.objectContaining({ id: "sentinel-security-agent" }),
          expect.objectContaining({ id: "guardian-test-agent" }),
          expect.objectContaining({ id: "echo-reproduction-agent" }),
        ])
      );
    });

    it("should update existing template", () => {
      const existing = {
        id: "existing-id",
        name: "Old Name",
        description: "Old Desc",
        prompt: "Old Prompt",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as SessionTemplate;
      localStorageMock.setItem(TEMPLATES_KEY, JSON.stringify([existing]));
      const update = { id: "existing-id", name: "New Name", description: "New Desc", prompt: "New Prompt" };
      const result = saveTemplate(update);
      expect(result.id).toBe("existing-id");
      expect(result.name).toBe("New Name");
      expect(result.updatedAt).not.toBe("2023-01-01T00:00:00Z");
      const stored = JSON.parse(localStorageMock.getItem(TEMPLATES_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("New Name");
    });
  });

  describe("deleteTemplate", () => {
    it("should delete template by id", () => {
      const t1 = { id: "1", name: "T1" } as SessionTemplate;
      const t2 = { id: "2", name: "T2" } as SessionTemplate;
      localStorageMock.setItem(TEMPLATES_KEY, JSON.stringify([t1, t2]));
      deleteTemplate("1");
      const stored = JSON.parse(localStorageMock.getItem(TEMPLATES_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("2");
    });
  });
});
