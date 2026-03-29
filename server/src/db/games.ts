import { randomUUID } from "node:crypto";
import { Game, Player, Question } from "../types.js";

interface GamesStorage {
  games: Game[];
  addGame(questions: Question[], hostId: string): Game;
  findGame(code: string): Game | undefined;
  addPlayer(player: Player, gameId: string): void;
  findGameById(id: string): Game | undefined;
  removePlayer(gameId: string, userId: string): void;
}

export const gamesStorage: GamesStorage = {
  games: [],
  addGame(questions, hostId) {
    const gameId = randomUUID();
    const code = generateCode();
    const mapPlaceholder = new Map();
    const game: Game = {
      id: gameId,
      code: code,
      hostId: hostId,
      questions: questions,
      players: [],
      currentQuestion: -1,
      status: "waiting",
      playerAnswers: mapPlaceholder,
    };
    this.games.push(game);
    return game;
  },
  findGame(code: string) {
    return this.games.find(
      (game: Game) => game.code.toLowerCase() === code.toLocaleLowerCase(),
    );
  },
  findGameById(id: string) {
    return this.games.find((game: Game) => game.id === id);
  },
  addPlayer(player: Player, gameId: string) {
    const game = this.games.find((game) => game.id === gameId);
    if (game) {
      game.players.push(player);
    }
  },
  removePlayer(gameId: string, userId: string) {
    const index = this.games.findIndex((game) => game.id === gameId);
    if (index !== -1) {
      const updatedPlayers = this.games[index].players.filter(
        (player) => player.index !== userId,
      );
      this.games[index].players = updatedPlayers;
    }
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
