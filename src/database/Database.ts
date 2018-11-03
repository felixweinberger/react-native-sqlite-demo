import SQLite from "react-native-sqlite-storage";
import { DatabaseInitialization } from "./DatabaseInitialization";
import { List } from "../types/List";
import { ListItem } from "../types/ListItem";

export interface Database {
  open(): Promise<SQLite.SQLiteDatabase>;
  close(): Promise<void>;
  createList(newListTitle: string): Promise<void>;
  getAllLists(): Promise<List[]>;
  addListItem(text: string, list: List): Promise<void>;
  getListItems(list: List): Promise<ListItem[]>;
}

class DatabaseImpl implements Database {
  private databaseName = "AppDatabase.db";
  private database: SQLite.SQLiteDatabase | undefined;

  // Open the connection to the database
  public open(): Promise<SQLite.SQLiteDatabase> {
    SQLite.DEBUG(true);
    SQLite.enablePromise(true);
    let databaseInstance: SQLite.SQLiteDatabase;

    return SQLite.openDatabase({
      name: this.databaseName,
      location: "default"
    })
      .then(db => {
        databaseInstance = db;
        console.log("[db] Database open!");

        // Perform any database initialization or updates, if needed
        const databaseInitialization = new DatabaseInitialization();
        return databaseInitialization.updateDatabaseTables(databaseInstance);
      })
      .then(() => {
        this.database = databaseInstance;
        return databaseInstance;
      });
  }

  // close the connection to the database
  public close(): Promise<void> {
    if (this.database === undefined) {
      return Promise.reject("[db] Database was not open; unable to close.");
    }
    return this.database.close().then(status => {
      console.log("[db] Database closed.");
      this.database = undefined;
    });
  }

  // Insert a new list into the database
  public createList(newListTitle: string): Promise<void> {
    return this.getDatabase()
      .then(db =>
        db.executeSql("INSERT INTO List (title) VALUES (?);", [newListTitle])
      )
      .then(([results]) => {
        const { insertId } = results;
        console.log(
          `[db] Added list with title: "${newListTitle}"! InsertId: ${insertId}`
        );
      });
  }

  // Get an array of all the lists in the database
  public getAllLists(): Promise<List[]> {
    console.log("[db] Fetching lists from the db...");
    return this.getDatabase()
      .then(db => db.executeSql("SELECT list_id as id, title FROM List;"))
      .then(([results]) => {
        if (results === undefined) {
          return [];
        }
        const count = results.rows.length;
        const lists: List[] = [];
        for (let i = 0; i < count; i++) {
          const row = results.rows.item(i);
          const { title, id } = row;
          console.log(`[db] List title: ${title}, id: ${id}`);
          lists.push({ id, title });
        }
        return lists;
      });
  }

  public addListItem(text: string, list: List): Promise<void> {
    if (list === undefined) {
      return Promise.reject(Error(`Could not add item to undefined list.`));
    }
    return this.getDatabase()
      .then(db =>
        db.executeSql("INSERT INTO ListItem (text, list_id) VALUES (?, ?);", [
          text,
          list.id
        ])
      )
      .then(([results]) =>
        console.log(
          `[db] ListItem with "${text}" created successfully with id: ${
            results.insertId
          }`
        )
      );
  }

  public getListItems(list: List): Promise<ListItem[]> {
    if (list === undefined) {
      return Promise.resolve([]);
    }
    return this.getDatabase()
      .then(db =>
        db.executeSql(
          "SELECT item_id as id, text, done FROM ListItem WHERE list_id = ?;",
          [list.id]
        )
      )
      .then(([results]) => {
        if (results === undefined) {
          return [];
        }
        const count = results.rows.length;
        const listItems: ListItem[] = [];
        for (let i = 0; i < count; i++) {
          const row = results.rows.item(i);
          const { text, doneNumber, id } = row;
          const done = doneNumber === 1 ? true : false;

          console.log(`[db] List item text: ${text}, done? ${done} id: ${id}`);
          listItems.push({ id, text, done });
        }
        console.log(`[db] List items for list "${list.title}":`, listItems);
        return listItems;
      });
  }

  private getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.database !== undefined) {
      return Promise.resolve(this.database);
    }
    // otherwise: open the database first
    return this.open();
  }
}

// Export a single instance of DatabaseImpl
export let database: Database = new DatabaseImpl();
