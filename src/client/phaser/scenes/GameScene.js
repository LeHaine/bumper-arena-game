import Phaser from "phaser";
import io from "socket.io-client";
import playerAsset from "../../assets/player.png";
import {
    toRadians,
    calcAngle,
    moveTowardsPoint
} from "../../../shared/MathUtils";

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
    }

    init() {
        this.lastEmit = 0;
        this.player = null;
        this.connected = false;
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
                this.enemies.getChildren().forEach(enemy => {
                    if (enemy.id === id) {
                        enemy.destroy();
                    }
                });
            });
        });
    }

    update(time, delta) {
        if (this.player) {
            this.socket.emit("movement", {
                x: this.input.mousePointer.x,
                y: this.input.mousePointer.y
            });
        }
    }

    addPlayer(playerInfo) {
        this.player = this.add
            .sprite(playerInfo.position.x, playerInfo.position.y, "player")
            .setScale(0.5, 0.5)
            .setRotation(0);
        this.player.setTint(0x1c6ced);
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
        sprite.setPosition(playerInfo.position.x, playerInfo.position.y);
        sprite.setRotation(playerInfo.angle + 90);
    }
}

export default GameScene;
