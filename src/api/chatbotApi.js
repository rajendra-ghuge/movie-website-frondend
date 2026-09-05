import axios from 'axios';

/**
 * Returns the base URL for the chatbot AI backend.
 * In local development, if targeting localhost:8000, returns '' so requests route
 * through the Vite dev proxy to completely prevent CORS blockage.
 * In production, returns the configured VITE_CHATBOT_API_URL.
 */
export const getChatbotBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_CHATBOT_API_URL || '').trim();

  // If in Vite dev mode and pointing to local server, use relative path for proxy
  if (import.meta.env.DEV) {
    if (!envUrl || envUrl.includes('localhost:8000') || envUrl.includes('127.0.0.1:8000')) {
      return '';
    }
  }

  const url = envUrl || 'http://localhost:8000';
  return url.replace(/\/+$/, '');
};

const chatbotClient = axios.create({
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Streams a chat message from MovieBot using Server-Sent Events (SSE).
 * @param {Object} params
 * @param {string} params.message - The user's query
 * @param {string} [params.sessionId] - Session ID for memory
 * @param {string} [params.genre] - Optional genre filter
 * @param {number|string} [params.year] - Optional year filter
 * @param {Object} callbacks
 * @param {function(string): void} callbacks.onToken - Called for each token streamed
 * @param {function(string): void} [callbacks.onStatus] - Called for status updates (e.g. searching web)
 * @param {function({ answer?: string, sources?: string[] }): void} [callbacks.onDone] - Called when stream finishes
 * @param {function(any): void} [callbacks.onError] - Called when an error occurs
 */
export async function askMovieBotStream(
  { message, sessionId = 'default', genre, year },
  callbacks
) {
  const baseUrl = getChatbotBaseUrl();
  const endpoint = `${baseUrl}/api/v1/movie/chat`;

  const payload = {
    message,
    session_id: sessionId,
    stream: true,
    ...(genre ? { genre } : {}),
    ...(year ? { year } : {}),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = `HTTP error ${response.status}`;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported on this browser response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') {
        return;
      }

      try {
        const payload = JSON.parse(dataStr);
        if (payload.type === 'token') {
          callbacks.onToken?.(payload.content);
        } else if (payload.type === 'status') {
          callbacks.onStatus?.(payload.content);
        } else if (payload.type === 'done') {
          callbacks.onDone?.({ answer: payload.answer, sources: payload.sources });
        } else if (payload.type === 'error') {
          callbacks.onError?.(payload.message || 'Stream error');
        }
      } catch {
        // partial json chunk, ignore
      }
    }
  }
}

/**
 * Sends a standard non-streaming chat message to the MovieBot backend.
 */
export const sendChatMessage = async ({ message, sessionId, genre, year }) => {
  const baseUrl = getChatbotBaseUrl();
  const endpoint = `${baseUrl}/api/v1/movie/chat`;

  const payload = {
    message,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(genre ? { genre } : {}),
    ...(year ? { year } : {}),
  };

  const response = await chatbotClient.post(endpoint, payload);
  return response.data;
};

/**
 * Clears memory for a specific chat session on the backend.
 * @param {string} sessionId
 */
export const clearChatSession = async (sessionId) => {
  if (!sessionId) return null;
  const baseUrl = getChatbotBaseUrl();
  const endpoint = `${baseUrl}/api/v1/movie/clear`;

  try {
    const response = await chatbotClient.post(endpoint, { session_id: sessionId });
    return response.data;
  } catch (err) {
    console.warn('Failed to clear chat session on backend:', err);
    return null;
  }
};
