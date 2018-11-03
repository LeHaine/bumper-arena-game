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
        this.developerMode = true;
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
        });

        this.initDevMode();
    }

    update(time, delta) {
        if (this.player) {
            this.socket.emit("movement", {
                x: this.input.mousePointer.x,
                y: this.input.mousePointer.y
            });
            this.updateDevMode();
        }
    }

    addPlayer(playerInfo) {
        this.player = this.add
            .sprite(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5)
            .setRotation(0);
        this.player.setTint(0x1c6ced);
        this.addSpriteInfoDevMode(this.player, playerInfo);
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
        this.addSpriteInfoDevMode(sprite, playerInfo);
    }

    initDevMode() {
        if (!this.developerMode) return;
        this.coordsText = this.add.text(10, 10);
        this.velocityText = this.add.text(10, 25);
        this.rotationText = this.add.text(10, 40);
        this.knockbackText = this.add.text(400, 40);
    }

    addSpriteInfoDevMode(sprite, playerInfo) {
        if (!this.developerMode) return;
        sprite.velocity = playerInfo.velocity;
        sprite.knockback = playerInfo.knockback;
    }

    updateDevMode() {
        if (!this.developerMode) return;

        this.coordsText.setText(
            "X: " + this.player.x + ", Y: " + this.player.y
        );
        this.velocityText.setText(
            "Velocity: " + JSON.stringify(this.player.velocity)
        );
        this.rotationText.setText("Rotation: " + this.player.angle);
        this.knockbackText.setText("Knockbacked: " + this.player.knockback);
    }
}

export default GameScene;
