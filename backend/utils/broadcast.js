const WebSocket = require('ws');

const clients = new Set();

function subscribeClient(ws) {
  console.log('🔌 Client connected to WebSocket');
  clients.add(ws);

  ws.on('close', () => {
    console.log('🔌 Client disconnected from WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
}

function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
}

function getConnectedClients() {
  return clients.size;
}

module.exports = {
  clients,
  subscribeClient,
  broadcast,
  getConnectedClients
};
