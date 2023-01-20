import React from "react";

import { World } from "./World";

import "./App.css";

function App() {
  const parentElementRef = React.useRef<HTMLDivElement | null>(null);
  const [isStarted, setIsStarted] = React.useState(false);
  const worldRef = React.useRef<World>();

  const handleStart = React.useCallback(() => {
    const parentElement = parentElementRef.current;

    if (!parentElement) return;

    setIsStarted(true);

    worldRef.current = new World({ parentElement });
  }, [isStarted]);

  const handleExplode = React.useCallback(() => {
    const world = worldRef.current;

    if (!world) return;

    world.explode();
  }, [isStarted]);

  return (
    <>
      <div ref={parentElementRef} />
      {isStarted ? (
        <button className="button explode-button" onClick={handleExplode}>
          Explode
        </button>
      ) : (
        <button className="button start-button" onClick={handleStart}>
          Start
        </button>
      )}
    </>
  );
}

export default App;
