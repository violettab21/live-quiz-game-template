import { ModifiedWebSocket, Player } from "../types";

interface PlayersStorage {
  players: Player[];
  addPlayer(player: Player): void;
}

export const playersStorage: PlayersStorage = {
  players: [],
  addPlayer(player: Player) {
    this.players.push(player);
  },
};
