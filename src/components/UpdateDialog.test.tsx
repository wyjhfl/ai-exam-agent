import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UpdateDialog from "@/components/UpdateDialog";

describe("UpdateDialog", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    currentVersion: "0.7.0",
    latestVersion: "0.8.0",
    releaseNotes: "新增真题库功能",
    downloadUrl: "https://github.com/test/release",
  };

  it("does not render when open=false", () => {
    render(<UpdateDialog {...baseProps} open={false} />);
    expect(screen.queryByText("发现新版本")).toBeNull();
  });

  it("shows version info when open=true", () => {
    render(<UpdateDialog {...baseProps} />);
    expect(screen.getByText("发现新版本")).toBeDefined();
    expect(screen.getByText(/v0\.7\.0/)).toBeDefined();
    expect(screen.getByText(/v0\.8\.0/)).toBeDefined();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<UpdateDialog {...baseProps} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows download link when downloadUrl provided", () => {
    render(<UpdateDialog {...baseProps} />);
    const link = screen.getByText("前往下载");
    expect(link).toBeDefined();
    expect(link.closest("a")?.href).toContain("github.com/test/release");
  });

  it("does not show download link when downloadUrl is empty", () => {
    render(<UpdateDialog {...baseProps} downloadUrl="" />);
    expect(screen.queryByText("前往下载")).toBeNull();
  });
});
