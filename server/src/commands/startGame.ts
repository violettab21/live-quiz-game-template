import { gamesStorage } from "../db/games";
import { Game, StartGameData } from "../types";

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
