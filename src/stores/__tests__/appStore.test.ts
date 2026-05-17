import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/stores/appStore";

describe("appStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      theme: "system",
      sidebarCollapsed: false,
    });
    document.documentElement.classList.remove("dark");
  });

  it("setTheme should update theme and apply dark class", () => {
    const store = useAppStore.getState();
    store.setTheme("dark");

    const state = useAppStore.getState();
    expect(state.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme should remove dark class for light theme", () => {
    document.documentElement.classList.add("dark");

    const store = useAppStore.getState();
    store.setTheme("light");

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(useAppStore.getState().theme).toBe("light");
  });

  it("toggleSidebar should toggle collapsed state", () => {
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);

    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });
});
