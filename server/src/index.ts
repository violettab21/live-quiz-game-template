import { WebSocketServer } from "ws";
import { ModifiedWebSocket, WSMessage } from "./types";
import { gamesStorage } from "./db/games";
import {
  checkAllPlayersAnswered,
  createGame,
  getCurrentQuestion,
  getGameJoinedMessage,
  getPlayerJoinedMessage,
  joinGame,
  getUpdatePlayersMessage,
  processAnswer,
  register,
  sendMessageToPlayers,
  startGame,
  getQuestionResults,
  isNextQuestionPresent,
  getNextQuestion,
  finishGameMessage,
  proceedGame,
} from "./messages/messages";
import { usersStorage } from "./db/users";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: ModifiedWebSocket) => {
  ws.on("message", (msg) => {
    console.log(`From client: ${msg}`);
    const { type, data } = JSON.parse(msg.toString()) as WSMessage;
    switch (type) {
      case "reg": {
        const res = register(data, ws);
        ws.send(JSON.stringify(res));
        console.log("users list", usersStorage.users);
        break;
      }
      case "create_game": {
        const res = createGame(data, ws.userId);
        ws.send(JSON.stringify(res));
        break;
      }
      case "join_game": {
        const res = joinGame(data, ws);
        ws.send(JSON.stringify(getGameJoinedMessage(res)));
        if (res) {
          const game = res.game;
          setTimeout(
            () =>
              sendMessageToPlayers(
                JSON.stringify(getPlayerJoinedMessage(res)),
                game,
                wss,
              ),
            500,
          );
          setTimeout(() => {
            sendMessageToPlayers(
              JSON.stringify(getUpdatePlayersMessage(res)),
              game,
              wss,
            );
          }, 500);
        }

        break;
      }
      case "start_game": {
        const gameId = data.gameId;
        const game = gamesStorage.findGameById(gameId);

        if (game) {
          const res = startGame(data);
          const {
            data: { timeLimitSec },
          } = getCurrentQuestion(game);
          console.log("limit", timeLimitSec);
          sendMessageToPlayers(JSON.stringify(res), game, wss);
          game.questionTimer = setTimeout(() => {
            {
              sendMessageToPlayers(
                JSON.stringify(getQuestionResults(game)),
                game,
                wss,
              );
              console.log(
                "timer expired, send question results to all players",
              );
              proceedGame(game, wss);
            }
          }, timeLimitSec * 1000);
        }

        break;
      }
      case "answer": {
        const gameId = data.gameId;
        const game = gamesStorage.findGameById(gameId);
        if (gameId && game) {
          const res = processAnswer(data, ws);
          ws.send(JSON.stringify(res));

          if (checkAllPlayersAnswered(game)) {
            sendMessageToPlayers(
              JSON.stringify(getQuestionResults(game)),
              game,
              wss,
            );
            game.questionTimer?.close();
            console.log("timer reset");
            proceedGame(game, wss);
          }
        }
        break;
      }
    }
  });

  ws.on("error", console.error);
});
