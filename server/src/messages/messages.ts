import { IncomingMessage } from "http";
import { gamesStorage } from "../db/games";
import { playersStorage } from "../db/players";
import { usersStorage } from "../db/users";
import {
  AnswerData,
  CreateGameData,
  Game,
  JoinGameData,
  ModifiedWebSocket,
  RegData,
  StartGameData,
  WSMessage,
} from "../types";
import type { WebSocket, Server } from "ws";

export function register(data: RegData, ws: ModifiedWebSocket): WSMessage {
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
  const existingUser = usersStorage.getUserByName(name);
  if (existingUser) {
    if (usersStorage.checkUserPasswordMatch(name, password)) {
      existingUser.ws = ws;
      ws.userId = existingUser.index;
      console.log("login");
      return {
        type: "reg",
        data: {
          name: name,
          index: existingUser.index,
          error: false,
          errorText: "",
        },
        id: 0,
      };
    }
    return {
      type: "reg",
      data: {
        error: true,
        errorText: "Unable to login user",
      },
      id: 0,
    };
  }
  const index = usersStorage.addNewUser(name, password, ws);
  ws.userId = index;
  console.log("new user");
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

export function createGame(data: CreateGameData, hostId: string | undefined) {
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

export function joinGame(data: JoinGameData, ws: ModifiedWebSocket) {
  const { code } = data;
  console.log("Game code", code);
  const game = gamesStorage.findGame(code);
  console.log("current game", game);
  if (game) {
    const userIndex = ws.userId;
    if (userIndex) {
      const user = usersStorage.findUser(userIndex);
      if (user) {
        const existingPlayer = playersStorage.players.find(
          (player) => player.index === user.index,
        );
        if (existingPlayer) {
          existingPlayer.answerTime = 0;
          existingPlayer.answeredCorrectly = false;
          existingPlayer.hasAnswered = false;
          existingPlayer.score = 0;
          gamesStorage.addPlayer(existingPlayer, game.id);
        } else {
          const player = {
            name: user.name,
            index: user.index,
            score: 0,
            ws: user.ws,
          };
          playersStorage.addPlayer(player);
          gamesStorage.addPlayer(player, game.id);
        }

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

export function getGameJoinedMessage(
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
      errorText: "Game joined error",
    },
    id: 0,
  };
}

export function getPlayerJoinedMessage(
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
      errorText: "Player joined error",
    },
    id: 0,
  };
}

export function getUpdatePlayersMessage(
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
      errorText: "Unable to update players list",
    },
    id: 0,
  };
}

export function startGame(data: StartGameData) {
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

export function getCurrentQuestion(game: Game) {
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
    id: 0,
  };
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

export function processAnswer(data: AnswerData, ws: ModifiedWebSocket) {
  const { gameId, questionIndex, answerIndex } = data;
  const game = gamesStorage.findGameById(gameId);

  if (game && game?.questionStartTime) {
    const player = playersStorage.players.find((player) => player.ws === ws);
    if (player) {
      player.hasAnswered = true;
      player.answeredCorrectly =
        game.questions[questionIndex].correctIndex === answerIndex;
      player.answerTime = Date.now() - game.questionStartTime;
      game.playerAnswers.set(player.index, {
        answerIndex: answerIndex,
        timestamp: Date.now(),
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

export function getQuestionResults(game: Game) {
  const playersAnswersResults: {
    name: string;
    answered: boolean;
    correct: boolean;
    pointsEarned: number;
    totalScore: number;
  }[] = updateScore(game);
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

export function checkAllPlayersAnswered(game: Game) {
  console.log("All answered");
  console.log("game players", game.players);

  return game.players.find((player) => !player.hasAnswered) ? false : true;
}

export function isNextQuestionPresent(game: Game) {
  const { currentQuestion } = game;
  if (game.questions[currentQuestion]) {
    return true;
  }
  return false;
}

export function getNextQuestion(game: Game) {
  game.currentQuestion += 1;
  game.questionStartTime = Date.now();
  game.playerAnswers = new Map();
  game.players.forEach((player) => {
    player.answerTime = 0;
    player.answeredCorrectly = false;
    player.hasAnswered = false;
  });
  return getCurrentQuestion(game);
}

export function finishGameMessage(game: Game) {
  game.status = "finished";
  const gameResults = game.players
    .map((player) => {
      return {
        name: player.name,
        score: player.score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, index) => {
      return {
        ...item,
        rank: index + 1,
      };
    });

  return {
    type: "game_finished",
    data: {
      scoreboard: gameResults,
    },
    id: 0,
  };
}

export function proceedGame(
  game: Game,
  wss: Server<typeof WebSocket, typeof IncomingMessage>,
) {
  const timeLimit = game.questions[game.currentQuestion - 1].timeLimitSec;
  setTimeout(() => {
    if (isNextQuestionPresent(game)) {
      sendMessageToPlayers(JSON.stringify(getNextQuestion(game)), game, wss);
      game.questionTimer = setTimeout(() => {
        {
          sendMessageToPlayers(
            JSON.stringify(getQuestionResults(game)),
            game,
            wss,
          );
          console.log("timer expired, send question results to all players");
          proceedGame(game, wss);
        }
      }, timeLimit * 1000);
    } else {
      sendMessageToPlayers(JSON.stringify(finishGameMessage(game)), game, wss);
    }
  }, 2000);
}

function updateScore(game: Game) {
  const { players } = game;
  const timeLimit = game.questions[game.currentQuestion - 1].timeLimitSec;

  const resPlayers = players.map((player) => {
    let earned = 0;
    if (player.answeredCorrectly && player.answerTime) {
      const basePoints = 1;
      const timeBonus = Number(
        (
          basePoints *
          ((timeLimit - player.answerTime / 1000) / timeLimit)
        ).toFixed(1),
      );

      earned = timeBonus + basePoints;
    }
    player.score = Number((player.score + earned).toFixed(1));
    return {
      name: player.name,
      answered: player.hasAnswered || false,
      correct: player.answeredCorrectly || false,
      pointsEarned: earned,
      totalScore: player.score,
    };
  });
  console.log("Updated Score", resPlayers);
  return resPlayers;
}
