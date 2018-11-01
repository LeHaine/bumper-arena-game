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
const Vector = Matter.Vector;

const engine = Engine.create();
const world = engine.world;

let players = {};
let bodies = {};
let playerCount = 0;

let sockets = {};

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
        velocity: {
            x: 0,
            y: 0
        },
        knockback: false,
        lastHeartbeat: new Date().getTime()
    };

    let body = Bodies.circle(
        player.position.x,
        player.position.y,
        player.radius,
        {
            label: socket.id,
            inertia: Infinity,
            friction: 0,
            frictionAir: 0,
            render: { visible: false }
        }
    );

    player.position = body.position;
    player.velocity = body.velocity;

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
        player.lastHeartbeat = new Date().getTime();
        if (player.knockback) {
            return;
        }

        player.target = mousePos;
        body.angle = Vector.angle(player.position, player.target);
        player.angle = body.angle;
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        delete bodies[socket.id];
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
    if (!player || !bodies[player.id]) return;
    let body = bodies[player.id];
    let dx = player.target.x - body.position.x;
    let dy = player.target.y - body.position.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    let tickSpeed = config.speedPerTick;
    if (player.knockback) {
        tickSpeed = config.knockbackSpeedperTick;
    }
    if (dist > tickSpeed) {
        let ratio = tickSpeed / dist;
        let xDiff = ratio * dx;
        let yDiff = ratio * dy;
        Body.setVelocity(body, { x: xDiff, y: yDiff });
    } else {
        Body.setVelocity(body, { x: 0, y: 0 });
        player.knockback = false;
    }
};

const tickPlayer = player => {
    if (
        !player ||
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

    const handleCollision = event => {
        let pairs = event.pairs;
        pairs.forEach(pair => {
            let bodyA = pair.bodyA;
            let bodyB = pair.bodyB;
            let playerA = players[pair.bodyA.label];
            let playerB = players[pair.bodyB.label];
            if (!playerA || !playerB) {
                return;
            }
            playerA.knockback = true;
            playerB.knockback = true;
            let angle = Vector.angle(playerA.position, playerB.position);
            angle = MathUtils.toDegrees(angle);
            let velocity = { x: 0, y: 0 };

            if (angle >= -112 && angle <= -68) {
                // top
                velocity.y = 1;
            } else if (angle > -68 && angle < 22) {
                // top right
                velocity.x = -1;
                velocity.y = 1;
            } else if (angle >= -22 && angle <= 22) {
                // right
                velocity.x = -1;
            } else if (angle > 22 && angle < 68) {
                // bottom right
                velocity.x = -1;
                velocity.y = -1;
            } else if (angle >= 68 && angle <= 112) {
                // bottom
                velocity.y = -1;
            } else if (angle > 112 && angle < 158) {
                // bottom left
                velocity.x = 1;
                velocity.y = -1;
            } else if (angle >= 158 || angle <= -158) {
                // left
                velocity.x = 1;
            } else if (angle > -158 && angle < -112) {
                // top left
                velocity.y = 1;
                velocity.x = 1;
            }

            playerA.target = Vector.add(
                playerA.position,
                Vector.mult(velocity, config.knockbackMagnitude)
            );
            playerB.target = Vector.add(
                playerB.position,
                Vector.mult(Vector.neg(velocity), config.knockbackMagnitude)
            );
        });
    };

    Events.on(engine, "collisionStart", handleCollision);
    //  Events.on(engine, "collisionActive", handleCollision);
    logger.info("Physics engine running...");
};

initPhysicsEngine();
setInterval(update, 1000 / 60);
setInterval(sendClientUpdates, config.clientUpdateInterval);

io.on("connection", onConnect);

app.set("port", config.port);
server.listen(app.get("port"), () => {
    logger.info(`Listening on ${server.address().port}`);
});
