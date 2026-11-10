import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./login-page";

const auth = vi.hoisted(() => ({
  language: "kn" as "kn" | "en",
  setLanguage: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@/components/dashboard/dashboard-provider", () => ({
  useDashboard: () => ({
    language: auth.language,
    setLanguage: auth.setLanguage,
    login: auth.login,
    t: { topbar: { language: "Choose language" } },
  }),
}));

describe("officer login page", () => {
  beforeEach(() => {
    auth.language = "kn";
    auth.login.mockReset();
    auth.setLanguage.mockReset();
  });

  it("renders Kannada by default and offers an English toggle", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "ಜನಸೇವಾ AI ಗೆ ಸ್ವಾಗತ" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("ಬಳಕೆದಾರ ಹೆಸರು")).toBeInTheDocument();
    expect(screen.getByLabelText("ಪಾಸ್‌ವರ್ಡ್")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(auth.setLanguage).toHaveBeenCalledWith("en");
  });

  it("submits username and password and shows a generic failure message", async () => {
    auth.login.mockRejectedValue(new Error("internal details"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("ಬಳಕೆದಾರ ಹೆಸರು"), {
      target: { value: "reviewer" },
    });
    fireEvent.change(screen.getByLabelText("ಪಾಸ್‌ವರ್ಡ್"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "ಸುರಕ್ಷಿತವಾಗಿ ಪ್ರವೇಶಿಸಿ" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ಲಾಗಿನ್ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    );
    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledWith("reviewer", "incorrect-password");
    });
    expect(screen.queryByText("internal details")).not.toBeInTheDocument();
  });

  it("disables submit while the login request is pending", async () => {
    let resolveLogin: (() => void) | undefined;
    auth.login.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("ಬಳಕೆದಾರ ಹೆಸರು"), {
      target: { value: "reviewer" },
    });
    fireEvent.change(screen.getByLabelText("ಪಾಸ್‌ವರ್ಡ್"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "ಸುರಕ್ಷಿತವಾಗಿ ಪ್ರವೇಶಿಸಿ" }),
    );
    expect(
      screen.getByRole("button", { name: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…" }),
    ).toBeDisabled();
    resolveLogin?.();
  });
});
