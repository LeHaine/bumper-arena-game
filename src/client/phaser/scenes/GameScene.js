import Phaser from "phaser";
import io from "socket.io-client";
import playerAsset from "../../assets/player.png";

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
    }

    init() {}

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

            this.socket.on("disconnect", playerId => {
                this.enemies.getChildren().forEach(enemy => {
                    if (enemy.playerId === playerId) {
                        enemy.destroy();
                    }
                });
            });
        });
    }

    update(time, delta) {}

    addPlayer(playerInfo) {
        this.player = this.physics.add
            .sprite(playerInfo.x, playerInfo.y, "player")
            .setScale(0.5, 0.5);
        this.player.setTint(0x1c6ced);
    }

    addEnemyPlayer(playerInfo) {
        const enemy = this.add
            .image(playerInfo.x, playerInfo.y, "player")
            .setScale(0.5, 0.5);
        enemy.playerId = playerInfo.playerId;
        enemy.setTint(0xe50404);
        this.enemies.add(enemy);
    }
}

export default GameScene;
