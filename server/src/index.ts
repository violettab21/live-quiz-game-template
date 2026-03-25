import { WebSocketServer } from "ws";
import { CreateGameData, ModifiedWebSocket, RegData, WSMessage } from "./types";
import { usersStorage } from "./db/users";
import { gamesStorage } from "./db/games";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: ModifiedWebSocket) => {
  ws.on("message", (msg) => {
    console.log(`From client: ${msg}`);
    const { type, data } = JSON.parse(msg.toString()) as WSMessage;
    switch (type) {
      case "reg": {
        const res = register(data);
        ws.send(JSON.stringify(res));
        ws.userId = res.data.index;
        break;
      }
      case "create_game": {
        const res = createGame(data, ws.userId);
        ws.send(JSON.stringify(res));
        break;
      }
    }
  });

  ws.on("error", console.error);
});

function register(data: RegData): WSMessage {
  if (!data.name || !data.password) {
    return {
      type: "reg",
      data: {
        error: true,
        errorText: "Unable to register user",
      },
      id: 0,
    };
  }
  const { name, password } = data;
  const index = usersStorage.addUser(name, password);
  return {
    type: "reg",
    data: {
      name: name,
      index: index,
      error: false,
      errorText: "",
    },
    id: 0,
  };
}

function createGame(data: CreateGameData, hostId: string | undefined) {
  if (!data.questions || !hostId) {
    return {
      type: "game_created",
      data: {
        error: true,
        errorText: "Unable to create game user",
      },
      id: 0,
    };
  }
  const { questions } = data;
  const { id, code } = gamesStorage.addGame(questions, hostId);
  return {
    type: "game_created",
    data: {
      gameId: id,
      code: code,
    },
    id: 0,
  };
}
