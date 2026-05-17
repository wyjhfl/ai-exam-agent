import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isLoading: false,
      userId: 1,
    });
  });

  it("addMessage should add a message with id and timestamp", () => {
    const store = useChatStore.getState();
    store.addMessage({ role: "user", content: "Hello" });

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[0].content).toBe("Hello");
    expect(state.messages[0].id).toBeDefined();
    expect(state.messages[0].timestamp).toBeDefined();
  });

  it("clearMessages should remove all messages", () => {
    const store = useChatStore.getState();
    store.addMessage({ role: "user", content: "Hello" });
    store.addMessage({ role: "assistant", content: "Hi" });

    expect(useChatStore.getState().messages).toHaveLength(2);

    store.clearMessages();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("appendToLastAssistant should append text to the last assistant message", () => {
    const store = useChatStore.getState();
    store.addMessage({ role: "user", content: "Hello" });
    store.addMessage({ role: "assistant", content: "Hi" });

    store.appendToLastAssistant(" there");

    const state = useChatStore.getState();
    const lastMsg = state.messages[state.messages.length - 1];
    expect(lastMsg.content).toBe("Hi there");
    expect(lastMsg.streaming).toBe(true);
  });

  it("appendToLastAssistant should not modify non-assistant messages", () => {
    const store = useChatStore.getState();
    store.addMessage({ role: "user", content: "Hello" });

    store.appendToLastAssistant(" extra");

    const state = useChatStore.getState();
    expect(state.messages[0].content).toBe("Hello");
  });

  it("setLastAssistantSources should set sources on last assistant message", () => {
    const store = useChatStore.getState();
    store.addMessage({ role: "assistant", content: "Answer" });

    const sources = [{ text: "ref1", metadata: {} }];
    store.setLastAssistantSources(sources);

    const state = useChatStore.getState();
    expect(state.messages[0].sources).toEqual(sources);
  });
});
