import { randomUUID } from "crypto";
import { ModifiedWebSocket, User } from "../types";

interface UsersStorage {
  users: User[];
  addNewUser(userName: string, password: string, ws: ModifiedWebSocket): string;
  findUser(index: string): User | undefined;
  getUserByName(name: string): User | undefined;
  checkUserPasswordMatch(name: string, password: string): boolean;
}

export const usersStorage: UsersStorage = {
  users: [],
  addNewUser(userName: string, password: string, ws: ModifiedWebSocket) {
    const id = randomUUID();
    this.users.push({ name: userName, password: password, index: id, ws: ws });
    return id;
  },
  findUser(index: string) {
    return this.users.find((user) => user.index === index);
  },
  getUserByName(name: string) {
    return this.users.find((user) => user.name === name);
  },
  checkUserPasswordMatch(name: string, password: string) {
    const user = this.getUserByName(name);
    if (user) {
      return user.password === password;
    }
    return false;
  },
};
