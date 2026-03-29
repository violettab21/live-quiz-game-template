import { gamesStorage } from "../db/games";
import { CreateGameData } from "../types";

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
