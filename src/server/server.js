const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);
const Matter = require("matter-js");

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

let players = {};
let playerCount = 0;

// physics info
let engine = Engine.create();
let world = engine.world;

const onConnect = socket => {
    players[socket.id] = {
        playerId: socket.id,
        body: Bodies.circle(
            Math.floor(Math.random() * 500) + 50,
            Math.floor(Math.random() * 500) + 50,
            32
        ),
        lastTimeMoved: new Date().getTime()
    };
    playerCount++;
    let player = players[socket.id];
    console.log(
        "Client " +
            socket.id +
            " connected at " +
            player.body.position.x +
            ", " +
            player.body.position.y +
            ". Total players: " +
            playerCount
    );
    World.add(world, player.body);

    let playerInfo = getPlayerInfo(players[socket.id]);

    socket.emit("newPlayer", playerInfo);
    socket.broadcast.emit("newEnemyPlayer", playerInfo);

    let playersInfo = getPlayersInfo();

    socket.emit("currentPlayers", playersInfo);

    socket.on("movement", movement => {
        onMovement(movement, socket.id);
    });

    socket.on("disconnect", () => {
        onDisconnect(socket.id);
    });
};

const onMovement = (movement, id) => {
    let currentTime = new Date().getTime();
    let diff = currentTime - players[id].lastTimeMoved;
    if (diff < 1000 / 60) {
        return;
    }
    players[id].lastTimeMoved = currentTime;
    let playerBody = players[id].body;
    let moved = false;
    if (movement.left) {
        moved = true;
        Body.translate(playerBody, { x: -5, y: 0 });
    } else if (movement.right) {
        moved = true;
        Body.translate(playerBody, { x: 5, y: 0 });
    }
    if (movement.up) {
        moved = true;
        Body.translate(playerBody, { x: 0, y: -5 });
    } else if (movement.down) {
        moved = true;
        Body.translate(playerBody, { x: 0, y: 5 });
    }
    let playerInfo = getPlayerInfo(players[id]);
    if (moved) {
        io.emit("playerMoved", playerInfo);
    }
};

const onDisconnect = id => {
    delete players[id];
    playerCount--;
    console.log(
        "Client " + id + " disconnected. Total players: " + playerCount
    );
    io.emit("disconnect", id);
};

const updatePhysics = () => {
    Engine.update(engine);
};

const getPlayerInfo = player => {
    let playerInfo = {
        playerId: player.playerId,
        position: player.body.position
    };

    return playerInfo;
};

const getPlayersInfo = () => {
    let playersInfo = {};
    Object.keys(players).forEach(id => {
        playersInfo[id] = {
            playerId: players[id].playerId,
            position: players[id].body.position
        };
    });
    return playersInfo;
};

io.on("connection", onConnect);

app.set("port", 8080);
server.listen(app.get("port"), function() {
    console.log(`Listening on ${server.address().port}`);
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    setInterval(updatePhysics, 1000 / 60);
    console.log("Physics engine running...");
});
