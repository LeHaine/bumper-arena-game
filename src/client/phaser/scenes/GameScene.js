import Phaser from "phaser";
import io from "socket.io-client";
import playerAsset from "../../assets/player.png";

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
    }

    init() {
        this.movement = {
            right: false,
            left: false,
            up: false,
            down: false
        };
    }

    preload() {
        this.load.image("player", playerAsset);
    }

    create() {
        this.socket = io("http://localhost:8080");
        this.enemies = this.physics.add.group();
        this.socket.on("connect", () => {
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
                if (this.socket.id !== playerInfo.playerId) {
                    this.addEnemyPlayer(playerInfo);
                }
            });

            this.socket.on("playerMoved", playerInfo => {
                if (this.socket.id === playerInfo.playerId) {
                    this.player.setPosition(
                        playerInfo.position.x,
                        playerInfo.position.y
                    );
                } else {
                    this.enemies.getChildren().forEach(enemy => {
                        if (enemy.playerId === playerInfo.playerId) {
                            enemy.setPosition(
                                playerInfo.position.x,
                                playerInfo.position.y
                            );
                        }
                    });
                }
            });

            this.socket.on("disconnect", playerId => {
                this.enemies.getChildren().forEach(enemy => {
                    if (enemy.playerId === playerId) {
                        enemy.destroy();
                    }
                });
            });
        });
        setInterval(() => {
            this.socket.emit("movement", this.movement);
        }, 1000 / 60);
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    update(time, delta) {
        this.handleMovement();
    }

    handleMovement() {
        if (this.cursors.left.isDown) {
            this.movement.left = true;
        } else if (this.cursors.right.isDown) {
            this.movement.right = true;
        }

        if (this.cursors.up.isDown) {
            this.movement.up = true;
        } else if (this.cursors.down.isDown) {
            this.movement.down = true;
        }

        if (this.cursors.left.isUp) {
            this.movement.left = false;
        }
        if (this.cursors.right.isUp) {
            this.movement.right = false;
        }

        if (this.cursors.up.isUp) {
            this.movement.up = false;
        }
        if (this.cursors.down.isUp) {
            this.movement.down = false;
        }
    }

    addPlayer(playerInfo) {
        this.player = this.physics.add
            .sprite(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5);
        this.player.setTint(0x1c6ced);
    }

    addEnemyPlayer(playerInfo) {
        const enemy = this.add
            .image(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5);
        enemy.playerId = playerInfo.playerId;
        enemy.setTint(0xe50404);
        this.enemies.add(enemy);
    }
}

export default GameScene;
