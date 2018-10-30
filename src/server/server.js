const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);
const Matter = require("matter-js");
const logger = require("./logger");
const MathUtils = require("../shared/MathUtils");
const config = require("./config.json");

const Engine = Matter.Engine;
const Body = Matter.Body;
const Bodies = Matter.Bodies;
const Events = Matter.Events;
const World = Matter.World;

const engine = Engine.create();
const world = engine.world;

let players = {};
let bodies = {};
let playerCount = 0;

let sockets = {};

let bodiesToApplyForce = [];

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
        lastHeartbeat: new Date().getTime()
    };

    let body = Bodies.circle(
        player.position.x,
        player.position.y,
        player.radius,
        {
            label: socket.id,
            restitution: 1,
            inertia: Infinity,
            friction: 0,
            frictionAir: 0
        }
    );

    player.position = body.position;

    World.add(world, body);

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
    bodies[socket.id] = body;

    socket.emit("newPlayer", players[socket.id]);
    socket.broadcast.emit("newEnemyPlayer", players[socket.id]);

    socket.on("movement", mousePos => {
        let roundedMousePos = {
            x: Math.round(mousePos.x),
            y: Math.round(mousePos.y)
        };

        player.lastHeartbeat = new Date().getTime();
        player.target = roundedMousePos;
        body.angle = Matter.Vector.angle(player.position, player.target);
        player.angle = body.angle;
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        playerCount--;
        logger.debug(
            "Client " +
                socket.id +
                " disconnected. Total players: " +
                playerCount
        );
        socket.broadcast.emit("playerDisconnect", socket.id);
    });
};

const movePlayer = player => {
    let body = bodies[player.id];
    let dx = player.target.x - body.position.x;
    let dy = player.target.y - body.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > config.speedPerTick) {
        let ratio = config.speedPerTick / dist;
        let xDiff = ratio * dx;
        let yDiff = ratio * dy;
        Body.setVelocity(body, { x: xDiff, y: yDiff });
    } else {
        Body.setVelocity(body, { x: 0, y: 0 });
    }
};

const tickPlayer = player => {
    if (
        player.lastHeartbeat <
        new Date().getTime() - config.maxHeartbeatInterval
    ) {
        sockets[player.id].emit("kick", "Timed out");
        sockets[player.id].disconnect();
    }
    movePlayer(player);
};

const update = () => {
    Engine.update(engine);
    Object.keys(players).forEach(id => {
        tickPlayer(players[id]);
    });
};

const sendClientUpdates = () => {
    Object.keys(players).forEach(id => {
        io.emit("playerMoved", players[id]);
    });
};

const initPhysicsEngine = () => {
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    Events.on(engine, "beforeUpdate", event => {
        bodiesToApplyForce.forEach(body => {});
    });
    Events.on(engine, "collisionStart", event => {});
    logger.info("Physics engine running...");
};

initPhysicsEngine();
setInterval(update, 1000 / 60);
setInterval(sendClientUpdates, 40);

io.on("connection", onConnect);

app.set("port", config.port);
server.listen(app.get("port"), () => {
    logger.info(`Listening on ${server.address().port}`);
});
