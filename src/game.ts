import * as PIXI from "pixi.js";
import {
  angleFromVector,
  angleToPoint,
  calculateSpeed,
  dist,
  distToSurface,
  // isInBounds,
  newPhysicalBody,
  outOfBounds,
  reset,
  updateVelocity,
} from "./utils";
import {
  CrashInstance,
  CrashProps,
  DraggingData,
  PhysicalBody,
} from "./types";

const AIR_RESISTANCE = 0.04;
const RESISTANCE = 0.7;
const GRAVITY = 0.05;
const AIR_RESISTANCE_RADIUS = 2.5;
const LANDING_RADIUS = 1;
const LANDING_VELOCITY = 1;
const DRAG_MODIFIER = 0.02;

export const runGame = (textures: Record<string, PIXI.Texture | undefined>): void => {
  const app = new PIXI.Application({
    antialias: true,
    backgroundColor: 0x222222,
    height: window.innerHeight,
    resolution: 1,
    transparent: false,
    width: window.innerWidth,
  });
  document.body.appendChild(app.view);

  /**
   * Sprites ----------------------------------
   */

  const earth: PhysicalBody = newPhysicalBody({
    initialPosition: new PIXI.Point(app.view.width * 0.1, app.view.height * 0.8),
    scale: new PIXI.Point(1.5, 1.5),
    texture: textures["earth"],
  });

  const moon: PhysicalBody = newPhysicalBody({
    initialPosition: new PIXI.Point(app.view.width * 0.75, app.view.height / 3),
    scale: new PIXI.Point(0.6, 0.65),
    texture: textures["moon"],
  });

  const rocket: PhysicalBody = newPhysicalBody({
    anchor: new PIXI.Point(0.5, 0.75),
    initialPosition: new PIXI.Point(
      app.view.width * 0.1,
      app.view.height * 0.8 - earth.radius,
    ),
    rotation: Math.PI * 1.5,
    scale: new PIXI.Point(0.3, 0.3),
    texture: textures["rocket"],
    velocity: new PIXI.Point(0),
  });
  reset(rocket);

  // Add to stage
  app.stage.addChild(earth.sprite, moon.sprite, rocket.sprite);

  const crashes: CrashInstance[] = [];

  const addCrash = ({ x, y, duration }: CrashProps) => {
    const crash = new PIXI.Sprite(textures["crash"]);
    crash.x = x;
    crash.y = y;
    crash.scale.set(0.1);
    crash.anchor.set(0.5);
    crashes.push({
      duration,
      sprite: crash,
    });
    app.stage.addChild(crash);
  };

  // Handle dragging for launching rocket
  const draggingData: DraggingData = {};
  app.stage.interactive = true;
  app.stage.hitArea = new PIXI.Rectangle(0, 0, app.view.width, app.view.height);
  app.stage.on("pointerdown", (e: PIXI.InteractionEvent) => {
    const { x, y } = e.data.global;
    draggingData.start = { x, y };
  });
  app.stage.on("pointerup", (e: PIXI.InteractionEvent) => {
    const distance = dist(draggingData.start, e.data.global) * DRAG_MODIFIER;
    const angle = angleToPoint(draggingData.start, e.data.global);
    updateVelocity(
      rocket,
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
    );
    rocket.sprite.rotation = angleFromVector(rocket.velocity);
  });

  app.ticker.add(delta => {
    earth.sprite.rotation += 0.01;
    // moon.sprite.rotation -= 0.01;
    const distance = distToSurface(moon, rocket);
    const speed = calculateSpeed(rocket.velocity);

    if (distToSurface(earth, rocket) < 100) {
      rocket.sprite.rotation = Math.PI + angleToPoint(earth.sprite, rocket.sprite);

      const rotation = 0.01;
      const x2 = rocket.sprite.x * Math.cos(rotation) + rocket.sprite.y * Math.sin(rotation);
      const y2 = rocket.sprite.x * Math.sin(rotation) + rocket.sprite.y * Math.cos(rotation);

      // rocket.sprite.x = x2;
      // rocket.sprite.y = y2;


      // const hyp = 2 * earth.radius ** 2 - 2 * earth.radius ** 2 * Math.cos(rotation);
      // rocket.sprite.x = Math.cos(earth.sprite.rotation);
      // rocket.sprite.y = Math.sin(earth.sprite.rotation);
      // rocket.sprite.x = earth.radius * Math.cos(rotation) - earth.radius * Math.sin(rotation);
      // rocket.sprite.y = earth.radius * Math.sin(rotation) - earth.radius * Math.cos(rotation);
      // const hyp = 2 * earth.radius * Math.cos((Math.PI - 0.01) / 2);
      // const angle = Math.PI / 2 - ((Math.PI - 0.01) / 2);
      // const adj = hyp * Math.acos(angle);
      // const opp = hyp * Math.asin(angle);
      // rocket.sprite.x += adj;
      // rocket.sprite.y += opp;
    } else if (distance <= 0 && speed > 8) {
      const { x, y } = rocket.sprite;
      addCrash({ duration: 100, x, y });
      rocket.sprite.visible = false;
      updateVelocity(rocket, 0);
    } else if (distance <= 0) {
      updateVelocity(rocket, 0);
      rocket.sprite.rotation = angleToPoint(rocket.sprite, moon.sprite);
    } else if (distance < moon.radius * LANDING_RADIUS) {
      const landingSpeed = Math.abs(Math.hypot(
        LANDING_VELOCITY * -Math.cos(angleToPoint(rocket.sprite, moon.sprite)),
        LANDING_VELOCITY * -Math.sin(angleToPoint(rocket.sprite, moon.sprite)),
      ));

      if (speed > landingSpeed) {
        updateVelocity(
          rocket,
          rocket.velocity.x * (1 - AIR_RESISTANCE),
          rocket.velocity.y * (1 - AIR_RESISTANCE),
        );
      } else {
        updateVelocity(
          rocket,
          LANDING_VELOCITY * -Math.cos(angleToPoint(rocket.sprite, moon.sprite)),
          LANDING_VELOCITY * -Math.sin(angleToPoint(rocket.sprite, moon.sprite))
        );
        rocket.sprite.rotation = angleToPoint(rocket.sprite, moon.sprite);
      }

    } else if (distance < moon.sprite.width * AIR_RESISTANCE_RADIUS) {
      updateVelocity(
        rocket,
        rocket.velocity.x * (1 - AIR_RESISTANCE)
        + (1 - RESISTANCE) * -Math.cos(angleToPoint(rocket.sprite, moon.sprite)),
        rocket.velocity.y * (1 - AIR_RESISTANCE)
        + (1 - RESISTANCE) * -Math.sin(angleToPoint(rocket.sprite, moon.sprite)),
      );

      rocket.sprite.rotation = angleFromVector(rocket.velocity);
    } else {
      rocket.velocity.set(
        rocket.velocity.x + (1 - RESISTANCE) * -Math.cos(angleToPoint(rocket.sprite, moon.sprite)),
        rocket.velocity.y + (1 - RESISTANCE) * -Math.sin(angleToPoint(rocket.sprite, moon.sprite)),
      );

      rocket.sprite.rotation = angleFromVector(rocket.velocity);

      rocket.sprite.x +=
        rocket.velocity.x * delta / (distToSurface(moon, rocket) * GRAVITY);
      rocket.sprite.y +=
        rocket.velocity.y * delta / (distToSurface(moon, rocket) * GRAVITY);
    }

    rocket.sprite.x += rocket.velocity.x * delta;
    rocket.sprite.y += rocket.velocity.y * delta;


    for (let i = crashes.length; i >= 0; i--) {
      const crash = crashes[i];
      if (crash === undefined) {
        continue;
      }
      if (crash.duration < 0) {
        crashes.splice(i, 1);
        app.stage.removeChild(crash.sprite);
        reset(rocket);
      } else {
        crash.sprite.scale.set(Math.min(crash.sprite.scale.x + 0.1, 2));
        crash.sprite.alpha -= 0.01;
        crash.duration -= delta;
      }
    }
    if (outOfBounds(rocket, app.view)) {
      reset(rocket);
    }
  });
};
