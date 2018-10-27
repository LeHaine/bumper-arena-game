const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);
const logger = require("./logger");
const MathUtils = require("../shared/MathUtils");

let players = {};
let playerCount = 0;

const speedPerTick = 2.5;
const knockbackMagnitude = 100;

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
        knockback: false
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

    socket.emit("newPlayer", players[socket.id]);
    socket.broadcast.emit("newEnemyPlayer", players[socket.id]);

    socket.on("movement", mousePos => {
        onMovement(mousePos, socket.id);
    });

    socket.on("disconnect", () => {
        onDisconnect(socket.id);
    });
};

const onMovement = (mousePos, id) => {
    let roundedMousePos = {
        x: Math.round(mousePos.x),
        y: Math.round(mousePos.y)
    };
    if (!players[id].knockback) {
        players[id].target = roundedMousePos;
        players[id].angle = MathUtils.calcAngle(
            players[id].position,
            players[id].target
        );
    }
};

const onDisconnect = id => {
    delete players[id];
    playerCount--;
    logger.debug(
        "Client " + id + " disconnected. Total players: " + playerCount
    );
    io.emit("disconnect", id);
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
                    bodyA: player,
                    bodyB: players[id]
                };
                collisions.push(collision);
            }
        }
    });

    collisions.forEach(collision => {
        // TODO process collisions
    });
};

const tickPlayer = player => {
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
