import Phaser from "phaser";
import GameScene from "./scenes/GameScene";

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
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
