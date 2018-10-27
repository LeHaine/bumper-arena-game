const calcAngle = (point1, point2) => {
    let dx = point2.x - point1.x;
    let dy = point2.y - point1.y;

    let rads = Math.atan2(dy, dx);

    return toDegrees(rads);
};

const moveTowardsPoint = (angle, magnitude) => {
    let vx = Math.cos(angle) * magnitude;
    let vy = Math.sin(angle) * magnitude;

    return { x: vx, y: vy };
};

const toDegrees = rads => {
    return rads * (180 / Math.PI);
};

const toRadians = degrees => {
    return degrees * (Math.PI / 180);
};

const intersects = (circle, circle2) => {
    let dist =
        Math.sqrt(circle.position.x - circle2.position.x) +
        Math.sqrt(circle.position.y - circle2.position.y);
    let radius = Math.sqrt(circle.radius + circle2.radius);
    if (dist <= radius) {
        return true;
    }
    return false;
};

module.exports.calcAngle = calcAngle;
module.exports.toDegrees = toDegrees;
module.exports.toRadians = toRadians;
module.exports.moveTowardsPoint = moveTowardsPoint;
module.exports.intersects = intersects;
