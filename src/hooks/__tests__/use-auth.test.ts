import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const signInMock = vi.mocked(signInAction);
const signUpMock = vi.mocked(signUpAction);
const getAnonWorkDataMock = vi.mocked(getAnonWorkData);
const clearAnonWorkMock = vi.mocked(clearAnonWork);
const getProjectsMock = vi.mocked(getProjects);
const createProjectMock = vi.mocked(createProject);

const makeProject = (id: string, name = "Test Project") => ({
  id,
  name,
  userId: "user-1",
  messages: "[]",
  data: "{}",
  createdAt: new Date(),
  updatedAt: new Date(),
});

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  getAnonWorkDataMock.mockReturnValue(null);
  getProjectsMock.mockResolvedValue([]);
  createProjectMock.mockResolvedValue(makeProject("new-project-id"));
});

describe("useAuth", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });

  describe("signIn", () => {
    it("sets isLoading true during call and false after", async () => {
      let resolveSignIn!: (v: { success: boolean }) => void;
      signInMock.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

      const { result } = renderHook(() => useAuth());

      let callPromise: Promise<unknown>;
      act(() => {
        callPromise = result.current.signIn("user@test.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false });
        await callPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("returns the action result", async () => {
      signInMock.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;

      await act(async () => {
        returnValue = await result.current.signIn("user@test.com", "wrong");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    });

    it("does not navigate or create projects on failure", async () => {
      signInMock.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "wrong");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
      expect(getProjectsMock).not.toHaveBeenCalled();
    });

    it("migrates anon work into a project on success", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "build me a button" }],
        fileSystemData: { "/": { type: "directory" }, "/App.tsx": { content: "..." } },
      };
      getAnonWorkDataMock.mockReturnValue(anonWork);
      createProjectMock.mockResolvedValue(makeProject("anon-project-id"));
      signInMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password123");
      });

      expect(createProjectMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(clearAnonWorkMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      expect(getProjectsMock).not.toHaveBeenCalled();
    });

    it("skips anon work migration when messages array is empty", async () => {
      getAnonWorkDataMock.mockReturnValue({ messages: [], fileSystemData: {} });
      getProjectsMock.mockResolvedValue([makeProject("existing-id")]);
      signInMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password123");
      });

      expect(createProjectMock).not.toHaveBeenCalled();
      expect(clearAnonWorkMock).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-id");
    });

    it("skips anon work migration when getAnonWorkData returns null", async () => {
      getAnonWorkDataMock.mockReturnValue(null);
      getProjectsMock.mockResolvedValue([makeProject("existing-id")]);
      signInMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password123");
      });

      expect(clearAnonWorkMock).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-id");
    });

    it("navigates to the most recent existing project", async () => {
      getProjectsMock.mockResolvedValue([
        makeProject("proj-recent", "Recent"),
        makeProject("proj-old", "Old"),
      ]);
      signInMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-recent");
      expect(createProjectMock).not.toHaveBeenCalled();
    });

    it("creates a blank project when no projects exist", async () => {
      getProjectsMock.mockResolvedValue([]);
      createProjectMock.mockResolvedValue(makeProject("fresh-id"));
      signInMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@test.com", "password123");
      });

      expect(createProjectMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/fresh-id");
    });

    it("resets isLoading to false when the action throws", async () => {
      signInMock.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@test.com", "password123");
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when handlePostSignIn throws", async () => {
      signInMock.mockResolvedValue({ success: true });
      getProjectsMock.mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@test.com", "password123");
        })
      ).rejects.toThrow("DB error");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("sets isLoading true during call and false after", async () => {
      let resolveSignUp!: (v: { success: boolean }) => void;
      signUpMock.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

      const { result } = renderHook(() => useAuth());

      let callPromise: Promise<unknown>;
      act(() => {
        callPromise = result.current.signUp("new@test.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
        await callPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("returns the action result", async () => {
      signUpMock.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;

      await act(async () => {
        returnValue = await result.current.signUp("new@test.com", "password123");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    });

    it("does not navigate or create projects on failure", async () => {
      signUpMock.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
    });

    it("migrates anon work into a project on success", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "make a dashboard" }],
        fileSystemData: { "/": { type: "directory" } },
      };
      getAnonWorkDataMock.mockReturnValue(anonWork);
      createProjectMock.mockResolvedValue(makeProject("migrated-id"));
      signUpMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "password123");
      });

      expect(createProjectMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(clearAnonWorkMock).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-id");
    });

    it("navigates to the most recent existing project when no anon work", async () => {
      getProjectsMock.mockResolvedValue([makeProject("proj-1")]);
      signUpMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
      expect(createProjectMock).not.toHaveBeenCalled();
    });

    it("creates a blank project when no projects exist", async () => {
      getProjectsMock.mockResolvedValue([]);
      createProjectMock.mockResolvedValue(makeProject("brand-new-id"));
      signUpMock.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@test.com", "password123");
      });

      expect(createProjectMock).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/brand-new-id");
    });

    it("resets isLoading to false when the action throws", async () => {
      signUpMock.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@test.com", "password123");
        })
      ).rejects.toThrow("Server error");

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when handlePostSignIn throws", async () => {
      signUpMock.mockResolvedValue({ success: true });
      createProjectMock.mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@test.com", "password123");
        })
      ).rejects.toThrow("Create failed");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
