"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"]
    }
});
const { v4: uuidv4 } = require('uuid');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'chat_app'
});
connection.connect();
const activeUsers = {};
io.on('connection', (socket) => {
    console.log('a user connected');
    // LOGIN LOGIC
    socket.on('login', (data) => __awaiter(void 0, void 0, void 0, function* () {
        // We are passing user data as username;id
        const processedData = data.split(";");
        const username = processedData[0];
        const id = data.split(";")[1];
        console.log("logged in" + socket.id);
        if (id) {
            // Lekérjük hogy van-e ilyen nevű active felhasználó
            connection.query(`select * from users where username = '${username}' and active = 1;`, function (error, results, fields) {
                if (error)
                    throw error;
                // Ha nincs akkor "bejelentkeztetjük", azaz létrehozzuk a felhasználót az adatbázisban
                // és true-ra állítjuk az active mezőjét, majd az id-ját visszaküldjük a kliensnek.
                if (results.length == 0) {
                    console.log('Logging in user...');
                    // adatbázisban eltároljuk a bejelentkezett felhasználót
                    connection.query(`update users set active = 1 where id = '${id}';`);
                    activeUsers[socket.id] = id;
                    io.emit("logged in" + socket.id, `${username};${id}`);
                }
                else {
                    console.log('User exists...');
                    // Ha van ilyen nevű bejelentkezett user akkor tudatjuk a klienssel.
                    io.emit("existing user" + socket.id, "true");
                }
            });
        }
        else {
            // Lekérjük hogy van-e ilyen nevű active felhasználó
            connection.query(`select * from users where username = '${username}' and active = 1;`, function (error, results, fields) {
                if (error)
                    throw error;
                // Ha nincs akkor "bejelentkeztetjük", azaz létrehozzuk a felhasználót az adatbázisban
                // és true-ra állítjuk az active mezőjét, majd az id-ját visszaküldjük a kliensnek.
                if (results.length == 0) {
                    console.log('Logging in user...');
                    // User id generálása
                    const userUuid = uuidv4();
                    // adatbázisban eltároljuk a bejelentkezett felhasználót
                    connection.query(`insert into users values ('${userUuid}', '${username}', 1);`);
                    // active userek közé elmentjük a jelenlegi kapcsolat id-ját és hozzá kapcsolva
                    // az adatbázisba mentett user id-ját
                    activeUsers[socket.id] = userUuid;
                    io.emit("logged in" + socket.id, `${username};${userUuid}`);
                }
                else {
                    console.log('User exists...');
                    // Ha van ilyen nevű bejelentkezett user akkor tudatjuk a klienssel.
                    io.emit("existing user" + socket.id, "true");
                }
            });
        }
    }));
    // Ha lecsatlakozik a kliens, kitöröljük az active userek közül és
    // az adatbázisban is visszaállítjuk 0-ra az active mezőjét!
    socket.on('disconnecting', () => {
        console.log('Disconnecting user...');
        const userUuid = activeUsers[socket.id];
        delete activeUsers[socket.id];
        if (userUuid) {
            connection.query(`update users set active = 0 where id = '${userUuid}';`);
        }
    });
    // Online userek lekérése
    socket.on('active users', () => {
        console.log(`Fetch active users`);
        connection.query(`select * from users where active = 1;`, (error, results) => {
            socket.emit('active users client', results);
        });
    });
    socket.on('get all messages', (msg) => {
        connection.query(`
      SELECT users.id as user_id, users.username, message, create_date
      FROM messages
      inner join users
      on users.id = messages.from_id
      ORDER BY create_date;`, (error, results) => {
            socket.emit('all messages client', results);
        });
    });
    socket.on('new public message', (request) => {
        connection.query(`INSERT INTO messages (from_id, message) VALUES ('${request.fromId}', '${request.message}');`, (error, results, fields) => {
            connection.query(`SELECT * FROM messages inner join users on users.id = messages.from_id WHERE messages.id = '${results.insertId}';`, (errors, insertResults) => {
                socket.emit("new public message client", insertResults);
            });
        });
    });
    socket.on('get all private message', (request) => {
        connection.query(`SELECT * FROM private_messages WHERE (from_id = '${request.from}' and to_id = '${request.to}') or (from_id = '${request.to}' and to_id = '${request.from}') order by current_timestamp;`, (errors, results) => {
            socket.emit('get all private message client' + request.from, results);
        });
    });
    socket.on('new private message', (request) => {
        connection.query(`INSERT INTO private_messages (message, from_id, to_id) VALUES ('${request.message}', '${request.from}', '${request.to}');`, (error, result) => {
            connection.query(`SELECT * FROM private_messages id = ${result.id};`, (selectError, selectResult) => {
                socket.emit('new private message client' + request.from, selectResult);
                socket.emit('new private message client' + request.to, selectResult);
            });
        });
    });
});
server.listen(3000, () => {
    console.log('listening on *:3000');
});
//# sourceMappingURL=index.js.map