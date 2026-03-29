import { BASIC_POINT } from "../constants/constants";
import { gamesStorage } from "../db/games";
import { playersStorage } from "../db/players";
import { AnswerData, Game, ModifiedWebSocket } from "../types";
import { getCurrentQuestion } from "./startGame";

export function processAnswer(data: AnswerData, ws: ModifiedWebSocket) {
  const { gameId, questionIndex, answerIndex } = data;
  const game = gamesStorage.findGameById(gameId);

  if (game && game?.questionStartTime) {
    const player = playersStorage.players.find(
      (player) => player.index === ws.userId,
    );
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

function updateScore(game: Game) {
  const { players } = game;
  const timeLimit = game.questions[game.currentQuestion - 1].timeLimitSec;

  const resPlayers = players.map((player) => {
    let earned = 0;
    if (player.answeredCorrectly && player.answerTime) {
      const basePoints = BASIC_POINT;
      const timeBonus = (timeLimit - player.answerTime / 1000) / timeLimit;
      earned = Math.round(timeBonus * basePoints);
    }
    player.score += earned;
    return {
      name: player.name,
      answered: player.hasAnswered || false,
      correct: player.answeredCorrectly || false,
      pointsEarned: earned,
      totalScore: player.score,
    };
  });
  return resPlayers;
}
