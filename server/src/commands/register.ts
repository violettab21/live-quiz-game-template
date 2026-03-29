import { usersStorage } from "../db/users.js";
import { ModifiedWebSocket, RegData, WSMessage } from "../types";

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
