const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);
const logger = require("./logger");
const MathUtils = require("../shared/MathUtils");

let players = {};
let playerCount = 0;

let sockets = {};

const speedPerTick = 2.5;
const knockbackMagnitude = 15;
const maxHeartbeatInterval = 5000;

const onConnect = socket => {
    let player = {
        id: socket.id,
        position: {
            x: Math.floor(Math.random() * 500) + 50,
            y: Math.floor(Math.random() * 500) + 50
        },
        radius: 16,
        angle: 0,
        target: {
            x: 0,
            y: 0
        },
        knockback: false,
        lastHeartbeat: new Date().getTime()
    };
    playerCount++;
    logger.debug(
        "Client " +
            socket.id +
            " connected at " +
            player.position.x +
            ", " +
            player.position.y +
            ". Total players: " +
            playerCount
    );
    socket.emit("currentPlayers", players);

    players[socket.id] = player;
    sockets[socket.id] = socket;

    socket.emit("newPlayer", players[socket.id]);
    socket.broadcast.emit("newEnemyPlayer", players[socket.id]);

    socket.on("movement", mousePos => {
        onMovement(mousePos, socket.id);
    });

    socket.on("disconnect", () => {
        onDisconnect(socket);
    });
};

const onMovement = (mousePos, id) => {
    let roundedMousePos = {
        x: Math.round(mousePos.x),
        y: Math.round(mousePos.y)
    };
    players[id].lastHeartbeat = new Date().getTime();
    if (!players[id].knockback) {
        players[id].target = roundedMousePos;
        players[id].angle = MathUtils.calcAngle(
            players[id].position,
            players[id].target
        );
    }
};

const onDisconnect = socket => {
    let id = socket.id;
    delete players[id];
    playerCount--;
    logger.debug(
        "Client " + id + " disconnected. Total players: " + playerCount
    );
    io.emit("playerDisconnect", id);
};

const movePlayer = player => {
    let dx = player.target.x - player.position.x;
    let dy = player.target.y - player.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let newX = player.position.x;
    let newY = player.position.y;
    if (dist > speedPerTick) {
        let ratio = speedPerTick / dist;
        let xDiff = ratio * dx;
        let yDiff = ratio * dy;
        newX = xDiff + player.position.x;
        newY = yDiff + player.position.y;
    } else {
        newX = player.target.x;
        newY = player.target.y;
        player.knockback = false;
    }

    player.position = { x: newX, y: newY };
};

const checkCollisions = player => {
    let collisions = [];
    Object.keys(players).forEach(id => {
        if (id !== player.id) {
            let intersected = MathUtils.intersects(player, players[id]);

            if (intersected) {
                let collision = {
                    bodyA: { player: player, headOn: false },
                    bodyB: { player: players[id], headOn: false }
                };

                let angleDiff = Math.abs(
                    collision.bodyA.player.angle - collision.bodyB.player.angle
                );
                collision.bodyA.headOn = true;
                if (angleDiff < 90) {
                    collision.bodyB.headOn = true;
                }
                collisions.push(collision);
            }
        }
    });

    collisions.forEach(collision => {});
};

const tickPlayer = player => {
    if (player.lastHeartbeat < new Date().getTime() - maxHeartbeatInterval) {
        sockets[player.id].emit("kick", "Timed out");
        sockets[player.id].disconnect();
    }
    movePlayer(player);
    checkCollisions(player);
};

const updatePhysics = () => {
    Object.keys(players).forEach(id => {
        tickPlayer(players[id]);
    });
};

const sendUpdates = () => {
    Object.keys(players).forEach(id => {
        io.emit("playerMoved", players[id]);
    });
};

io.on("connection", onConnect);

setInterval(updatePhysics, 1000 / 60);
setInterval(sendUpdates, 40);

app.set("port", 8080);
server.listen(app.get("port"), function() {
    logger.info(`Listening on ${server.address().port}`);
});
