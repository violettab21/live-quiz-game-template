import { gamesStorage } from "../db/games";
import { playersStorage } from "../db/players";
import { usersStorage } from "../db/users";
import { Game, JoinGameData, ModifiedWebSocket } from "../types";

export function joinGame(data: JoinGameData, ws: ModifiedWebSocket) {
  const { code } = data;
  const game = gamesStorage.findGame(code);
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
          existingPlayer.ws = ws;
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

export function getUpdatePlayersMessage(game: Game) {
  const players = game.players.map((player) => {
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
