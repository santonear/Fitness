import { repository } from '../../../persistence/repository';
import { conversationStore, type AssistantConversation } from '../../../persistence/assistant-conversations';

export const store = conversationStore(repository.db);
export const fresh = (): AssistantConversation => ({
  id: crypto.randomUUID(),
  title: '',
  updatedAt: new Date().toISOString(),
  messages: [],
});
export const rememberedBody = () => {
  try {
    return localStorage.getItem('fitness-assistant-body-consent') === 'yes';
  } catch {
    return false;
  }
};
