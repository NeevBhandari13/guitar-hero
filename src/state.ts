export { initialState, Tick, NewNote, reduceState, KeyPress, KeyRelease };

import { Action, INCREMENT, Key, State, note, Constants, Note } from "./types";
import { calculateNewMultiplier } from "./util";

/**
 * Initial game state
 */
const initialState: State = {
    gameEnd: false,
    notes: [],
    score: 0,
    missedNotes: 0,
    playRandomNote: false,
    multiplier: 1,
    streak: 0,
    saveStreak: false,
};

//////////////// STATE UPDATES //////////////////////

// Action types that trigger game state transitions

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
class Tick implements Action {
    apply = (s: State): State => {
        // missed notes checks if note.yPos > Constants.CIRCLE_POS + Note.RADIUS * 1.5 as this will capture notes that have
        // gone past without being played
        const missedNotesCount = s.notes.filter(
            (note) =>
                note.yPos > Constants.CIRCLE_POS + Note.RADIUS * 1.5 &&
                !note.played,
        ).length;

        const updatedNotes = s.notes
            .map((note) => {
                if (note.played && note.tailLength > 0) {
                    // If the note is being played and has a tail, reduce the tail length
                    const newTailLength = Math.max(
                        0,
                        note.tailLength - INCREMENT,
                    );
                    return {
                        ...note,
                        tailLength: newTailLength,
                    };
                } else {
                    // Regular note movement
                    return {
                        ...note,
                        yPos: note.yPos + INCREMENT,
                    };
                }
            })
            .filter((note) => note.yPos <= Constants.OUT_POS);

        const tailNotesScore = updatedNotes.filter(
            (note) => note.played && !note.scored && note.tailLength === 0,
        ).length;

        const newNotes = updatedNotes.map((note) => {
            return note.played && note.tailLength === 0
                ? {
                      ...note,
                      stopped: true,
                      scored: true,
                  }
                : note;
        });

        const newSaveStreak =
            missedNotesCount > 0
                ? false
                : tailNotesScore > 0
                  ? true
                  : s.saveStreak;

        const newStreak = s.saveStreak
            ? s.streak + tailNotesScore
            : missedNotesCount > 0
              ? 0
              : s.streak + tailNotesScore;
        const newMultiplier = calculateNewMultiplier(newStreak);

        return {
            ...s,
            notes: newNotes,
            missedNotes: s.missedNotes + missedNotesCount,
            playRandomNote: false,
            streak: newStreak,
            multiplier: newMultiplier,
            score: s.score + tailNotesScore,
            saveStreak: newSaveStreak,
        };
    };
}

/**
 * Updates state by adding new notes to notes array
 *
 * @param s Current state
 * @returns Updated state
 */
class NewNote implements Action {
    constructor(private readonly note: note) {}

    apply = (s: State): State => {
        if (this.note.id === "game-end") {
            return { ...s, gameEnd: true };
        }

        const updatedNote = {
            ...this.note,
        };
        const updatedNotes = [...s.notes, this.note];

        return {
            ...s,
            notes: updatedNotes,
            playRandomNote: false,
        };
    };
}

/**
 * Handles state updates when a key is pressed
 *
 * @param key The key that has been pressed
 * @param s Current state
 * @returns Updated state
 */
class KeyPress implements Action {
    constructor(private readonly key: Key) {}

    apply = (s: State): State => {
        const keyToColumn = {
            KeyH: "20%",
            KeyJ: "40%",
            KeyK: "60%",
            KeyL: "80%",
        };

        const matchNotes = (note: note) =>
            note.xPos == keyToColumn[this.key] &&
            Math.abs(note.yPos - Constants.CIRCLE_POS) <= Note.RADIUS * 1.5 &&
            !note.played;

        const updatedNotes = s.notes.map((note) =>
            matchNotes(note)
                ? note.tailLength === 0
                    ? {
                          ...note,
                          yPos: Constants.OUT_POS, // remove note only if tail length is 0
                          played: true,
                          scored: true,
                      }
                    : {
                          ...note,
                          played: true,
                      }
                : note,
        );

        // checks if keypress is valid
        const notesHit = s.notes.filter(matchNotes);

        // checks which notes increment score
        const scoreNotes = notesHit.filter((n) => n.tailLength === 0);

        // checks if keypress is invalid
        const invalidPress = notesHit.length === 0;

        // returns original score if keypress is invalid, otherwise increments score
        const updatedScore = parseFloat(
            (invalidPress
                ? s.score
                : s.score + scoreNotes.length * s.multiplier
            ).toFixed(2),
        );

        const newSaveStreak = invalidPress ? false : s.saveStreak;

        // if keypress is invalid, resets streak to 0, otherwise increments by 1
        const newStreak = invalidPress
            ? s.saveStreak
                ? s.streak
                : 0
            : s.streak + scoreNotes.length;

        const newMultiplier = calculateNewMultiplier(newStreak);

        return {
            ...s,
            notes: updatedNotes,
            score: updatedScore,
            playRandomNote: invalidPress,
            streak: newStreak,
            multiplier: newMultiplier,
            saveStreak: newSaveStreak,
        };
    };
}

/**
 * Handles state updates when a key is released
 *
 * @param key The key that has been released
 * @param s Current state
 * @returns Updated state
 */
class KeyRelease implements Action {
    constructor(private readonly key: Key) {}

    apply = (s: State): State => {
        const keyToColumn = {
            KeyH: "20%",
            KeyJ: "40%",
            KeyK: "60%",
            KeyL: "80%",
        };

        const matchNotes = (note: note) =>
            note.xPos == keyToColumn[this.key] &&
            Math.abs(note.yPos - Constants.CIRCLE_POS) <= Note.RADIUS * 1.5 &&
            note.played &&
            note.tailLength > 0;

        const updatedNotes = s.notes.map((note) =>
            matchNotes(note)
                ? {
                      ...note,
                      yPos: Constants.DISAPPEAR_POS,
                      played: false,
                      stopped: true,
                  }
                : note,
        );

        // checks if a note has been hit
        const notesStopped = s.notes.filter(matchNotes).length > 0;

        const newSaveStreak = notesStopped ? false : s.saveStreak;

        // if a note stopped midway, streak resets to 0
        const newStreak = notesStopped
            ? s.saveStreak
                ? s.streak
                : 0
            : s.streak;

        const newMultiplier = calculateNewMultiplier(newStreak);

        return {
            ...s,
            notes: updatedNotes,
            streak: newStreak,
            multiplier: newMultiplier,
            saveStreak: newSaveStreak,
        };
    };
}

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action) => action.apply(s);
// similar to scan
