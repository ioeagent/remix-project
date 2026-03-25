import { ChatHistory } from "./chat"
import { DAPP_SYSTEM_PROMPT } from "../helpers/dapp-system-prompt"

export const buildChatPrompt = () => {
  const history = []

  // Inject DApp system prompt as contextual guidance
  history.push({ role: 'system', content: DAPP_SYSTEM_PROMPT })

  for (const [question, answer] of ChatHistory.getHistory()) {
    history.push({ role:'user', content: question })
    history.push({ role:'assistant' , content: answer })
  }
  return history
}
