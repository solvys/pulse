import type { FeedItem } from '../../types/riskflow.js'

type SSEClient = {
  controller: ReadableStreamDefaultController
  userId: string
}

const clients = new Set<SSEClient>()

/**
 * Register a new SSE subscriber
 */
export function addClient(controller: ReadableStreamDefaultController, userId: string) {
  clients.add({ controller, userId })
}

/**
 * Remove a client from the subscriber list
 */
export function removeClient(controller: ReadableStreamDefaultController) {
  clients.forEach((client) => {
    if (client.controller === controller) {
      clients.delete(client)
    }
  })
}

/**
 * Broadcast a Level 4 feed item to all connected clients
 */
export function broadcastLevel4(item: FeedItem) {
  const payload = `data: ${JSON.stringify(item)}\n\n`
  const encoder = new TextEncoder()

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoder.encode(payload))
    } catch (error) {
      console.warn('[SSE] Removing client due to enqueue failure', error)
      removeClient(client.controller)
    }
  })
}
