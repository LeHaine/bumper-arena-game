import Phaser from "phaser";
import io from "socket.io-client";
import playerAsset from "../../assets/player.png";

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
    }

    init() {
        this.lastEmit = 0;
        this.player = null;
        this.connected = false;
        if (__DEV__) {
            this.developerMode = true;
        }
    }

    preload() {
        this.load.image("player", playerAsset);
    }

    create() {
        this.socket = io("http://localhost:8080");
        this.enemies = this.add.group();
        this.socket.on("connect", () => {
            if (this.connected) {
                this.scene.restart();
                return;
            }
            this.connected = true;
            this.socket.on("config", config => {
                this.cameras.main.setBounds(
                    -500,
                    -500,
                    config.worldWidth + 1000,
                    config.worldHeight + 1000
                );
                const grid = this.add.grid(
                    config.worldWidth / 2,
                    config.worldHeight / 2,
                    config.worldWidth,
                    config.worldHeight
                );
                grid.depth = -10;
            });
            this.socket.on("newPlayer", playerInfo => {
                this.addPlayer(playerInfo);
            });

            this.socket.on("currentPlayers", players => {
                Object.keys(players).forEach(id => {
                    if (id !== this.socket.id) {
                        this.addEnemyPlayer(players[id]);
                    }
                });
            });
            this.socket.on("newEnemyPlayer", playerInfo => {
                if (this.socket.id !== playerInfo.id) {
                    this.addEnemyPlayer(playerInfo);
                }
            });

            this.socket.on("playerMoved", playerInfo => {
                if (this.socket.id === playerInfo.id) {
                    this.moveSprite(this.player, playerInfo);
                } else {
                    this.enemies.getChildren().forEach(enemy => {
                        if (enemy.id === playerInfo.id) {
                            this.moveSprite(enemy, playerInfo);
                        }
                    });
                }
            });

            this.socket.on("playerDisconnect", id => {
                if (id === this.player.id) {
                    this.player.destroy();
                    this.player = null;
                }
                this.enemies.getChildren().forEach(enemy => {
                    if (enemy.id === id) {
                        enemy.destroy();
                    }
                });
            });

            this.socket.on("kick", message => {
                this.player.destroy();
                this.player = null;
                this.enemies.getChildren().forEach(enemy => {
                    enemy.destroy();
                });
            });
        });

        if (__DEV__) {
            this.initDevMode();
        }
    }

    update(time, delta) {
        if (this.player) {
            this.socket.emit("movement", this.getMouseWorldPosition());

            if (this.input.activePointer.justDown) {
                this.socket.emit("boost");
            } else if (this.input.activePointer.justUp) {
                this.socket.emit("boostStop");
            }

            if (__DEV__) {
                this.updateDevMode();
            }
        }
    }

    addPlayer(playerInfo) {
        this.player = this.add
            .sprite(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5)
            .setRotation(0);
        this.player.setTint(0x1c6ced);
        this.cameras.main.startFollow(this.player);
        if (__DEV__) {
            this.addSpriteInfoDevMode(this.player, playerInfo);
        }
    }

    addEnemyPlayer(playerInfo) {
        const enemy = this.add
            .sprite(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5)
            .setRotation(0);
        enemy.id = playerInfo.id;
        enemy.setTint(0xe50404);
        this.enemies.add(enemy);
    }

    moveSprite(sprite, playerInfo) {
        if (!sprite || !playerInfo) return;
        sprite.setPosition(playerInfo.position.x, playerInfo.position.y);
        sprite.setRotation(playerInfo.angle);

        if (__DEV__) {
            this.addSpriteInfoDevMode(sprite, playerInfo);
        }
    }

    initDevMode() {
        if (__DEV__) {
            if (!this.developerMode) return;
            const textStyle = {
                fontSize: 18,
                backgroundColor: "#000"
            };
            this.coordsText = this.add
                .text(10, 10, "", textStyle)
                .setScrollFactor(0);
            this.velocityText = this.add
                .text(10, 30, "", textStyle)
                .setScrollFactor(0);
            this.rotationText = this.add
                .text(10, 50, "", textStyle)
                .setScrollFactor(0);
            this.boostingText = this.add
                .text(600, 50, "", textStyle)
                .setScrollFactor(0);
            this.boostText = this.add
                .text(850, 50, "", textStyle)
                .setScrollFactor(0);
            this.knockbackText = this.add
                .text(400, 50, "", textStyle)
                .setScrollFactor(0);
            this.mouseCoords = this.add
                .text(10, 70, "", textStyle)
                .setScrollFactor(0);
        }
    }

    addSpriteInfoDevMode(sprite, playerInfo) {
        if (__DEV__) {
            if (!this.developerMode) return;
            sprite.velocity = playerInfo.velocity;
            sprite.knockback = playerInfo.knockback;
            sprite.boost = playerInfo.boost;
            sprite.boosting = playerInfo.boosting;
        }
    }

    updateDevMode() {
        if (__DEV__) {
            if (!this.developerMode) return;

            this.coordsText.setText(
                "X: " + this.player.x + ", Y: " + this.player.y
            );
            this.velocityText.setText(
                "Velocity: " + JSON.stringify(this.player.velocity)
            );
            this.rotationText.setText("Rotation: " + this.player.angle);
            this.boostingText.setText("Boosting: " + this.player.boosting);
            this.boostText.setText("Boost: " + this.player.boost);
            this.knockbackText.setText("Knockbacked: " + this.player.knockback);
            this.mouseCoords.setText(
                "Mouse: " + JSON.stringify(this.getMouseWorldPosition())
            );
        }
    }

    getMouseWorldPosition() {
        return this.game.input.activePointer.positionToCamera(
            this.cameras.main
        );
    }
}

export default GameScene;
