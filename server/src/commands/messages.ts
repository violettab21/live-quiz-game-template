import { IncomingMessage } from "http";
import { gamesStorage } from "../db/games";
import { usersStorage } from "../db/users";
import {
  CreateGameData,
  Game,
  JoinGameData,
  ModifiedWebSocket,
  RegData,
} from "../types";
import type { WebSocket, Server } from "ws";
import { TIMEOUT_SOW_QUESTION_RESULTS } from "../constants/constants";
import { register } from "./register";
import { createGame } from "./createGame";
import {
  getGameJoinedMessage,
  getPlayerJoinedMessage,
  getUpdatePlayersMessage,
  joinGame,
} from "./joinGame";
import { getCurrentQuestion, startGame } from "./startGame";

import {
  checkAllPlayersAnswered,
  finishGameMessage,
  getNextQuestion,
  getQuestionResults,
  isNextQuestionPresent,
  processAnswer,
} from "./answer";

export function handleRegisterMessage(data: RegData, ws: ModifiedWebSocket) {
  const res = register(data, ws);
  ws.send(JSON.stringify(res));
  console.log("users list", usersStorage.users);
}

export function handleCreateGameMessage(
  data: CreateGameData,
  ws: ModifiedWebSocket,
) {
  const res = createGame(data, ws.userId);
  ws.send(JSON.stringify(res));
}

export function handleJoinGameMessage(
  data: JoinGameData,
  ws: ModifiedWebSocket,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
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
        JSON.stringify(getUpdatePlayersMessage(res.game)),
        game,
        wss,
      );
    }, 500);
  }
}

export function handleStartGameMessage(
  data: any,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  if (typeof data === "object" && "gameId" in data) {
    const gameId = data?.gameId as string;
    const game = gamesStorage.findGameById(gameId);
    if (game) {
      const res = startGame(data);
      const {
        data: { timeLimitSec },
      } = getCurrentQuestion(game);

      sendQuestionToPlayers(game, JSON.stringify(res), timeLimitSec, wss);
    }
  }
}

export function sendQuestionToPlayers(
  game: Game,
  questionData: string,
  timeLimitSec: number,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  sendMessageToPlayers(questionData, game, wss);
  game.questionTimer = setTimeout(() => {
    {
      sendMessageToPlayers(JSON.stringify(getQuestionResults(game)), game, wss);
      console.log("timer expired, send question results to all players");
      proceedGame(game, wss);
    }
  }, timeLimitSec * 1000);
}

export function handleAnswerMessage(
  data: any,
  ws: ModifiedWebSocket,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  const gameId = data.gameId;
  const game = gamesStorage.findGameById(gameId);
  if (gameId && game) {
    const res = processAnswer(data, ws);
    ws.send(JSON.stringify(res));

    if (checkAllPlayersAnswered(game)) {
      sendMessageToPlayers(JSON.stringify(getQuestionResults(game)), game, wss);
      game.questionTimer?.close();
      console.log("timer reset");
      proceedGame(game, wss);
    }
  }
}

export function sendMessageToPlayers(
  message: string,
  game: Game,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  wss.clients.forEach((client: ModifiedWebSocket) => {
    const userIndex = client.userId;
    if (userIndex === game.hostId) {
      client.send(message);
      console.log("send message to Host");
      console.log(message);
    }
    game.players.forEach((player) => {
      if (player.index === client.userId) {
        client.send(message);
        console.log("send message to player");
        console.log(message);
      }
    });
  });
}

export function proceedGame(
  game: Game,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  const timeLimit = game.questions[game.currentQuestion - 1].timeLimitSec;
  setTimeout(() => {
    if (isNextQuestionPresent(game)) {
      const nextQuestionData = getNextQuestion(game);
      sendQuestionToPlayers(
        game,
        JSON.stringify(nextQuestionData),
        timeLimit,
        wss,
      );
    } else {
      sendMessageToPlayers(JSON.stringify(finishGameMessage(game)), game, wss);
    }
  }, TIMEOUT_SOW_QUESTION_RESULTS);
}

export function removeDisconnectedUserFromGames(
  userId: string,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  const games = gamesStorage.games.filter(
    (game) =>
      (game.status === "waiting" || game.status === "in_progress") &&
      game.players.find((player) => player.index === userId),
  );
  if (games.length > 0) {
    games.forEach((game) => {
      gamesStorage.removePlayer(game.id, userId);
      console.log("After remove");
      console.log(gamesStorage.findGameById(game.id));
      const message = JSON.stringify(getUpdatePlayersMessage(game));
      sendMessageToPlayers(message, game, wss);
    });
  }
}
