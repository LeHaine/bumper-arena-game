const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);
const Matter = require("matter-js");
const logger = require("./logger");
const MathUtils = require("../shared/MathUtils");

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Events = Matter.Events;

let players = {};
let playerCount = 0;

// physics info
let engine = Engine.create();
let world = engine.world;

const speedPerTick = 2.5;
const hitMagnitude = 25;

const onConnect = socket => {
    let player = {
        playerId: socket.id,
        body: Bodies.circle(
            Math.floor(Math.random() * 500) + 50,
            Math.floor(Math.random() * 500) + 50,
            16,
            { label: socket.id }
        ),
        target: {
            x: 0,
            y: 0
        }
    };
    playerCount++;
    logger.debug(
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

    let playersInfo = getPlayersInfo();
    socket.emit("currentPlayers", playersInfo);

    players[socket.id] = player;

    let playerInfo = getPlayerInfo(players[socket.id]);
    socket.emit("newPlayer", playerInfo);
    socket.broadcast.emit("newEnemyPlayer", playerInfo);

    socket.on("movement", mousePos => {
        onMovement(mousePos, socket.id);
    });

    socket.on("disconnect", () => {
        onDisconnect(socket.id);
    });
};

const onMovement = (mousePos, id) => {
    let playerBody = players[id].body;
    let roundedMousePos = {
        x: Math.round(mousePos.x),
        y: Math.round(mousePos.y)
    };
    players[id].target = roundedMousePos;
    let angle = MathUtils.calcAngle(playerBody.position, roundedMousePos);
    Body.setAngle(playerBody, angle);
};

const onDisconnect = id => {
    delete players[id];
    playerCount--;
    logger.debug(
        "Client " + id + " disconnected. Total players: " + playerCount
    );
    io.emit("disconnect", id);
};

const getPlayerInfo = player => {
    if (!player) {
        return;
    }
    let playerInfo = {
        playerId: player.playerId,
        position: player.body.position,
        angle: player.body.angle,
        velocity: player.body.velocity
    };

    return playerInfo;
};

const getPlayersInfo = () => {
    let playersInfo = {};
    Object.keys(players).forEach(id => {
        playersInfo[id] = getPlayerInfo(players[id]);
    });
    return playersInfo;
};

const tickPlayer = player => {
    let dx = player.target.x - player.body.position.x;
    let dy = player.target.y - player.body.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let newX = 0;
    let newY = 0;
    if (dist > speedPerTick) {
        let ratio = speedPerTick / dist;
        let xDiff = ratio * dx;
        let yDiff = ratio * dy;
        newX = xDiff + player.body.position.x;
        newY = yDiff + player.body.position.y;
    } else {
        newX = player.target.x;
        newY = player.target.y;
    }

    Body.setPosition(player.body, { x: newX, y: newY });
};

const updatePhysics = () => {
    Engine.update(engine);
    Object.keys(players).forEach(id => {
        tickPlayer(players[id]);
    });
};

const sendUpdates = () => {
    Object.keys(players).forEach(id => {
        let playerInfo = getPlayerInfo(players[id]);
        io.emit("playerMoved", playerInfo);
    });
};

const initPhysicsEngine = () => {
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;

    Events.on(engine, "collisionStart", event => {
        let pairs = event.pairs;
        pairs.forEach(pairs => {
            let bodyA = pairs.bodyA;
            let bodyB = pairs.bodyB;
            let angle = bodyA.angle;

            Body.translate(
                bodyA,
                MathUtils.moveTowardsPoint(-angle, hitMagnitude)
            );
            Body.translate(
                bodyB,
                MathUtils.moveTowardsPoint(angle, hitMagnitude * 2)
            );
        });
    });

    logger.info("Physics engine running...");
};

io.on("connection", onConnect);

initPhysicsEngine();
setInterval(updatePhysics, 1000 / 60);
setInterval(sendUpdates, 40);

app.set("port", 8080);
server.listen(app.get("port"), function() {
    logger.info(`Listening on ${server.address().port}`);
});
