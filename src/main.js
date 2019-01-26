import Client from "./client/phaser/Client";

window.onload = () => {
    window.game = new Client();
    resize();
    window.addEventListener("resize", resize, false);
};

const resize = () => {
    let client = window.game;
    let canvas = document.querySelector("canvas");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let wratio = width / height;
    let ratio = client.config.width / client.config.height;
    if (wratio < ratio) {
        canvas.style.width = width + "px";
        canvas.style.height = width / ratio + "px";
    } else {
        canvas.style.width = height * ratio + "px";
        canvas.style.height = height + "px";
    }
};
