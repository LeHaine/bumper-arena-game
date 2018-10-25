const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);

let players = {};
let playerCount = 0;

io.on("connection", socket => {
    players[socket.id] = {
        playerId: socket.id,
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 500) + 50
    };
    playerCount++;
    console.log(
        "Client " +
            socket.id +
            " connected at " +
            players[socket.id].x +
            ", " +
            players[socket.id].y +
            ". Total players: " +
            playerCount
    );

    socket.emit("newPlayer", players[socket.id]);
    socket.broadcast.emit("newEnemyPlayer", players[socket.id]);

    socket.emit("currentPlayers", players);

    socket.on("disconnect", () => {
        delete players[socket.id];
        playerCount--;
        console.log(
            "Client " +
                socket.id +
                " disconnected. Total players: " +
                playerCount
        );
        io.emit("disconnect", socket.id);
    });
});

app.set("port", 8080);
server.listen(app.get("port"), function() {
    console.log(`Listening on ${server.address().port}`);
});
