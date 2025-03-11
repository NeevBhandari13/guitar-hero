export { Viewport, Constants, INCREMENT, Note };
export type { Key, Event, State, note, Action };

/** User input */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

type Event = "keydown" | "keyup" | "keypress";

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

// Stores all constants
const Constants = {
    TICK_RATE_MS: 16,
    SONG_NAME: "RockinRobin",
    NOTE_BUFFER: 1.9, // how long does it take the note to fall
    CIRCLE_POS: 350, // position of hit zone circle
    DISAPPEAR_POS: 385, // position at which note disappears from svg
    OUT_POS: 390, // position at which note is out of notes array
} as const;

// how many px the note falls by in each tick
const INCREMENT =
    Constants.CIRCLE_POS /
    ((Constants.NOTE_BUFFER * 1000) / Constants.TICK_RATE_MS);

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 10,
};
console.log(Note.RADIUS);

/** State processing */

type State = Readonly<{
    gameEnd: boolean;
    notes: Array<note>;
    score: number;
    missedNotes: number;
    playRandomNote: boolean;
    multiplier: number;
    streak: number;
    saveStreak: boolean;
}>;

type note = Readonly<{
    id: string;
    user_played: boolean;
    instrument_name: string;
    velocity: number;
    pitch: number;
    start: number;
    end: number;
    xPos: string;
    yPos: number;
    played: boolean;
    tailLength: number;
    stopped: boolean;
    scored: boolean;
}>;

/**
 * Actions modify state
 */
interface Action {
    apply(s: State): State;
}
