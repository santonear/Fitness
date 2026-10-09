/** Deterministic excerpt, not an AI summary or a source of new facts. */
export function coachConversationExcerpt(messages: readonly { role: string; content: string }[]) {
  return messages.slice(-8).map(({ role, content }) => ({
    role: role === 'assistant' ? 'assistant' : 'user',
    content: content.slice(0, 1600),
  }));
}
