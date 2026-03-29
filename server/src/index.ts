import { WebSocketServer } from "ws";
import { ModifiedWebSocket, WSMessage } from "./types";
import {
  removeDisconnectedUserFromGames,
  handleRegisterMessage,
  handleCreateGameMessage,
  handleJoinGameMessage,
  handleStartGameMessage,
  handleAnswerMessage,
} from "./commands/messages";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: ModifiedWebSocket) => {
  ws.on("message", (msg) => {
    console.log(`From client: ${msg}`);
    const { type, data } = JSON.parse(msg.toString()) as WSMessage;
    switch (type) {
      case "reg": {
        handleRegisterMessage(data, ws);
        break;
      }
      case "create_game": {
        handleCreateGameMessage(data, ws);
        break;
      }
      case "join_game": {
        handleJoinGameMessage(data, ws, wss);
        break;
      }
      case "start_game": {
        handleStartGameMessage(data, ws, wss);

        break;
      }
      case "answer": {
        handleAnswerMessage(data, ws, wss);
        break;
      }
    }
  });
  ws.on("close", () => {
    const userId = ws.userId;

    if (userId) {
      console.log("Client disconnected", userId);
      removeDisconnectedUserFromGames(userId, wss);
    }
  });
  ws.on("error", console.error);
});
