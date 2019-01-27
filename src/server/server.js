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

let clients = {};

const onConnect = client => {
    let player = {
        id: client.id,
        position: {
            x: Math.floor(Math.random() * config.worldWidth),
            y: Math.floor(Math.random() * config.worldHeight)
        },
        boost: config.maxBoost,
        radius: config.playerRadius,
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
        boosting: false,
        lastHeartbeat: new Date().getTime()
    };

    let body = Bodies.circle(
        player.position.x,
        player.position.y,
        player.radius,
        {
            label: client.id,
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
            client.id +
            " connected at " +
            player.position.x +
            ", " +
            player.position.y +
            ". Total players: " +
            playerCount
    );
    client.emit("currentPlayers", players);

    players[client.id] = player;
    clients[client.id] = client;
    bodies[client.id] = body;

    client.emit("newPlayer", players[client.id]);
    client.broadcast.emit("newEnemyPlayer", players[client.id]);

    client.on("movement", mousePos => {
        player.lastHeartbeat = new Date().getTime();
        if (player.knockback) {
            return;
        }

        player.target = mousePos;
        body.angle = Vector.angle(player.position, player.target) + Math.PI / 2;
        player.angle = body.angle;
    });

    client.on("boost", () => {
        if (player.boost > 0) {
            player.boosting = true;
        }
    });

    client.on("boostStop", () => {
        player.boosting = false;
    });

    client.on("disconnect", () => {
        delete players[client.id];
        delete bodies[client.id];
        playerCount--;
        logger.debug(
            "Client " +
                client.id +
                " disconnected. Total players: " +
                playerCount
        );
        client.broadcast.emit("playerDisconnect", client.id);
    });
    client.emit("config", {
        worldWidth: config.worldWidth,
        worldHeight: config.worldHeight
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
    } else if (player.boosting) {
        tickSpeed = config.speedPerTick * config.boostMagnitude;
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

const updateBoost = player => {
    if (player.boosting) {
        player.boost -= config.boostDepleteRate;
        if (player.boost <= 0) {
            player.boosting = false;
        }
    } else {
        if (player.boost < config.maxBoost) {
            player.boost += config.boostRegenRate;
        }
        if (player.boost > config.maxBoost) {
            player.boost = config.maxBoost;
        }
    }
};

const tickPlayer = player => {
    if (
        !player ||
        player.lastHeartbeat <
            new Date().getTime() - config.maxHeartbeatInterval
    ) {
        clients[player.id].emit("kick", "Timed out");
        clients[player.id].disconnect();
    }
    updateBoost(player);
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

const normalizeTarget = target => {
    if (target.x < config.playerRadius) {
        target.x = config.playerRadius;
    } else if (target.x > config.worldWidth - config.playerRadius) {
        target.x = config.worldWidth - config.playerRadius;
    }
    if (target.y < config.playerRadius) {
        target.y = config.playerRadius;
    } else if (target.y > config.worldHeight - config.playerRadius) {
        target.y = config.worldHeight - config.playerRadius;
    }
};
const initPhysicsEngine = () => {
    world.gravity.y = 0;
    world.gravity.x = 0;
    const leftWall = Bodies.rectangle(
        -50,
        config.worldHeight / 2,
        100,
        config.worldHeight,
        {
            isStatic: true
        }
    );
    const rightWall = Bodies.rectangle(
        config.worldWidth + 50,
        config.worldHeight / 2,
        100,
        config.worldHeight,
        { isStatic: true }
    );
    const topWall = Bodies.rectangle(
        config.worldWidth / 2,
        -50,
        config.worldWidth,
        100,
        {
            isStatic: true
        }
    );
    const bottomWall = Bodies.rectangle(
        config.worldWidth / 2,
        config.worldHeight + 50,
        config.worldWidth,
        100,
        { isStatic: true }
    );
    World.add(world, [leftWall, rightWall, topWall, bottomWall]);
    const handleCollision = event => {
        let pairs = event.pairs;
        pairs.forEach(pair => {
            let playerA = players[pair.bodyA.label];
            let playerB = players[pair.bodyB.label];
            if (!playerA || !playerB) {
                return;
            }
            playerA.knockback = true;
            playerB.knockback = true;
            let angle = Vector.angle(playerA.position, playerB.position);
            let velocity = { x: 0, y: 0 };

            velocity.x = -Math.cos(angle);
            velocity.y = -Math.sin(angle);

            playerA.target = Vector.add(
                playerA.position,
                Vector.mult(velocity, config.knockbackMagnitude)
            );
            playerB.target = Vector.add(
                playerB.position,
                Vector.mult(Vector.neg(velocity), config.knockbackMagnitude)
            );

            normalizeTarget(playerA.target);
            normalizeTarget(playerB.target);
        });
    };

    Events.on(engine, "collisionStart", handleCollision);
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
