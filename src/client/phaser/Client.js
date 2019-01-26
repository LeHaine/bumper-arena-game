import Phaser from "phaser";
import GameScene from "./scenes/GameScene";

const config = {
    type: Phaser.AUTO,
    width: 1600,
    height: 800,
    parent: "content",
    backgroundColor: "33ccff",
    scene: [GameScene]
};

class Client extends Phaser.Game {
    constructor() {
        super(config);
    }
}

export default Client;
