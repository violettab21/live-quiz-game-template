import { WebSocketServer } from "ws";
import {
  AnswerData,
  CreateGameData,
  Game,
  JoinGameData,
  ModifiedWebSocket,
  RegData,
  StartGameData,
  WSMessage,
} from "./types";
import { usersStorage } from "./db/users";
import { gamesStorage } from "./db/games";
import { playersStorage } from "./db/players";
import type { WebSocket, Server } from "ws";
import { IncomingMessage } from "http";

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
        ws.userId = res.data.index;
        break;
      }
      case "create_game": {
        const res = createGame(data, ws.userId);
        ws.send(JSON.stringify(res));
        break;
      }
      case "join_game": {
        const res = joinGame(data, ws);
        ws.send(JSON.stringify(prepareMessageForPlayerJoined(res)));
        if (res) {
          const game = res.game;
          sendMessageToPlayers(
            JSON.stringify(prepareMessageForOtherPlayers(res)),
            game,
            wss,
          );
          sendMessageToPlayers(
            JSON.stringify(prepareMessageForWithPlayersData(res)),
            game,
            wss,
          );
        }

        break;
      }
      case "start_game": {
        const res = startGame(data);
        const gameId = data.gameId;
        const game = gamesStorage.findGameById(gameId);

        if (game) {
          const {
            data: { timeLimitSec },
          } = getCurrentQuestion(game);
          console.log("limit", timeLimitSec);
          sendMessageToPlayers(JSON.stringify(res), game, wss);
          game.questionTimer = setTimeout(() => {
            {
              sendMessageToPlayers(
                JSON.stringify(prepareQuestionResults(game)),
                game,
                wss,
              );
              console.log("timer expired");
            }
          }, timeLimitSec * 1000);
        }

        break;
      }
      case "answer": {
        const res = processAnswer(data, ws);
        ws.send(JSON.stringify(res));
        const gameId = data.gameId;
        const game = gamesStorage.findGameById(gameId);
        if (gameId && game) {
          if (checkAllPlayersAnswered(game)) {
            sendMessageToPlayers(
              JSON.stringify(prepareQuestionResults(game)),
              game,
              wss,
            );
            game.questionTimer?.close();
          }
        }
        break;
      }
    }
  });

  ws.on("error", console.error);
});

function register(data: RegData, ws: ModifiedWebSocket): WSMessage {
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
  const index = usersStorage.addUser(name, password, ws);
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

function joinGame(data: JoinGameData, ws: ModifiedWebSocket) {
  const { code } = data;
  console.log(code);
  const game = gamesStorage.findGame(code);
  console.log(game);
  if (game) {
    const userIndex = ws.userId;
    if (userIndex) {
      const user = usersStorage.findUser(userIndex);
      if (user) {
        const player = {
          name: user?.name,
          index: user?.index,
          score: 0,
          ws: user.ws,
        };
        playersStorage.addPlayer(player);
        gamesStorage.addPlayer(player, game.id);

        return {
          game: game,
          playerName: user.name,
          playersCount: game.players.length,
        };
      }
    }
  }
  return null;
}

function prepareMessageForPlayerJoined(
  res: {
    game: Game;
    playerName: string;
    playersCount: number;
  } | null,
) {
  if (res) {
    return {
      type: "game_joined",
      data: {
        gameId: res.game.id,
      },
      id: 0,
    };
  }
  return {
    type: "error",
    data: {
      error: true,
      errorText: "Unable to add game player",
    },
    id: 0,
  };
}

function prepareMessageForOtherPlayers(
  res: {
    game: Game;
    playerName: string;
    playersCount: number;
  } | null,
) {
  if (res) {
    return {
      type: "player_joined",
      data: {
        playerName: res.playerName,
        playersCount: res.playersCount,
      },
      id: 0,
    };
  }
  return {
    type: "error",
    data: {
      error: true,
      errorText: "Unable to add game player",
    },
    id: 0,
  };
}

function prepareMessageForWithPlayersData(
  res: {
    game: Game;
    playerName: string;
    playersCount: number;
  } | null,
) {
  if (res) {
    const players = res.game.players.map((player) => {
      return {
        name: player.name,
        index: player.index,
        score: player.score,
      };
    });

    return {
      type: "update_players",
      data: players,
      id: 0,
    };
  }
  return {
    type: "error",
    data: {
      error: true,
      errorText: "Unable to get players",
    },
    id: 0,
  };
}

function startGame(data: StartGameData) {
  const { gameId } = data;
  const game = gamesStorage.findGameById(gameId);
  if (game) {
    game.currentQuestion = 1;
    game.status = "in_progress";
    game.questionStartTime = Date.now();
    const questionInfo = getCurrentQuestion(game);
    return questionInfo;
  }
  return {
    type: "error",
    data: {
      error: true,
      errorText: "Unable to Start the game",
    },
    id: 0,
  };
}

function getCurrentQuestion(game: Game) {
  const currentQuestion = game.currentQuestion;
  const { text, options, timeLimitSec } = game.questions[currentQuestion - 1];

  return {
    type: "question",
    data: {
      questionNumber: currentQuestion,
      totalQuestions: game.questions.length,
      text: text,
      options: options,
      timeLimitSec: timeLimitSec,
    },
  };
}

function sendMessageToPlayers(
  message: string,
  game: Game,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  wss.clients.forEach((client: ModifiedWebSocket) => {
    const userIndex = client.userId;
    if (userIndex === game.hostId) {
      client.send(message);
    }
    game.players.forEach((player) => {
      if (player.ws === client) {
        client.send(message);
      }
    });
  });
}

function processAnswer(data: AnswerData, ws: ModifiedWebSocket) {
  const { gameId, questionIndex, answerIndex } = data;
  const game = gamesStorage.findGameById(gameId);

  if (game) {
    const player = playersStorage.players.find((player) => player.ws === ws);
    if (player) {
      player.hasAnswered = true;
      player.answeredCorrectly =
        game.questions[questionIndex].correctIndex === answerIndex;
      game.playerAnswers.set(player.index, {
        answerIndex: answerIndex,
        timestamp: new Date().getSeconds(),
      });
      return {
        type: "answer_accepted",
        data: {
          questionIndex: questionIndex,
        },
        id: 0,
      };
    }
  }
  return {
    type: "error",
    data: {
      error: true,
      errorText: "Unable to process answer",
    },
    id: 0,
  };
}

function prepareQuestionResults(game: Game) {
  const playersAnswersResults: {
    name: string;
    answered: boolean;
    correct: boolean;
    pointsEarned: number;
    totalScore: number;
  }[] = game.players.map((player) => {
    return {
      name: player.name,
      answered: player.hasAnswered || false,
      correct: player.answeredCorrectly || false,
      pointsEarned: 1,
      totalScore: player.score + 1,
    };
  });
  return {
    type: "question_result",
    data: {
      questionIndex: game.currentQuestion - 1,
      correctIndex: game.questions[game.currentQuestion - 1].correctIndex,
      playerResults: playersAnswersResults,
    },
    id: 0,
  };
}

function checkAllPlayersAnswered(game: Game) {
  console.log("All answered");
  console.log(game.players);
  console.log(game.players.find((player) => !player.hasAnswered));

  return game.players.find((player) => !player.hasAnswered) ? false : true;
}
