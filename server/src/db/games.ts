import { randomUUID } from "node:crypto";
import { Game, Question } from "../types";

interface GamesStorage {
  games: Game[];
  addGame(questions: Question[], hostId: string): Game;
}

export const gamesStorage: GamesStorage = {
  games: [],
  addGame(questions, hostId) {
    const gameId = randomUUID();
    const code = generateCode(); //logic to generate random code
    const mapPlaceholder = new Map();

    return {
      id: gameId,
      code: code,
      hostId: hostId,
      questions: questions,
      players: [],
      currentQuestion: -1,
      status: "waiting",
      playerAnswers: mapPlaceholder,
    };
  },
};

function generateCode() {
  const sourceArray: number[] = [];
  const randomPositions: number[] = [];
  for (let i = 48; i <= 57; i++) {
    sourceArray.push(i);
  }
  for (let i = 65; i <= 90; i++) {
    sourceArray.push(i);
  }
  for (let i = 97; i <= 122; i++) {
    sourceArray.push(i);
  }
  for (let i = 0; i < 6; i++) {
    randomPositions.push(Math.floor(Math.random() * (sourceArray.length - 1)));
  }
  const code = randomPositions
    .map((randomIndex) => String.fromCharCode(sourceArray[randomIndex]))
    .join("");
  return code;
}
